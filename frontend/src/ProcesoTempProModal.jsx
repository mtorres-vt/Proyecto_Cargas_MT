import React, { useEffect, useState, useMemo } from "react";
import { fetchColumns, fetchProdColumns } from "./api";

// ─────────────────────────────────────────────────────────────────────────────
// MAPEO: Exportaciones_* → TempExportacion_PH
// Columna izquierda (t1) = columna en la tabla Exportaciones (origen)
// Columna derecha (t2) = columna destino en TempExportacion_PH
// "expr" describe cómo se transforma (para la leyenda visual)
// ─────────────────────────────────────────────────────────────────────────────
const EXPO_MAPPING = [
  { t1: "ASSESSMENT_DATE", t2: "ASSESSMENT",         expr: "REPLACE(ASSESSMENT_DATE, '-', '')" },
  { t1: "ASSESSMENT_DATE", t2: "ASSESSMENT_DATE",    expr: "ASSESSMENT_DATE" },
  { t1: null,              t2: "CUSTOM",              expr: "'N/A'" },
  { t1: "REFERENCE_NO",   t2: "REFERENCE_NO",        expr: "REFERENCE_NO" },
  { t1: "DECLARATION_NO", t2: "DECLARATION_NO",      expr: "DECLARATION_NO" },
  { t1: "ITEM_NO",        t2: "ITEM_NO",             expr: "ITEM_NO" },
  { t1: "HS_CODE",        t2: "HS_CODE",             expr: "HS_CODE" },
  { t1: "BILL_OF_LADING", t2: "BILL_OF_LADING",      expr: "BILL_OF_LADING" },
  { t1: "EXPORTER_CODE",  t2: "EXPORTER_CODE",       expr: "EXPORTER_CODE" },
  { t1: "EXPORTER_NAME",  t2: "EXPORTER_NAME",       expr: "EXPORTER_NAME" },
  { t1: "IMPORTER_NAME",  t2: "IMPORTER_NAME",       expr: "IMPORTER_NAME" },
  { t1: "BROKER_NAME",    t2: "BROKER_NAME",         expr: "BROKER_NAME" },
  { t1: "ORIGIN_COUNTRY", t2: "ORIGIN_COUNTRY",      expr: "pp.Pais_Correcto (JOIN Paises)" },
  { t1: "DESTINATION_COUNTRY_NAME", t2: "DESTINATION_COUNTRY_NAME", expr: "p.Pais_Correcto (JOIN Paises)" },
  { t1: null,             t2: "PORT_NAME_DES",        expr: "'N/A'" },
  { t1: "PORT_CODE",      t2: "PORT_CODE",           expr: "PU.PortCode (JOIN Puerto_PH)" },
  { t1: "PORT_NAME",      t2: "PORT_NAME",           expr: "PU.PortName_Correcto (JOIN Puerto_PH)" },
  { t1: "VESSEL",         t2: "VESSEL",              expr: "VESSEL" },
  { t1: "PRODUCT_DESC",   t2: "PRODUCT_DESC",        expr: "PRODUCT_DESC" },
  { t1: "G_WEIGHT",       t2: "G_WEIGHT",            expr: "CAST(COALESCE(G_WEIGHT,0) AS DECIMAL(19,2))" },
  { t1: "N_WEIGHT",       t2: "N_WEIGHT",            expr: "CAST(COALESCE(N_WEIGHT,0) AS DECIMAL(19,2))" },
  { t1: "QTY",            t2: "QTY",                 expr: "CAST(COALESCE(QTY,0) AS float)" },
  { t1: "PACKAGES",       t2: "PACKAGES",            expr: "CAST(COALESCE(PACKAGES,0) AS float)" },
  { t1: "TYPE_OF_PACKAGES", t2: "TYPE_OF_PACKAGES",  expr: "TYPE_OF_PACKAGES" },
  { t1: "UOM",            t2: "UOM",                 expr: "u.Unidad_Correcta (JOIN Unidades)" },
  { t1: "DUTIABLE_VALUE_PHP", t2: "DUTIABLE_VALUE_PHP", expr: "DUTIABLE_VALUE_PHP" },
  { t1: "FOB_USD",        t2: "FOB_USD",             expr: "CAST(COALESCE(FOB_USD,0) AS DECIMAL(19,2))" },
  { t1: null,             t2: "FOBUnit",              expr: "CAST(COALESCE(FOB_USD/NULLIF(QTY,0),0) AS DECIMAL(19,2))" },
  { t1: "INCOTERMS",      t2: "INCOTERMS",           expr: "INCOTERMS" },
];

