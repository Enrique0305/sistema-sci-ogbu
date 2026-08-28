// Pool de conexiones a Oracle (fuente institucional SUM).
//
// Soporta dos modos:
//  - Thin (por defecto, sin Instant Client): requiere que ewallet.pem NO
//    este cifrado, o pasar ORACLE_WALLET_PASSWORD si lo esta.
//  - Thick (si se define ORACLE_INSTANT_CLIENT_DIR): usa las librerias
//    nativas de Oracle Instant Client, que SI pueden leer cwallet.sso
//    (wallet de auto-login) sin necesitar ninguna contraseña de wallet.
//    Este es el modo usado en este proyecto porque el ewallet.pem
//    entregado esta cifrado y no se cuenta con esa contraseña.
//
// IMPORTANTE: este modulo se importa unicamente desde
// src/integrations/oracleSum/*. El servidor HTTP principal (app.js /
// server.js) nunca lo importa ni inicializa el pool en el arranque, para
// que si Oracle no esta disponible el resto de la API (atenciones,
// indicadores, encuestas) siga funcionando con normalidad.
//
// Conexion de SOLO LECTURA: ningun modulo de esta capa debe ejecutar
// INSERT/UPDATE/DELETE contra Oracle.
const oracledb = require('oracledb');

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

let pool = null;
let clienteNativoInicializado = false;

function validarConfiguracion() {
  const faltantes = ['ORACLE_USER', 'ORACLE_PASSWORD', 'ORACLE_DSN', 'ORACLE_WALLET_DIR'].filter(
    (clave) => !process.env[clave]
  );
  if (faltantes.length > 0) {
    throw new Error(
      `Configuracion de Oracle incompleta. Faltan las variables de entorno: ${faltantes.join(', ')}`
    );
  }
}

function usaModoThick() {
  return Boolean(process.env.ORACLE_INSTANT_CLIENT_DIR);
}

/**
 * Inicializa las librerias nativas de Oracle Instant Client (modo Thick)
 * una sola vez por proceso. oracledb.initOracleClient() lanza error si se
 * invoca mas de una vez, de ahi el guard.
 */
function inicializarClienteNativoSiAplica() {
  if (!usaModoThick() || clienteNativoInicializado) return;
  oracledb.initOracleClient({
    libDir: process.env.ORACLE_INSTANT_CLIENT_DIR,
    // Equivalente a TNS_ADMIN: aqui viven tnsnames.ora, sqlnet.ora y
    // cwallet.sso. El cliente nativo usa cwallet.sso (auto-login) para
    // la conexion TLS sin pedir password de wallet.
    configDir: process.env.ORACLE_WALLET_DIR,
  });
  clienteNativoInicializado = true;
}

/**
 * Crea el pool de Oracle la primera vez que se necesita (inicializacion
 * perezosa) y reutiliza la misma instancia en llamadas posteriores.
 * Nunca se debe invocar desde el arranque del servidor HTTP.
 */
async function getPool() {
  if (pool) return pool;

  validarConfiguracion();
  inicializarClienteNativoSiAplica();

  const configuracionPool = {
    user: process.env.ORACLE_USER,
    password: process.env.ORACLE_PASSWORD,
    connectString: process.env.ORACLE_DSN,
    poolMin: 0,
    poolMax: 4,
    poolTimeout: 60,
  };

  // Estos parametros de wallet solo aplican en modo Thin (PEM). En modo
  // Thick el wallet se resuelve via configDir + cwallet.sso, arriba.
  if (!usaModoThick()) {
    configuracionPool.configDir = process.env.ORACLE_WALLET_DIR;
    configuracionPool.walletLocation = process.env.ORACLE_WALLET_DIR;
    configuracionPool.walletPassword = process.env.ORACLE_WALLET_PASSWORD || undefined;
  }

  try {
    pool = await oracledb.createPool(configuracionPool);
    return pool;
  } catch (err) {
    // No se registra el error original tal cual: puede incluir el DSN o
    // detalles de conexion. Se registra solo el mensaje corto y se
    // relanza un error generico hacia el llamador.
    console.error('No se pudo crear el pool de Oracle:', err.message);
    throw new Error('No fue posible conectar con la fuente Oracle SUM. Verifique la configuracion.');
  }
}

/**
 * Ejecuta una consulta de SOLO LECTURA contra Oracle usando el pool.
 * @param {string} sql - Sentencia SQL (SELECT unicamente) con binds nombrados.
 * @param {object} binds - Binds nombrados (nunca concatenar valores en el SQL).
 */
async function query(sql, binds = {}) {
  const sqlNormalizado = sql.trim().toUpperCase();
  if (!sqlNormalizado.startsWith('SELECT') && !sqlNormalizado.startsWith('WITH')) {
    throw new Error('El modulo de integracion con Oracle SUM es de solo lectura: solo se permiten consultas SELECT.');
  }

  const conn = await (await getPool()).getConnection();
  try {
    const resultado = await conn.execute(sql, binds);
    return resultado.rows;
  } finally {
    await conn.close();
  }
}

async function closePool() {
  if (pool) {
    await pool.close(10);
    pool = null;
  }
}

module.exports = { getPool, query, closePool };
