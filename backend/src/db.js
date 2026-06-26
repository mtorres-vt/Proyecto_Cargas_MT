import sql from "mssql";

// ─────────────────────────────────────────────────────────────────────────────
// UTILIDADES
// ─────────────────────────────────────────────────────────────────────────────
const assertNonEmptyString = (value) => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error("Identificador inválido");
  }
};

const quoteSqlIdentifier = (value) => {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("Identificador inválido");
  }
  return value
    .split(".")
    .map((part) => `[${part.replace(/]/g, "]]")}]`)
    .join(".");
};

// ─────────────────────────────────────────────────────────────────────────────
// FÁBRICA DE POOL CON RECONEXIÓN AUTOMÁTICA
// Devuelve { getPool } independiente para cada servidor.
// ─────────────────────────────────────────────────────────────────────────────
function createPool(configFn, label) {
  let pool = null;
  let isConnecting = false;

  const getPool = async (retries = 3, delayMs = 1500) => {
    if (pool && pool.connected) return pool;

    if (isConnecting) {
      await new Promise((r) => setTimeout(r, delayMs));
      return retries > 0
        ? getPool(retries - 1, delayMs)
        : Promise.reject(new Error(`[${label}] Timeout esperando conexión`));
    }

    isConnecting = true;
    try {
      if (pool) {
        try { await pool.close(); } catch (_) {}
        pool = null;
      }

      const config = configFn();
      pool = new sql.ConnectionPool(config);

      pool.on("error", (err) => {
        console.warn(`⚠️  [${label}] Pool desconectado, se reconectará en el próximo request:`, err.message);
        pool = null;
      });

      await pool.connect();
      console.log(`✅ [${label}] Conexión SQL establecida.`);
      return pool;
    } catch (err) {
      pool = null;
      if (retries > 0) {
        console.warn(`⚠️  [${label}] Error conectando, reintentando en ${delayMs}ms... (intentos: ${retries})`);
        await new Promise((r) => setTimeout(r, delayMs));
        return getPool(retries - 1, delayMs * 2);
      }
      console.error(`❌ [${label}] No se pudo conectar:`, err.message);
      throw err;
    } finally {
      isConnecting = false;
    }
  };

  return { getPool };
}

// ─────────────────────────────────────────────────────────────────────────────
// POOL PRINCIPAL (servidor del .env)
// ─────────────────────────────────────────────────────────────────────────────
const mainPool = createPool(() => {
  if (!process.env.DB_SERVER) {
    throw new Error("Configuración del servidor de BD incompleta. Falta DB_SERVER en .env");
  }
  return {
    server: process.env.DB_SERVER,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    options: {
      encrypt: process.env.DB_ENCRYPT === "true",
      trustServerCertificate: true,
    },
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
    connectionTimeout: 20000,
    requestTimeout: 60000,
  };
}, "Principal");

export const getPool = mainPool.getPool;

// ─────────────────────────────────────────────────────────────────────────────
// POOL DE PRODUCCIÓN (25.36.98.149 — TempExportacion_PH / TempImportacion_PH)
// ─────────────────────────────────────────────────────────────────────────────
const prodPool = createPool(() => ({
  server: process.env.PROD_DB_SERVER || "25.36.98.149",
  user: process.env.PROD_DB_USER || "mtorres",
  password: process.env.PROD_DB_PASSWORD || "T0rr35VTMarSQL",
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
  pool: { max: 5, min: 0, idleTimeoutMillis: 30000 },
  connectionTimeout: 15000,
  requestTimeout: 30000,
}), "Producción");

export const getProdPool = prodPool.getPool;