// ─────────────────────────────────────────────────────────────────────────────
// MAPEO: Importaciones_* → TempImportacion_PH
// t1  = columna fuente en Importaciones_* (tabla raw)
// t2  = columna destino en TempImportacion_PH
// expr = expresión SQL usada en el SELECT
// ─────────────────────────────────────────────────────────────────────────────
const IMPO_MAPPING = [
  // 1. FECHAS ─────────────────────────────────────────────────────────────────
  { t1: "REGISTRY_DATE",           t2: "REGISTRY_NUM",            expr: "REPLACE(REGISTRY_DATE, '-', '')" },
  { t1: "REGISTRY_DATE",           t2: "REGISTRY_DATE",           expr: "REGISTRY_DATE" },
  { t1: null,                      t2: "DECLARATION_NO",          expr: "CAST(YEAR AS VARCHAR(4))+ PORT_1+' '+CAST(ENTRY_NO AS VARCHAR(20))" },
  // 2. DATOS DE ADUANA Y DOCUMENTOS ───────────────────────────────────────────
  { t1: null,                      t2: "Aduana",                  expr: "'N/A'" },
  { t1: "REFERENCE_NO",            t2: "REFERENCE_NO",            expr: "REFERENCE_NO" },
  { t1: "MANIFEST",                t2: "MANIFEST",                expr: "MANIFEST" },
  { t1: "AIRWAY_OR_HOUSE_BILL_ID", t2: "AIRWAY_OR_HOUSE_BILL_ID", expr: "AIRWAY_OR_HOUSE_BILL_ID" },
  { t1: "CONTAINER_NO",            t2: "CONTAINER_NO",            expr: "CONTAINER_NO" },
  { t1: "ITEM_NO",                 t2: "ITEM_NO",                 expr: "ITEM_NO" },
  { t1: "HS_CODE",                 t2: "HS_CODE",                 expr: "HS_CODE" },
  // 3. ACTORES DE LA IMPORTACIÓN ──────────────────────────────────────────────
  { t1: "CONSIGNEE_TIN",           t2: "IMPORTER_CODE",           expr: "CONSIGNEE_TIN" },
  { t1: "IMPORTER_NAME",           t2: "IMPORTER_NAME",           expr: "IMPORTER_NAME" },
  { t1: "EXPORTER_NAME",           t2: "EXPORTER_NAME",           expr: "EXPORTER_NAME" },
  { t1: "BROKER_TIN",              t2: "BROKER_TIN",              expr: "BROKER_TIN" },
  { t1: "BROKER",                  t2: "BROKER",                  expr: "BROKER" },
  // 4. LOGÍSTICA Y TRANSPORTE ─────────────────────────────────────────────────
  { t1: "ORIGIN_COUNTRY",          t2: "ORIGIN_COUNTRY",          expr: "p.Pais_Correcto (JOIN Paises)" },
  { t1: "EXPORT_COUNTRY",          t2: "EXPORT_COUNTRY",          expr: "pp.Pais_Correcto (JOIN Paises)" },
  { t1: "PORT_1",                  t2: "PORT_CODE",               expr: "PU.PortCode (JOIN Puerto_PH)" },
  { t1: "PORT_OF_CLEARANCE",       t2: "PORT_NAME",               expr: "PU.PortName_Correcto (JOIN Puerto_PH)" },
  { t1: "VESSEL_NAME",             t2: "VESSEL_NAME",             expr: "VESSEL_NAME" },
  // 5. DETALLES DEL PRODUCTO ──────────────────────────────────────────────────
  { t1: "PRODUCT_DESC",            t2: "PRODUCT_DESC",            expr: "PRODUCT_DESC" },
  { t1: "G_WEIGHT",                t2: "G_WEIGHT",                expr: "CAST(COALESCE(G_WEIGHT,0) AS DECIMAL(19,2))" },
  { t1: "N_WEIGHT",                t2: "N_WEIGHT",                expr: "CAST(COALESCE(N_WEIGHT,0) AS DECIMAL(19,2))" },
  { t1: "QUANTITY",                t2: "QUANTITY",                expr: "CAST(COALESCE(QUANTITY,0) AS float)" },
  { t1: "PACKAGES",                t2: "PACKAGES",                expr: "CAST(COALESCE(PACKAGES,0) AS float)" },
  { t1: "TYPE_OF_PACKAGES",        t2: "TYPE_OF_PACKAGES",        expr: "TYPE_OF_PACKAGES" },
  { t1: "UNIT_OF_QUANTITY",        t2: "UNIT_OF_QUANTITY",        expr: "u.Unidad_Correcta (JOIN Unidades)" },
  // 6. VALORES TOTALES ────────────────────────────────────────────────────────
  { t1: "FOB_USD",                 t2: "FOB_IN_FC",               expr: "CAST(COALESCE(FOB_USD,0) AS DECIMAL(19,2))" },
  { t1: "FREIGHT_USD",             t2: "FREIGHT_IN_FC",           expr: "CAST(COALESCE(FREIGHT_USD,0) AS DECIMAL(19,2))" },
  { t1: "INSURANCE_USD",           t2: "INSURANCE_IN_FC",         expr: "CAST(COALESCE(INSURANCE_USD,0) AS DECIMAL(19,2))" },
  { t1: null,                      t2: "CIF_IN_FC",               expr: "CAST((COALESCE(FOB_USD,0)+COALESCE(FREIGHT_USD,0)+COALESCE(INSURANCE_USD,0)) AS DECIMAL(19,2))" },
  { t1: "CIF_IN_PESO",             t2: "CIF_IN_PHP",              expr: "CAST(COALESCE(CIF_IN_PESO,0) AS DECIMAL(19,2))" },
  // 7. VALORES UNITARIOS CALCULADOS ───────────────────────────────────────────
  { t1: null,                      t2: "FOBUnit",                 expr: "CAST(COALESCE(FOB_USD/NULLIF(QUANTITY,0),0) AS DECIMAL(19,2))" },
  { t1: null,                      t2: "CIFUnit",                 expr: "CAST(COALESCE((COALESCE(FOB_USD,0)+COALESCE(FREIGHT_USD,0)+COALESCE(INSURANCE_USD,0))/NULLIF(QUANTITY,0),0) AS DECIMAL(19,2))" },
  // 8. DATOS ADICIONALES ──────────────────────────────────────────────────────
  { t1: "INCOTERMS",               t2: "INCOTERMS",               expr: "INCOTERMS" },
];

