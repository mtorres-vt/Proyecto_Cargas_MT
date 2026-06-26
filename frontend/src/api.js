import axios from "axios";

const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:4000";

export const api = axios.create({
  baseURL: apiBaseUrl
});

export const fetchDatabases = async () => {
  const { data } = await api.get("/api/databases");
  return data;
};

export const fetchTables = async (database) => {
  const dbParam = encodeURIComponent(database);
  const { data } = await api.get(`/api/databases/${dbParam}/tables`);
  return data;
};

export const fetchColumns = async (database, table) => {
  const dbParam = encodeURIComponent(database);
  const tableParam = encodeURIComponent(table);
  const { data } = await api.get(`/api/databases/${dbParam}/tables/${tableParam}/columns`);
  return data;
};

export const fetchMonths = async (database, table) => {
  const dbParam = encodeURIComponent(database);
  const tableParam = encodeURIComponent(table);
  const { data } = await api.get(`/api/databases/${dbParam}/tables/${tableParam}/months`);
  return data;
};

export const fetchValidation = async (database, table, month) => {
  const dbParam = encodeURIComponent(database);
  const tableParam = encodeURIComponent(table);
  const { data } = await api.get(`/api/databases/${dbParam}/tables/${tableParam}/validation?month=${month}`);
  return data;
};

export const loadValidationData = async (database, table) => {
  const dbParam = encodeURIComponent(database);
  const tableParam = encodeURIComponent(table);
  const { data } = await api.post(`/api/databases/${dbParam}/tables/${tableParam}/load-validation`);
  return data;
};

// Obtiene columnas de las tablas de producción (TempExportacion_PH / TempImportacion_PH)
export const fetchProdColumns = async (tableName) => {
  const tableParam = encodeURIComponent(tableName);
  const { data } = await api.get(`/api/prod/tables/${tableParam}/columns`);
  return data;
};
