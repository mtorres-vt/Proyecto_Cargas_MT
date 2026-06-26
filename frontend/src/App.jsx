import { useEffect, useMemo, useState } from "react";
import { fetchColumns, fetchDatabases, fetchTables, loadValidationData } from "./api";
import { getColumnDescription } from "./descripciones";
import MappingModal from "./MappingModal.jsx";
import ValidationModal from "./ValidationModal.jsx";
import ProcesoTempProModal from "./ProcesoTempProModal.jsx";
import Swal from "sweetalert2";

const DEFAULT_DATABASE = "FILIPINAS";

const formatSize = (column) => {
  if (column.characterMaximumLength == null) {
    return "";
  }
  if (column.characterMaximumLength === -1) {
    return "MAX";
  }
  return column.characterMaximumLength;
};

function App() {
  const [databases, setDatabases] = useState([]);
  const [selectedDb, setSelectedDb] = useState(DEFAULT_DATABASE);
  
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState("");
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeMapping, setActiveMapping] = useState(null); // 'exports' | 'imports'
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [showProcesoTempPro, setShowProcesoTempPro] = useState(false);


  useEffect(() => {
    let ignore = false;
    const loadDatabases = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await fetchDatabases();
        if (ignore) return;
        const sorted = [...data].sort((a, b) =>
          a.localeCompare(b, "es", { sensitivity: "base" })
        );
        // Keep original names for values, but UI will render them uppercase
        setDatabases(sorted);

        const defaultMatch = sorted.find((db) => db.toUpperCase() === DEFAULT_DATABASE);
        if (defaultMatch) {
          setSelectedDb(defaultMatch);
        } else if (sorted.length > 0) {
          setSelectedDb(sorted[0]);
        }
      } catch (err) {
        console.error("Error cargando bases de datos:", err);
        if (!ignore) setError("No se pudo cargar la lista de bases de datos.");
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    loadDatabases();
    return () => { ignore = true; };
  }, []);

  useEffect(() => {
    if (!selectedDb) {
      return;
    }
    let ignore = false;

    const loadTables = async () => {
      setLoading(true);
      setError("");
      setTables([]);
      setSelectedTable("");
      setColumns([]);
      try {
        const data = await fetchTables(selectedDb);
        if (ignore) return;
        setTables(data);
        
        // Buscar la tabla de Exportaciones más reciente (cualquier año)
        const exportTables = data.filter(t => t.toLowerCase().startsWith("exportaciones_"));
        const importTables = data.filter(t => t.toLowerCase().startsWith("importaciones_"));

        // Ordenar descendente para tomar el año más reciente
        exportTables.sort((a, b) => b.localeCompare(a));
        importTables.sort((a, b) => b.localeCompare(a));

        const matchExp = exportTables[0];
        const matchImp = importTables[0];

        if (matchExp) {
          setSelectedTable(matchExp);
        } else if (matchImp) {
          setSelectedTable(matchImp);
        } else if (data.length > 0) {
          setSelectedTable(data[0]);
        }
      } catch (err) {
        console.error("Error cargando tablas:", err);
        if (!ignore) setError("No se pudieron cargar las tablas de la base seleccionada.");
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    loadTables();
    return () => { ignore = true; };
  }, [selectedDb]);

  useEffect(() => {
    if (!selectedDb || !selectedTable) {
      return;
    }
    let ignore = false;

    const loadColumns = async () => {
      setLoading(true);
      setError("");
      setColumns([]);
      try {
        const data = await fetchColumns(selectedDb, selectedTable);
        if (!ignore) setColumns(data);
      } catch (err) {
        console.error("Error cargando columnas:", err);
        if (!ignore) setError("No se pudieron cargar las columnas.");
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    loadColumns();
    return () => { ignore = true; };
  }, [selectedDb, selectedTable]);

  const tableOptions = useMemo(
    () => tables.map((table) => (
      <option key={table} value={table}>
        {table}
      </option>
    )),
    [tables]
  );

  const handleLoadRecords = async (type) => {
    const tableLower = (selectedTable || "").toLowerCase();
    if (!tableLower.includes(type)) {
      Swal.fire({
        icon: "warning",
        title: "Tabla incorrecta",
        text: `Por favor, selecciona una tabla de ${type.toUpperCase()} para cargar sus registros.`,
        confirmButtonColor: "#ffc107"
      });
      return;
    }
    
    Swal.fire({
      title: 'Procesando registros...',
      html: 'Calculando todos los meses en la base de datos.<br/><b>Esto puede tardar un par de minutos.</b>',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    try {
      const result = await loadValidationData(selectedDb, selectedTable);
      if (result.alreadyLoaded) {
        Swal.fire({
          icon: "info",
          title: "Registros al día",
          text: "Ya se han cargado los registros correctamente. No hay datos nuevos para procesar.",
          confirmButtonColor: "#0dcaf0"
        });
      } else {
        Swal.fire({
          icon: "success", title: "¡Listo!", text: "Los registros se han guardado en memoria y ya están listos para la validación.", confirmButtonColor: "#198754"
        });
      }
    } catch (err) {
      Swal.fire({
        icon: "error", title: "Error", text: "Hubo un problema cargando los registros. " + (err.response?.data?.error || err.message), confirmButtonColor: "#dc3545"
      });
    }
  };

  return (
    <div className="container py-4">
      <header className="pb-3 mb-4 border-bottom">
        <h1 className="display-5 fw-bold text-primary">Control de Bases VRT</h1>
        <p className="fs-5 text-muted">Diccionario de datos para SQL Server 2008</p>
      </header>

      <div className="card shadow-sm mb-4 border-0">
        <div className="card-header bg-light">
          <h2 className="h5 mb-0">Configuración de búsqueda</h2>
        </div>
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label fw-bold">Base de datos a cargar</label>
              <select
                className="form-select"
                value={selectedDb}
                onChange={(e) => setSelectedDb(e.target.value)}
                aria-label="Base de datos"
              >
                {databases.map((db) => (
                  <option key={db} value={db}>
                    {db.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-6">
              <label className="form-label fw-bold">Tabla</label>
              <select
                className="form-select"
                value={selectedTable}
                onChange={(event) => setSelectedTable(event.target.value)}
              >
                {tableOptions}
              </select>
            </div>
          </div>

          <div className="mt-4">
            <h3 className="h6 fw-bold text-secondary">Accesos directos (Tablas de Proceso)</h3>
            <div className="d-flex gap-2 flex-wrap">
              <button
                className="btn btn-primary"
                onClick={() => {
                  const tableLower = (selectedTable || "").toLowerCase();
                  if (tableLower.includes("exportaciones")) {
                    setActiveMapping("exports");
                  } else if (tableLower.includes("importaciones")) {
                    setActiveMapping("imports");
                  } else {
                    Swal.fire({
                      icon: "warning",
                      title: "Atención",
                      text: "Por favor, selecciona una tabla de EXPORTACIONES o IMPORTACIONES para ver esta relación.",
                      confirmButtonColor: "#0d6efd"
                    });
                  }
                }}
              >
                Temp_Proceso
              </button>
              <button
                className="btn btn-outline-secondary"
                onClick={() => {
                  const tableLower = (selectedTable || "").toLowerCase();
                  if (!tableLower.includes("exportaciones") && !tableLower.includes("importaciones")) {
                    Swal.fire({
                      icon: "warning",
                      title: "Atención",
                      text: "Por favor, selecciona una tabla de EXPORTACIONES o IMPORTACIONES para ver el proceso.",
                      confirmButtonColor: "#0d6efd"
                    });
                    return;
                  }
                  setShowProcesoTempPro(true);
                }}
              >
                Proceso_Temp_Pro
              </button>
              <button
                className="btn btn-outline-secondary"
                onClick={() => {
                  const match = tables.find(t => t.toLowerCase() === "temp_aux_pro");
                  if (match) setSelectedTable(match);
                }}
                disabled={!tables.some(t => t.toLowerCase() === "temp_aux_pro")}
              >
                Temp_Aux_Pro
              </button>
              <button
                className="btn btn-warning text-dark fw-bold shadow-sm"
                onClick={() => handleLoadRecords("exportaciones")}
              >
                CargarRegistros Expo
              </button>
              <button
                className="btn btn-warning text-dark fw-bold shadow-sm"
                onClick={() => handleLoadRecords("importaciones")}
              >
                CargarRegistros Impo
              </button>
              <button
                className="btn btn-info text-white fw-bold shadow-sm"
                onClick={() => {
                  const tableLower = (selectedTable || "").toLowerCase();
                  if (tableLower.includes("exportaciones") || tableLower.includes("importaciones")) {
                    setShowValidationModal(true);
                  } else {
                    Swal.fire({
                      icon: "warning",
                      title: "Atención",
                      text: "Por favor, selecciona una tabla de EXPORTACIONES o IMPORTACIONES para validar los datos.",
                      confirmButtonColor: "#0dcaf0"
                    });
                  }
                }}
              >
                Validar_datos
              </button>
            </div>
          </div>
        </div>
      </div>

      {loading && <div className="alert alert-info shadow-sm border-0">Cargando datos...</div>}
      {error && <div className="alert alert-danger shadow-sm border-0">{error}</div>}

      <div className="card shadow-sm border-0">
        <div className="card-header bg-light">
          <h2 className="h5 mb-0">Diccionario de datos</h2>
        </div>
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-striped table-hover table-bordered mb-0 align-middle">
              <thead className="table-dark">
              <tr>
                <th className="py-3 px-3">Columna</th>
                <th className="py-3 px-3">Descripción</th>
                <th className="py-3 px-3">Tipo de dato</th>
                <th className="py-3 px-3">Tamaño máximo</th>
              </tr>
            </thead>
            <tbody>
              {columns.map((column) => (
                <tr key={column.columnName}>
                  <td className="px-3 fw-bold">{column.columnName}</td>
                  <td className="px-3">{getColumnDescription(selectedDb, selectedTable, column.columnName)}</td>
                  <td className="px-3"><span className="badge bg-secondary">{column.dataType}</span></td>
                  <td className="px-3">{formatSize(column)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      </div>

      {activeMapping && (
        <MappingModal 
          dbName={selectedDb} 
          onClose={() => setActiveMapping(null)} 
          mappingType={activeMapping}
          finalTableName={selectedTable}
        />
      )}

      {showValidationModal && (
        <ValidationModal
          dbName={selectedDb}
          tableName={selectedTable}
          onClose={() => setShowValidationModal(false)}
        />
      )}

      {showProcesoTempPro && (
        <ProcesoTempProModal
          dbName={selectedDb}
          tableName={selectedTable}
          onClose={() => setShowProcesoTempPro(false)}
        />
      )}
    </div>
  );
}

export default App;
