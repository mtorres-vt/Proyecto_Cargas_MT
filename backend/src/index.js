import "dotenv/config";
import express from "express";
import cors from "cors";
import { listColumns, listDatabases, listTables, getMonths, getValidationData, loadValidationData, listProdColumns } from "./db.js";

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/databases", async (req, res) => {
  try {
    const databases = await listDatabases();
    res.json(databases);
  } catch (error) {
    console.error("❌ Error en GET /api/databases:", error.message);
    res.status(500).json({ error: "No se pudieron cargar las bases de datos." });
  }
});

app.get("/api/databases/:database/tables", async (req, res) => {
  try {
    const tables = await listTables(req.params.database);
    res.json(tables);
  } catch (error) {
    if (error?.message === "Identificador inválido") {
      return res.status(400).json({ error: "Nombre de base de datos inválido." });
    }
    res.status(500).json({ error: "No se pudieron cargar las tablas." });
  }
});

app.get("/api/databases/:database/tables/:table/columns", async (req, res) => {
  try {
    const columns = await listColumns(req.params.database, req.params.table);
    res.json(columns);
  } catch (error) {
    if (error?.message === "Identificador inválido") {
      return res.status(400).json({ error: "Nombre de base de datos inválido." });
    }
    res.status(500).json({ error: "No se pudieron cargar las columnas." });
  }
});

app.get("/api/databases/:database/tables/:table/months", async (req, res) => {
  try {
    const months = await getMonths(req.params.database, req.params.table);
    res.json({ months });
  } catch (error) {
    res.status(500).json({ error: error.message || "No se pudieron cargar los meses." });
  }
});

app.get("/api/databases/:database/tables/:table/validation", async (req, res) => {
  try {
    const { database, table } = req.params;
    const month = req.query.month;
    if (!month) {
      return res.status(400).json({ error: "El parámetro month es requerido." });
    }
    const data = await getValidationData(database, table, month);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message || "No se pudo validar la información." });
  }
});

app.post("/api/databases/:database/tables/:table/load-validation", async (req, res) => {
  try {
    const { database, table } = req.params;
    const result = await loadValidationData(database, table);
    if (result.alreadyLoaded) {
      return res.json({ success: true, alreadyLoaded: true, message: "Ya se han cargado los registros." });
    }
    res.json({ success: true, alreadyLoaded: false, message: "Datos cargados correctamente" });
  } catch (error) {
    res.status(500).json({ error: error.message || "Error al cargar registros." });
  }
});

app.get("/api/prod/tables/:table/columns", async (req, res) => {
  try {
    const { table } = req.params;
    const columns = await listProdColumns(table);
    res.json(columns);
  } catch (error) {
    console.error("Error obteniendo columnas de producción:", error.message);
    res.status(500).json({ error: error.message || "No se pudieron cargar las columnas de producción." });
  }
});

app.listen(port, () => {
  console.log(`API escuchando en http://localhost:${port}`);
});
