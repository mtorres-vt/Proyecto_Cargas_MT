import { getPool } from "./src/db.js";

async function clearCache() {
  try {
    const pool = await getPool();
    // Ejecutamos un comando global que busca la tabla de caché en todas las bases
    // de datos y la elimina, para forzar que la próxima vez se cree y calcule de cero.
    const result = await pool.request().query(`
      EXEC sp_MSforeachdb '
        IF EXISTS (SELECT 1 FROM [?].sys.tables WHERE name = ''VRT_ValidationSummary'')
        BEGIN
          USE [?];
          DROP TABLE VRT_ValidationSummary;
        END
      '
    `);
    console.log("Caché de validaciones limpiado correctamente en todas las bases de datos.");
    process.exit(0);
  } catch (error) {
    console.error("Error limpiando caché:", error);
    process.exit(1);
  }
}

clearCache();
