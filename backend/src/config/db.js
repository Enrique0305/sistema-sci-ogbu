// Pool de conexiones a MySQL. Todas las consultas de la aplicacion deben
// pasar por este pool y usar SIEMPRE placeholders (?) para evitar
// inyeccion SQL. Nunca concatenar valores de entrada del usuario
// directamente en el texto de la consulta.
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  waitForConnections: true,
  connectionLimit: 10,
  connectTimeout: 5000,
  decimalNumbers: true,
});

/**
 * Ejecuta una consulta parametrizada contra el pool.
 * @param {string} text - Consulta SQL con placeholders (?)
 * @param {Array} params - Valores para los placeholders
 * @returns {Promise<{rows: Array}>} - Forma compatible con el resto del codigo
 */
async function query(text, params) {
  const [rows] = await pool.query(text, params);
  return { rows };
}

/**
 * Obtiene una conexion dedicada del pool para ejecutar transacciones
 * (beginTransaction / commit / rollback). El llamador es responsable de
 * invocar connection.release() al finalizar.
 */
async function getClient() {
  const connection = await pool.getConnection();
  return {
    query: async (text, params) => {
      const [rows] = await connection.query(text, params);
      return { rows };
    },
    beginTransaction: () => connection.beginTransaction(),
    commit: () => connection.commit(),
    rollback: () => connection.rollback(),
    release: () => connection.release(),
  };
}

module.exports = { pool, query, getClient };
