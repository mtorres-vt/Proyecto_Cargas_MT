import React, { useState, useEffect } from "react";
import { fetchMonths as getAvailableMonths, fetchValidation } from "./api";

export default function ModalValidacion({ dbName, tableName, onClose }) {
  const [month1, setMonth1] = useState("1");
  const [month2, setMonth2] = useState("2");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data1, setData1] = useState(null);
  const [data2, setData2] = useState(null);
  const [availableMonths, setAvailableMonths] = useState([]);

  useEffect(() => {
    async function fetchMonths() {
      try {
        const data = await getAvailableMonths(dbName, tableName);
          const monthsArray = data.months && data.months.length > 0 ? data.months : Array.from({length: 12}, (_, i) => i + 1);
          setAvailableMonths(monthsArray);
          
          if (monthsArray.length > 0) {
            setMonth1(monthsArray[0].toString());
            setMonth2(monthsArray.length > 1 ? monthsArray[1].toString() : monthsArray[0].toString());
          }
      } catch (err) {
        setAvailableMonths(Array.from({length: 12}, (_, i) => i + 1));
      }
    }
    fetchMonths();
  }, [dbName, tableName]);

  const handleValidate = async () => {
    setLoading(true);
    setError("");
    try {
      const [d1, d2] = await Promise.all([
        fetchValidation(dbName, tableName, month1),
        fetchValidation(dbName, tableName, month2)
      ]);

      setData1(d1);
      setData2(d2);
    } catch (err) {
      setError(err.message || "Ocurrió un error al validar los datos.");
    } finally {
      setLoading(false);
    }
  };

  const formatPercent = (value, total) => {
    if (total === 0 || !value) return '0.00%';
    return `${(value / total * 100).toFixed(2)}%`;
  };

  const renderUnifiedTable = () => {
    if (!data1 || !data2 || !data1.columns || !data2.columns) return null;

    if (data1.notLoaded || data2.notLoaded) {
      return (
        <div className="mb-4">
          <div className="alert alert-warning text-center border-0 shadow-sm mt-3">
            <i className="fw-bold text-dark">Registros no encontrados para uno de los meses seleccionados.</i><br/>
            Cierra esta ventana y utiliza el botón <b>CargarRegistros</b> para procesar los datos.
          </div>
        </div>
      );
    }

    const diffRows = data2.totalRows - data1.totalRows;

    const formatDiff = (value) => {
      if (Math.abs(value) < 0.01) return <span className="text-muted">~0.00%</span>;
      const sign = value > 0 ? '+' : '';
      return `${sign}${value.toFixed(2)}%`;
    };

    return (
      <div className="mb-4">
        <div className="d-flex justify-content-between align-items-center bg-light p-3 border rounded shadow-sm mb-3">
          <h5 className="fw-bold mb-0 text-primary">Comparativa Mes {month1} vs Mes {month2}</h5>
          <div className="text-end">
            <span className="me-3 fw-bold">Total Mes {month1}: <span className="text-primary">{data1.totalRows.toLocaleString()}</span></span>
            <span className="me-3 fw-bold">Total Mes {month2}: <span className="text-info">{data2.totalRows.toLocaleString()}</span></span>
            <span className="fw-bold">
              Diferencia: <span className={diffRows > 0 ? "text-success" : diffRows < 0 ? "text-danger" : "text-muted"}>
                {diffRows > 0 ? `+${diffRows.toLocaleString()}` : diffRows.toLocaleString()}
              </span>
            </span>
          </div>
        </div>
        
        <div className="table-responsive border rounded shadow-sm" style={{ maxHeight: "65vh", overflow: "auto" }}>
          <table className="table table-bordered table-hover mb-0 align-middle text-center" style={{ minWidth: "1300px" }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
              <tr>
                <th rowSpan="2" className="text-center align-middle border-end border-3 bg-secondary text-white" style={{ position: "sticky", left: 0, zIndex: 3 }}>Columna</th>
                <th colSpan="3" className="border-end border-3 bg-primary text-white">Mes {month1}</th>
                <th colSpan="3" className="border-end border-3 bg-info text-dark">Mes {month2}</th>
                <th colSpan="3" className="bg-dark text-white">Variación (Δ % Mes {month2} vs {month1})</th>
              </tr>
              <tr>
                <th className="table-success border-top-0"><i className="bi bi-check-circle-fill text-success me-1"></i> Llenos</th>
                <th className="table-warning border-top-0"><i className="bi bi-exclamation-triangle-fill text-warning me-1"></i> Vacíos / N/A</th>
                <th className="border-end border-3 table-danger border-top-0"><i className="bi bi-x-circle-fill text-danger me-1"></i> Nulos</th>
                <th className="table-success border-top-0"><i className="bi bi-check-circle-fill text-success me-1"></i> Llenos</th>
                <th className="table-warning border-top-0"><i className="bi bi-exclamation-triangle-fill text-warning me-1"></i> Vacíos / N/A</th>
                <th className="border-end border-3 table-danger border-top-0"><i className="bi bi-x-circle-fill text-danger me-1"></i> Nulos</th>
                <th className="table-success border-top-0"><i className="bi bi-check-circle-fill text-success me-1"></i> Δ Llenos</th>
                <th className="table-warning border-top-0"><i className="bi bi-exclamation-triangle-fill text-warning me-1"></i> Δ Vacíos</th>
                <th className="table-danger border-top-0"><i className="bi bi-x-circle-fill text-danger me-1"></i> Δ Nulos</th>
              </tr>
            </thead>
            <tbody>
              {data1.columns.map((col1, idx) => {
                const col2 = data2.columns.find(c => c.columnName === col1.columnName) || { filled: 0, empty: 0, nulls: 0 };
                const p1 = { filled: data1.totalRows > 0 ? (col1.filled / data1.totalRows * 100) : 0, empty: data1.totalRows > 0 ? (col1.empty / data1.totalRows * 100) : 0, nulls: data1.totalRows > 0 ? (col1.nulls / data1.totalRows * 100) : 0 };
                const p2 = { filled: data2.totalRows > 0 ? (col2.filled / data2.totalRows * 100) : 0, empty: data2.totalRows > 0 ? (col2.empty / data2.totalRows * 100) : 0, nulls: data2.totalRows > 0 ? (col2.nulls / data2.totalRows * 100) : 0 };
                
                return (
                  <tr key={idx}>
                    <td className="text-center fw-bold border-end border-3 bg-white align-middle" style={{ position: "sticky", left: 0, zIndex: 1 }}>{col1.columnName}</td>
                    <td className="table-success align-middle">{col1.filled.toLocaleString()} <small className="text-muted d-block">({formatPercent(col1.filled, data1.totalRows)})</small></td>
                    <td className="table-warning align-middle">{col1.empty.toLocaleString()} <small className="text-muted d-block">({formatPercent(col1.empty, data1.totalRows)})</small></td>
                    <td className="table-danger border-end border-3 align-middle">{col1.nulls.toLocaleString()} <small className="text-muted d-block">({formatPercent(col1.nulls, data1.totalRows)})</small></td>
                    <td className="table-success align-middle">{col2.filled.toLocaleString()} <small className="text-muted d-block">({formatPercent(col2.filled, data2.totalRows)})</small></td>
                    <td className="table-warning align-middle">{col2.empty.toLocaleString()} <small className="text-muted d-block">({formatPercent(col2.empty, data2.totalRows)})</small></td>
                    <td className="table-danger border-end border-3 align-middle">{col2.nulls.toLocaleString()} <small className="text-muted d-block">({formatPercent(col2.nulls, data2.totalRows)})</small></td>
                    <td className="table-success fw-bold align-middle text-dark">{formatDiff(p2.filled - p1.filled)}</td>
                    <td className="table-warning fw-bold align-middle text-dark">{formatDiff(p2.empty - p1.empty)}</td>
                    <td className="table-danger fw-bold align-middle text-dark">{formatDiff(p2.nulls - p1.nulls)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="modal-overlay" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1050 }}>
      <div className="modal-content shadow-lg bg-white" style={{ width: "98%", maxWidth: "1400px", maxHeight: "95vh", display: "flex", flexDirection: "column", borderRadius: "0.5rem", overflow: "hidden" }}>
        <div className="modal-header border-bottom p-3 bg-light d-flex justify-content-between align-items-center">
          <h4 className="modal-title m-0 fw-bold text-info">Validación de Datos: <span className="text-dark">{tableName}</span></h4>
          <button type="button" className="btn-close" aria-label="Close" onClick={onClose}></button>
        </div>
        <div className="modal-body p-4 overflow-auto">
          <div className="row mb-4 align-items-end bg-light p-3 rounded border shadow-sm mx-0">
            <div className="col-md-4"><label className="form-label fw-bold">Mes 1 (Base)</label><select className="form-select" value={month1} onChange={(e) => setMonth1(e.target.value)}>{availableMonths.map(m => (<option key={`m1-${m}`} value={m}>Mes {m}</option>))}</select></div>
            <div className="col-md-4"><label className="form-label fw-bold">Mes 2 (Comparativa)</label><select className="form-select" value={month2} onChange={(e) => setMonth2(e.target.value)}>{availableMonths.map(m => (<option key={`m2-${m}`} value={m}>Mes {m}</option>))}</select></div>
            <div className="col-md-4"><button className="btn btn-info text-white w-100 fw-bold shadow" onClick={handleValidate} disabled={loading}>{loading ? <><span className="spinner-border spinner-border-sm me-2"></span>Validando...</> : "Ejecutar Validación"}</button></div>
          </div>
          {error && <div className="alert alert-danger shadow-sm border-0">{error}</div>}
          {!loading && data1 && data2 && (<div className="row"><div className="col-12">{renderUnifiedTable()}</div></div>)}
        </div>
      </div>
    </div>
  );
}