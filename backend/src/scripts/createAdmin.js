// Crea (o restablece) una cuenta de Administrador y le asigna una clave
// temporal que debera cambiar en su primer acceso.
//
// Uso:
//   docker compose run --rm backend npm run create:admin -- correo@unmsm.edu.pe "Nombres" "Apellidos"
//
// - Si el correo ya existe: lo promueve a Administrador, lo activa y le genera
//   una nueva clave temporal (cierra sus sesiones).
// - Si no existe: lo crea.
// Util para el primer acceso y como "puerta de recuperacion" si se pierde la
// clave del unico administrador. La clave temporal se imprime una sola vez.
require('dotenv').config();
const { query, pool } = require('../config/db');
const { hashPassword, generarClaveTemporal } = require('../utils/password');

async function main() {
  const [correoArg, nombresArg, apellidosArg] = process.argv.slice(2);

  if (!correoArg || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoArg)) {
    console.error('Uso: npm run create:admin -- correo@unmsm.edu.pe ["Nombres"] ["Apellidos"]');
    process.exit(1);
  }

  const correo = correoArg.trim().toLowerCase();
  const claveTemporal = generarClaveTemporal();
  const hash = await hashPassword(claveTemporal);

  const { rows } = await query(
    `SELECT usuario_id FROM usuarios_responsables WHERE correo_institucional = ?`,
    [correo]
  );

  let usuarioId;
  let accion;
  if (rows.length > 0) {
    usuarioId = rows[0].usuario_id;
    await query(
      `UPDATE usuarios_responsables
          SET rol_sistema = 'Administrador', estado = 1, password_hash = ?,
              debe_cambiar_clave = 1, intentos_fallidos = 0, bloqueado_hasta = NULL,
              clave_actualizada_en = NULL
        WHERE usuario_id = ?`,
      [hash, usuarioId]
    );
    await query(`DELETE FROM sesiones WHERE usuario_id = ?`, [usuarioId]);
    accion = 'actualizado';
  } else {
    const insert = await query(
      `INSERT INTO usuarios_responsables
          (nombres, apellidos, correo_institucional, password_hash, rol, rol_sistema,
           cargo, debe_cambiar_clave)
       VALUES (?, ?, ?, ?, 'Administrador', 'Administrador', 'Administrador del sistema', 1)`,
      [nombresArg || 'Administrador', apellidosArg || 'del Sistema', correo, hash]
    );
    usuarioId = insert.rows.insertId;
    accion = 'creado';
  }

  console.log('');
  console.log(`Administrador ${accion}: ${correo} (usuario_id ${usuarioId})`);
  console.log('Clave temporal (se muestra UNA sola vez):');
  console.log(`  ${claveTemporal}`);
  console.log('Debera cambiarla en su primer inicio de sesion.');
  console.log('');
}

main()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error('No se pudo crear el administrador:', err.message);
    await pool.end().catch(() => {});
    process.exit(1);
  });
