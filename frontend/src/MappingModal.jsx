import React, { useEffect, useState, useMemo } from "react";
import { fetchColumns } from "./api";
import { MAPPING_CONFIG } from "./mappings";

export default function MappingModal({ dbName, onClose, mappingType, finalTableName }) {
  const [columnTypes, setColumnTypes] = useState({ t1: {}, t2: {}, t3: {} });
  const [dynamicMapping, setDynamicMapping] = useState([]);
  const [baseMappingLength, setBaseMappingLength] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const config = MAPPING_CONFIG[mappingType];
  const tableNames = useMemo(() => [...(config?.tables || []), finalTableName], [config, finalTableName]);

  useEffect(() => {
    let ignore = false;
    async function loadTypes() {
      setLoading(true);
      try {
        const [cols1, cols2, cols3] = await Promise.all([
          config?.tables[0] ? fetchColumns(dbName, config.tables[0]).catch(() => []) : [],
          config?.tables[1] ? fetchColumns(dbName, config.tables[1]).catch(() => []) : [],
          finalTableName ? fetchColumns(dbName, finalTableName).catch(() => []) : []
        ]);
        
        if (ignore) return;
        
        const mapTypes = (cols) => {
          const map = {};
          cols.forEach(c => { 
            let typeDesc = c.dataType;
            if (c.characterMaximumLength != null) {
              const size = c.characterMaximumLength === -1 ? "MAX" : c.characterMaximumLength;
              typeDesc += `(${size})`;
            }
            map[c.columnName] = typeDesc; 
          });
          return map;
        };
        
        setColumnTypes({
          t1: mapTypes(cols1),
          t2: mapTypes(cols2),
          t3: mapTypes(cols3)
        });

        // Generar mapeo dinámico combinando el mapeo base y las nuevas columnas
        const baseMapping = config?.mapping || [];
        const newMapping = [];
        const processed = { t1: new Set(), t2: new Set(), t3: new Set() };

        // 1. Agregar todas las columnas del mapeo base (en orden canónico)
        baseMapping.forEach(row => {
          newMapping.push({ ...row });
          if (row.t1) processed.t1.add(row.t1.toUpperCase());
          if (row.t2) processed.t2.add(row.t2.toUpperCase());
          if (row.t3) processed.t3.add(row.t3.toUpperCase());
        });

        const findCol = (cols, name) => cols.find(c => c.columnName.toUpperCase() === name.toUpperCase());

        // Ordenar columnas extra A-Z para consistencia visual
        const sorted3 = [...cols3].sort((a, b) => a.columnName.localeCompare(b.columnName));
        const sorted1 = [...cols1].sort((a, b) => a.columnName.localeCompare(b.columnName));
        const sorted2 = [...cols2].sort((a, b) => a.columnName.localeCompare(b.columnName));

        // 2. Agregar columnas restantes de la tabla 3 (final) — A-Z
        sorted3.forEach(c => {
          const upperName = c.columnName.toUpperCase();
          if (!processed.t3.has(upperName)) {
            let t1Match = null;
            let t2Match = null;
            
            // Buscar coincidencias automáticas por nombre en t1 y t2
            if (!processed.t1.has(upperName) && findCol(cols1, c.columnName)) {
              t1Match = c.columnName;
              processed.t1.add(upperName);
            }
            if (!processed.t2.has(upperName) && findCol(cols2, c.columnName)) {
              t2Match = c.columnName;
              processed.t2.add(upperName);
            }
            
            newMapping.push({ t1: t1Match, t2: t2Match, t3: c.columnName });
            processed.t3.add(upperName);
          }
        });

        // 3. Agregar columnas restantes de t1 — A-Z
        sorted1.forEach(c => {
          const upperName = c.columnName.toUpperCase();
          if (!processed.t1.has(upperName)) {
            let t2Match = null;
            if (!processed.t2.has(upperName) && findCol(cols2, c.columnName)) {
              t2Match = c.columnName;
              processed.t2.add(upperName);
            }
            newMapping.push({ t1: c.columnName, t2: t2Match, t3: null });
            processed.t1.add(upperName);
          }
        });

        // 4. Agregar columnas restantes de t2 — A-Z
        sorted2.forEach(c => {
          const upperName = c.columnName.toUpperCase();
          if (!processed.t2.has(upperName)) {
            newMapping.push({ t1: null, t2: c.columnName, t3: null });
            processed.t2.add(upperName);
          }
        });

        setDynamicMapping(newMapping);
        setBaseMappingLength(baseMapping.length);

      } catch (err) {
        console.error("Error cargando tipos de columnas:", err);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    
    if (dbName && config && finalTableName) {
      loadTypes();
    }
    return () => { ignore = true; };
  }, [dbName, config, finalTableName]);

  return (
    <div className="modal-overlay" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)", zIndex: 1050 }}>
      <div className="modal-content shadow-lg bg-white p-4 rounded" style={{ margin: "5% auto", width: "95%", maxWidth: "1400px" }}>
        <div className="d-flex justify-content-between mb-3 border-bottom pb-2">
          <h4 className="text-primary">{config?.title || "Mapeo de Datos"}</h4>
          <button type="button" className="btn-close" onClick={onClose}></button>
        </div>
        <p>Tablas a comparar: <strong>{tableNames.join(", ")}</strong></p>
        
        <div className="table-responsive border rounded shadow-sm" style={{ maxHeight: "60vh", overflowY: "auto" }}>
          <table className="table table-bordered table-striped table-hover align-middle mb-0 text-center">
            <thead className="table-dark" style={{ position: "sticky", top: 0, zIndex: 1 }}>
              <tr>
                <th colSpan="2">{config?.tables[0] || "Tabla 1"}</th>
                <th colSpan="2">{config?.tables[1] || "Tabla 2"}</th>
                <th colSpan="2" className="bg-primary text-white">{finalTableName || "Tabla Final"}</th>
              </tr>
              <tr>
                <th className="bg-secondary text-white">Columna</th>
                <th className="bg-secondary text-white">Tipo</th>
                <th className="bg-secondary text-white">Columna</th>
                <th className="bg-secondary text-white">Tipo</th>
                <th className="bg-primary text-white">Columna</th>
                <th className="bg-primary text-white">Tipo</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-4 text-center">
                    <span className="spinner-border spinner-border-sm me-2"></span> Cargando tipos de datos...
                  </td>
                </tr>
              ) : (
                dynamicMapping.flatMap((row, idx) => {
                  const isExtra = idx === baseMappingLength && baseMappingLength > 0;
                  const dataRow = (
                    <tr key={idx} style={{ fontSize: "0.8rem" }}>
                      <td className="py-1 px-2">{row.t1 || <span className="text-muted fst-italic small">No aplica</span>}</td>
                      <td className="py-1 px-2">{row.t1 && columnTypes.t1[row.t1] ? <span className="badge bg-secondary" style={{ fontSize: "0.68rem" }}>{columnTypes.t1[row.t1]}</span> : ""}</td>
                      <td className="py-1 px-2">{row.t2 || <span className="text-muted fst-italic small">No aplica</span>}</td>
                      <td className="py-1 px-2">{row.t2 && columnTypes.t2[row.t2] ? <span className="badge bg-secondary" style={{ fontSize: "0.68rem" }}>{columnTypes.t2[row.t2]}</span> : ""}</td>
                      <td className="fw-bold text-primary py-1 px-2">{row.t3 || <span className="text-muted fst-italic small">No aplica</span>}</td>
                      <td className="py-1 px-2">{row.t3 && columnTypes.t3[row.t3] ? <span className="badge bg-primary" style={{ fontSize: "0.68rem" }}>{columnTypes.t3[row.t3]}</span> : ""}</td>
                    </tr>
                  );
                  if (isExtra) {
                    return [
                      <tr key={`sep-${idx}`}>
                        <td colSpan="6" className="text-center text-muted small fw-semibold py-1 border-top border-bottom" style={{ background: "#f0f0f0", letterSpacing: "0.05em" }}>
                          ── Columnas adicionales (A-Z) ──
                        </td>
                      </tr>,
                      dataRow
                    ];
                  }
                  return [dataRow];
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}