// ─────────────────────────────────────────────────────────────────────────────
function TypeBadge({ type, variant = "secondary" }) {
  if (!type) return null;
  return <span className={`badge bg-${variant} font-monospace`} style={{ fontSize: "0.7rem" }}>{type}</span>;
}

// ─────────────────────────────────────────────────────────────────────────────
export default function ProcesoTempProModal({ dbName, tableName, onClose }) {
  const isExpo = tableName?.toLowerCase().includes("exportaciones");
  const isImpo = tableName?.toLowerCase().includes("importaciones");

  const prodTable  = isExpo ? "TempExportacion_PH" : "TempImportacion_PH";
  const baseMapping = isExpo ? EXPO_MAPPING : IMPO_MAPPING;
  const title = isExpo
    ? `Proceso: ${tableName} → TempExportacion_PH`
    : `Proceso: ${tableName} → TempImportacion_PH`;

  const [srcTypes,  setSrcTypes]  = useState({});   // columnas de Exportaciones/Importaciones
  const [destTypes, setDestTypes] = useState({});   // columnas de TempExportacion_PH / TempImportacion_PH
  const [dynamicRows, setDynamicRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  // Construir resumen de tipo legible
  const buildTypeMap = (cols) => {
    const m = {};
    cols.forEach(c => {
      let t = c.dataType;
      if (c.characterMaximumLength != null) {
        t += `(${c.characterMaximumLength === -1 ? "MAX" : c.characterMaximumLength})`;
      }
      m[c.columnName.toUpperCase()] = t;
    });
    return m;
  };

  useEffect(() => {
    let ignore = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [srcCols, destCols] = await Promise.all([
          fetchColumns(dbName, tableName).catch(() => []),
          fetchProdColumns(prodTable).catch(() => [])
        ]);
        if (ignore) return;

        const srcMap  = buildTypeMap(srcCols);
        const destMap = buildTypeMap(destCols);
        setSrcTypes(srcMap);
        setDestTypes(destMap);

        // Construir filas dinámicas:
        // 1. Agregar todas las filas del mapeo base (ya están en orden canónico)
        const processed = { src: new Set(), dest: new Set() };
        const rows = [];

        baseMapping.forEach(row => {
          rows.push({ ...row });
          if (row.t1) processed.src.add(row.t1.toUpperCase());
          if (row.t2) processed.dest.add(row.t2.toUpperCase());
        });

        // Ordenar restantes A-Z para consistencia visual
        const destColsSorted = [...destCols].sort((a, b) => a.columnName.localeCompare(b.columnName));
        const srcColsSorted  = [...srcCols].sort((a, b) => a.columnName.localeCompare(b.columnName));

        // 2. Columnas de la tabla destino (Prod) que no están en el mapeo
        destColsSorted.forEach(c => {
          const upper = c.columnName.toUpperCase();
          if (!processed.dest.has(upper)) {
            // Buscar si hay coincidencia directa en la fuente
            const srcMatch = srcCols.find(s => s.columnName.toUpperCase() === upper);
            rows.push({
              t1: srcMatch ? srcMatch.columnName : null,
              t2: c.columnName,
              expr: srcMatch ? c.columnName : "— sin mapear —"
            });
            processed.dest.add(upper);
            if (srcMatch) processed.src.add(upper);
          }
        });

        // 3. Columnas de la fuente no contempladas (A-Z)
        srcColsSorted.forEach(c => {
          const upper = c.columnName.toUpperCase();
          if (!processed.src.has(upper)) {
            rows.push({ t1: c.columnName, t2: null, expr: "— sin usar —" });
            processed.src.add(upper);
          }
        });

        setDynamicRows(rows);
      } catch (err) {
        console.error(err);
        setError("Error cargando las columnas: " + (err?.response?.data?.error || err.message));
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    if (dbName && tableName && (isExpo || isImpo)) {
      load();
    }
    return () => { ignore = true; };
  }, [dbName, tableName]);

  return (
    <div
      style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: "rgba(0,0,0,0.65)", zIndex: 1050,
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        overflowY: "auto", padding: "2rem 1rem"
      }}
    >
      <div
        className="bg-white rounded shadow-lg p-4"
        style={{ width: "98%", maxWidth: "1500px" }}
      >
        {/* Header */}
        <div className="d-flex justify-content-between align-items-center border-bottom pb-2 mb-3">
          <div>
            <h4 className="mb-0 text-primary">
              <span className="me-2">🔄</span>{title}
            </h4>
            <small className="text-muted">
              Servidor producción: <code>25.36.98.149</code> · Tabla destino: <strong>{prodTable}</strong>
            </small>
          </div>
          <button className="btn-close" onClick={onClose} />
        </div>

        {/* Leyenda */}
        <div className="d-flex gap-3 flex-wrap mb-3">
          <span><span className="badge bg-info text-dark me-1">Columna Origen</span>columna en {tableName}</span>
          <span><span className="badge bg-secondary me-1">Tipo Origen</span>tipo de dato SQL</span>
          <span><span className="badge bg-success me-1">Expresión SQL</span>transformación aplicada</span>
          <span><span className="badge bg-primary me-1">Columna Destino</span>campo en {prodTable}</span>
          <span><span className="badge bg-dark me-1">Tipo Destino</span>tipo de dato SQL destino</span>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}

        {/* Tabla */}
        <div className="table-responsive border rounded shadow-sm" style={{ maxHeight: "65vh", overflowY: "auto" }}>
          <table className="table table-bordered table-hover align-middle mb-0" style={{ fontSize: "0.85rem" }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
              <tr>
                <th colSpan="2" className="text-center bg-info text-dark">{tableName}</th>
                <th className="text-center" style={{ background: "#198754", color: "#fff" }}>Expresión / Transformación SQL</th>
                <th colSpan="2" className="text-center bg-primary text-white">{prodTable}</th>
              </tr>
              <tr>
                <th className="bg-info text-dark text-center">Columna Origen</th>
                <th className="bg-info text-dark text-center">Tipo</th>
                <th className="text-center" style={{ background: "#198754", color: "#fff" }}>Expresión</th>
                <th className="bg-primary text-white text-center">Columna Destino</th>
                <th className="bg-primary text-white text-center">Tipo</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" className="py-5 text-center">
                    <div className="spinner-border text-primary me-2" role="status" />
                    <span>Conectando con servidor de producción y cargando columnas...</span>
                  </td>
                </tr>
              ) : (
                dynamicRows.map((row, idx) => {
                  const srcType  = row.t1 ? srcTypes[row.t1.toUpperCase()]  : null;
                  const destType = row.t2 ? destTypes[row.t2.toUpperCase()] : null;
                  const isUnmapped = !row.t2;
                  const isNewDest  = !row.t1;

                  return (
                    <tr
                      key={idx}
                      style={{
                        background: isUnmapped
                          ? "rgba(255,193,7,0.08)"
                          : isNewDest
                          ? "rgba(108,117,125,0.06)"
                          : undefined
                      }}
                    >
                      {/* Origen */}
                      <td className="text-center fw-semibold">
                        {row.t1
                          ? <span className="text-info-emphasis">{row.t1}</span>
                          : <span className="text-muted fst-italic small">No aplica</span>
                        }
                      </td>
                      <td className="text-center">
                        {srcType ? <TypeBadge type={srcType} variant="info" /> : ""}
                      </td>

                      {/* Expresión */}
                      <td className="text-center" style={{ maxWidth: "320px" }}>
                        <code
                          className="small text-wrap d-block"
                          style={{
                            background: "rgba(25,135,84,0.1)",
                            borderRadius: "4px",
                            padding: "2px 6px",
                            color: "#0f5132",
                            wordBreak: "break-word"
                          }}
                        >
                          {row.expr || row.t1 || "—"}
                        </code>
                      </td>

                      {/* Destino */}
                      <td className="text-center fw-bold">
                        {row.t2
                          ? <span className="text-primary">{row.t2}</span>
                          : <span className="text-muted fst-italic small">No aplica</span>
                        }
                      </td>
                      <td className="text-center">
                        {destType ? <TypeBadge type={destType} variant="primary" /> : ""}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="mt-3 d-flex justify-content-between align-items-center">
          <small className="text-muted">
            {!loading && `${dynamicRows.length} filas de mapeo · ${Object.keys(srcTypes).length} columnas origen · ${Object.keys(destTypes).length} columnas destino`}
          </small>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
