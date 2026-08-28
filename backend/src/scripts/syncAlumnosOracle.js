// Script CLI para sincronizar la poblacion vigente de alumnos desde
// Oracle SUM (vista OBIENESTAR.ALUMNO) hacia la tabla local `estudiantes`.
//
// Uso:
//   npm run sync:alumnos
//
// Pensado para ejecucion manual o via cron por quien administra el
// servidor. No se expone como endpoint HTTP porque el proyecto aun no
// tiene autenticacion de usuarios (ver README, seccion "Integracion con
// Oracle SUM").
//
// Este script nunca imprime ORACLE_PASSWORD ni ORACLE_WALLET_PASSWORD.
require('dotenv').config();

const { sincronizarAlumnos } = require('../integrations/oracleSum/sincronizarAlumnos');
const oracle = require('../config/oracle');
const { pool: mysqlPool } = require('../config/db');

async function main() {
  console.log('Sincronizacion Oracle SUM -> estudiantes (MySQL)');
  console.log('Iniciando...');

  const inicio = Date.now();
  const reporte = await sincronizarAlumnos();
  const segundos = ((Date.now() - inicio) / 1000).toFixed(1);

  console.log('');
  console.log('Periodos vigentes utilizados:', reporte.periodos_usados.join(', '));
  console.log('Filas leidas de Oracle:      ', reporte.total_leidos);
  console.log('Insertados/actualizados:     ', reporte.insertados_o_actualizados);
  console.log('Omitidos:                    ', reporte.omitidos.length);

  if (reporte.omitidos.length > 0) {
    console.log('');
    console.log('Detalle de filas omitidas (revisar manualmente):');
    for (const omitido of reporte.omitidos) {
      console.log(`  - ${omitido.codigo_matricula || '(sin codigo)'}: ${omitido.motivo}`);
    }
  }

  console.log('');
  console.log(`Listo en ${segundos}s.`);
}

async function cerrarConexiones() {
  await oracle.closePool().catch(() => {});
  await mysqlPool.end().catch(() => {});
}

main()
  .then(async () => {
    await cerrarConexiones();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('');
    console.error('La sincronizacion fallo:', err.message);
    await cerrarConexiones();
    process.exit(1);
  });