// ─────────────────────────────────────────────────────────────────────────────
// VALIDACIONES
// ─────────────────────────────────────────────────────────────────────────────
const assertDatabaseExists = async (databaseName) => {
  assertNonEmptyString(databaseName);
  const pool = await getPool();
  const result = await pool
    .request()
    .input("dbName", sql.NVarChar, databaseName)
    .query("SELECT 1 AS existsFlag FROM sys.databases WHERE name = @dbName");
  if (!result.recordset?.length) {
    throw new Error("Identificador inválido");
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIONES DE DATOS — SERVIDOR PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export const listDatabases = async () => {
  const pool = await getPool();
  const result = await pool
    .request()
    .query("SELECT name FROM sys.databases WHERE name NOT IN ('master', 'tempdb', 'model', 'msdb') ORDER BY name");
  return result.recordset.map((row) => row.name);
};

export const listTables = async (databaseName) => {
  await assertDatabaseExists(databaseName);
  const pool = await getPool();
  const escapedDbName = quoteSqlIdentifier(databaseName);
  const result = await pool.request().query(
    `SELECT TABLE_NAME
     FROM ${escapedDbName}.INFORMATION_SCHEMA.TABLES
     WHERE TABLE_TYPE = 'BASE TABLE'
     ORDER BY TABLE_NAME`
  );
  return result.recordset.map((row) => row.TABLE_NAME);
};

export const listColumns = async (databaseName, tableName) => {
  await assertDatabaseExists(databaseName);
  assertNonEmptyString(tableName);
  const pool = await getPool();
  const escapedDbName = quoteSqlIdentifier(databaseName);
  const result = await pool
    .request()
    .input("tableName", sql.NVarChar, tableName)
    .query(
      `SELECT COLUMN_NAME AS columnName,
              DATA_TYPE AS dataType,
              CHARACTER_MAXIMUM_LENGTH AS characterMaximumLength
       FROM ${escapedDbName}.INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_NAME = @tableName
       ORDER BY ORDINAL_POSITION`
    );
  return result.recordset;
};

export const getMonths = async (databaseName, tableName) => {
  await assertDatabaseExists(databaseName);
  assertNonEmptyString(tableName);
  const pool = await getPool();
  const isExport = tableName.toLowerCase().includes("exportaciones");
  const monthColumn = isExport ? "MONTH([ASSESSMENT_DATE])" : "TRY_CAST([MONTH] AS INT)";
  const query = `
    USE ${quoteSqlIdentifier(databaseName)};
    SELECT DISTINCT ${monthColumn} AS mes
    FROM ${quoteSqlIdentifier(tableName)}
    WHERE ${monthColumn} IS NOT NULL
    ORDER BY mes ASC;
  `;
  const result = await pool.request().query(query);
  return result.recordset.map((r) => r.mes);
};

const ensureSummaryTable = async (pool, databaseName) => {
  const escapedDb = quoteSqlIdentifier(databaseName);
  await pool.request().query(`
    USE ${escapedDb};
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='VRT_ValidationSummary' AND xtype='U')
    CREATE TABLE VRT_ValidationSummary (
        TableName NVARCHAR(128),
        DataMonth INT,
        ColumnName NVARCHAR(128),
        TotalRows INT,
        FilledCount INT,
        EmptyCount INT,
        ZeroCount INT,
        LastUpdated DATETIME DEFAULT GETDATE(),
        PRIMARY KEY (TableName, DataMonth, ColumnName)
    )
  `);
};

export const loadValidationData = async (databaseName, tableName) => {
  await assertDatabaseExists(databaseName);
  assertNonEmptyString(tableName);
  const pool = await getPool();
  await ensureSummaryTable(pool, databaseName);

  const isExport = tableName.toLowerCase().includes("exportaciones");
  const monthColumn = isExport ? "MONTH([ASSESSMENT_DATE])" : "TRY_CAST([MONTH] AS INT)";

  const sourceMonthsResult = await pool.request().query(`
    USE ${quoteSqlIdentifier(databaseName)};
    SELECT ${monthColumn} AS DataMonth, COUNT(*) AS TotalRows
    FROM ${quoteSqlIdentifier(tableName)}
    WHERE ${monthColumn} IS NOT NULL
    GROUP BY ${monthColumn};
  `);
  
  const summaryMonthsResult = await pool
    .request()
    .input("tableName", sql.NVarChar, tableName)
    .query(`
      USE ${quoteSqlIdentifier(databaseName)};
      SELECT DataMonth, MAX(TotalRows) AS TotalRows
      FROM VRT_ValidationSummary
      WHERE TableName = @tableName
      GROUP BY DataMonth;
    `);

  const sourceMonths = sourceMonthsResult.recordset;
  const summaryMonths = summaryMonthsResult.recordset;

  const pendingMonths = [];
  for (const src of sourceMonths) {
    const sumMatch = summaryMonths.find(sm => sm.DataMonth === src.DataMonth);
    if (!sumMatch || sumMatch.TotalRows !== src.TotalRows) {
      pendingMonths.push(src.DataMonth);
    }
  }

  if (pendingMonths.length === 0) {
    return { success: true, alreadyLoaded: true };
  }

  const colsResult = await pool
    .request()
    .input("tableName", sql.NVarChar, tableName)
    .query(`
      SELECT COLUMN_NAME, DATA_TYPE
      FROM ${quoteSqlIdentifier(databaseName)}.INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = @tableName
    `);
  const columns = colsResult.recordset;
  if (columns.length === 0) throw new Error("La tabla no tiene columnas o no existe.");

  const numericDateTypes = [
    "int", "bigint", "smallint", "tinyint", "decimal", "numeric",
    "float", "real", "money", "smallmoney", "datetime", "date",
    "time", "datetime2", "smalldatetime", "bit", "uniqueidentifier",
  ];

  let selectParts = [`COUNT(*) AS totalRows`, `${monthColumn} AS DataMonth`];
  columns.forEach((colObj) => {
    const colName = colObj.COLUMN_NAME;
    const dataType = (colObj.DATA_TYPE || "").toLowerCase();
    const escapedCol = `[${colName.replace(/]/g, "]]")}]`;
    if (numericDateTypes.includes(dataType)) {
      selectParts.push(`SUM(CASE WHEN ${escapedCol} IS NOT NULL AND ${escapedCol} <> 0 THEN 1 ELSE 0 END) AS [${colName}_filled]`);
      selectParts.push(`SUM(CASE WHEN ${escapedCol} IS NULL THEN 1 ELSE 0 END) AS [${colName}_empty]`);
      selectParts.push(`SUM(CASE WHEN ${escapedCol} = 0 THEN 1 ELSE 0 END) AS [${colName}_zeros]`);
    } else {
      const castCol = `UPPER(LTRIM(RTRIM(CAST(${escapedCol} AS NVARCHAR(255)))))`;
      const emptyValues = `'', 'NA', 'N/A', 'N-A', 'NO DISPONIBLE', 'NN', 'NO DEFINIDO', 'NO DECLARADO'`;
      const zeroValues = `'0', '0.0', '0.00', '0.000'`;
      selectParts.push(`SUM(CASE WHEN ${escapedCol} IS NOT NULL AND ${castCol} NOT IN (${emptyValues}) AND ${castCol} NOT IN (${zeroValues}) THEN 1 ELSE 0 END) AS [${colName}_filled]`);
      selectParts.push(`SUM(CASE WHEN ${escapedCol} IS NULL OR ${castCol} IN (${emptyValues}) THEN 1 ELSE 0 END) AS [${colName}_empty]`);
      selectParts.push(`SUM(CASE WHEN ${castCol} IN (${zeroValues}) THEN 1 ELSE 0 END) AS [${colName}_zeros]`);
    }
  });

  const request = pool.request();
  request.timeout = 300000;
  const dataResult = await request.query(`
    USE ${quoteSqlIdentifier(databaseName)};
    SELECT ${selectParts.join(", ")}
    FROM ${quoteSqlIdentifier(tableName)}
    WHERE ${monthColumn} IN (${pendingMonths.join(",")})
    GROUP BY ${monthColumn}
  `);

  await pool
    .request()
    .input("tableName", sql.NVarChar, tableName)
    .query(`
      USE ${quoteSqlIdentifier(databaseName)}; 
      DELETE FROM VRT_ValidationSummary 
      WHERE TableName = @tableName AND DataMonth IN (${pendingMonths.join(",")})
    `);

  const insertValues = [];
  for (const row of dataResult.recordset) {
    const dMonth = row.DataMonth;
    const tRows = row.totalRows;
    for (const colObj of columns) {
      const colName = colObj.COLUMN_NAME;
      insertValues.push(
        `('${tableName}', ${dMonth}, '${colName.replace(/'/g, "''")}', ${tRows}, ${row[`${colName}_filled`] || 0}, ${row[`${colName}_empty`] || 0}, ${row[`${colName}_zeros`] || 0})`
      );
    }
  }

  if (insertValues.length > 0) {
    const chunkSize = 1000;
    for (let i = 0; i < insertValues.length; i += chunkSize) {
      const chunk = insertValues.slice(i, i + chunkSize);
      await pool.request().query(`
        USE ${quoteSqlIdentifier(databaseName)};
        INSERT INTO VRT_ValidationSummary (TableName, DataMonth, ColumnName, TotalRows, FilledCount, EmptyCount, ZeroCount)
        VALUES ${chunk.join(",")}
      `);
    }
  }

  return { success: true };
};

export const getValidationData = async (databaseName, tableName, month) => {
  await assertDatabaseExists(databaseName);
  assertNonEmptyString(tableName);
  const pool = await getPool();
  const result = await pool
    .request()
    .input("tableName", sql.NVarChar, tableName)
    .input("month", sql.Int, parseInt(month))
    .query(`
      USE ${quoteSqlIdentifier(databaseName)};
      SELECT ColumnName, TotalRows, FilledCount, EmptyCount, ZeroCount
      FROM VRT_ValidationSummary
      WHERE TableName = @tableName AND DataMonth = @month
    `);

  if (!result.recordset || result.recordset.length === 0) {
    return { totalRows: 0, columns: [], notLoaded: true };
  }

  return {
    totalRows: result.recordset[0].TotalRows,
    columns: result.recordset.map((row) => ({
      columnName: row.ColumnName,
      filled: row.FilledCount,
      empty: row.EmptyCount,
      zeros: row.ZeroCount,
    })),
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIONES DE DATOS — SERVIDOR DE PRODUCCIÓN (25.36.98.149)
// ─────────────────────────────────────────────────────────────────────────────
export const listProdColumns = async (tableName) => {
  const allowed = ["TempExportacion_PH", "TempImportacion_PH"];
  if (!allowed.includes(tableName)) {
    throw new Error("Tabla de producción no permitida.");
  }
  const pool = await getProdPool();
  const result = await pool
    .request()
    .input("tableName", sql.NVarChar, tableName)
    .query(`
      SELECT COLUMN_NAME AS columnName,
             DATA_TYPE AS dataType,
             CHARACTER_MAXIMUM_LENGTH AS characterMaximumLength
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = @tableName
      ORDER BY ORDINAL_POSITION
    `);
  return result.recordset;
};