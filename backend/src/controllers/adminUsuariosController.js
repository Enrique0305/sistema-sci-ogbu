const { query, getClient } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { hashPassword, generarClaveTemporal } = require('../utils/password');

// Administracion de usuarios del sistema (solo rol Administrador).
// Nunca se devuelve password_hash. Las claves temporales se generan en el
// servidor y se muestran UNA sola vez en la respuesta de creacion/reset.
// No hay borrado fisico: los usuarios con historial se desactivan.

const SELECT_USUARIO = `
  SELECT u.usuario_id, u.nombres, u.apellidos, u.correo_institucional AS correo,
         u.rol, u.rol_sistema, u.cargo, u.unidad_id, un.nombre AS unidad_nombre,
         u.estado, (u.password_hash IS NOT NULL) AS tiene_clave, u.debe_cambiar_clave,
         u.ultimo_acceso, u.creado_en,
         (u.bloqueado_hasta IS NOT NULL AND u.bloqueado_hasta > NOW()) AS bloqueado
    FROM usuarios_responsables u
    LEFT JOIN unidades un ON un.unidad_id = u.unidad_id`;

function normalizar(u) {
  return {
    ...u,
    estado: Boolean(u.estado),
    tiene_clave: Boolean(u.tiene_clave),
    debe_cambiar_clave: Boolean(u.debe_cambiar_clave),
    bloqueado: Boolean(u.bloqueado),
  };
}

async function obtener(id) {
  const { rows } = await query(`${SELECT_USUARIO} WHERE u.usuario_id = ?`, [id]);
  return rows[0] ? normalizar(rows[0]) : null;
}

// Cuantos administradores activos CON credenciales quedan, excluyendo a `idExcluido`.
async function otrosAdminsActivos(idExcluido) {
  const { rows } = await query(
    `SELECT COUNT(*) AS n FROM usuarios_responsables
      WHERE rol_sistema = 'Administrador' AND estado = 1
        AND password_hash IS NOT NULL AND usuario_id <> ?`,
    [idExcluido]
  );
  return Number(rows[0].n);
}

// GET /api/admin/usuarios?q=&rol_sistema=&unidad_id=&estado=
const listar = asyncHandler(async (req, res) => {
  const { q, rol_sistema, unidad_id, estado } = req.query;
  const condiciones = [];
  const valores = [];

  if (q) {
    condiciones.push(`(u.nombres LIKE ? OR u.apellidos LIKE ? OR u.correo_institucional LIKE ?)`);
    const patron = `%${q}%`;
    valores.push(patron, patron, patron);
  }
  if (rol_sistema) {
    condiciones.push(`u.rol_sistema = ?`);
    valores.push(rol_sistema);
  }
  if (unidad_id) {
    condiciones.push(`u.unidad_id = ?`);
    valores.push(unidad_id);
  }
  if (estado === '0' || estado === '1') {
    condiciones.push(`u.estado = ?`);
    valores.push(Number(estado));
  }

  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  const { rows } = await query(
    `${SELECT_USUARIO} ${where} ORDER BY u.estado DESC, u.apellidos, u.nombres LIMIT 500`,
    valores
  );
  res.json({ ok: true, total: rows.length, usuarios: rows.map(normalizar) });
});

// POST /api/admin/usuarios
const crear = asyncHandler(async (req, res) => {
  const { nombres, apellidos, correo, rol_sistema, unidad_id, cargo } = req.body;
  const correoNorm = String(correo).trim().toLowerCase();

  const { rows: existente } = await query(
    `SELECT usuario_id FROM usuarios_responsables WHERE correo_institucional = ?`,
    [correoNorm]
  );
  if (existente.length > 0) {
    return res.status(409).json({ ok: false, error: 'Ya existe un usuario con ese correo' });
  }

  if (unidad_id) {
    const { rows } = await query(`SELECT unidad_id FROM unidades WHERE unidad_id = ? AND estado = 1`, [unidad_id]);
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'La unidad indicada no existe o esta inactiva' });
    }
  }

  const claveTemporal = generarClaveTemporal();
  const hash = await hashPassword(claveTemporal);

  const insert = await query(
    `INSERT INTO usuarios_responsables
        (nombres, apellidos, correo_institucional, password_hash, rol, rol_sistema,
         unidad_id, cargo, debe_cambiar_clave)
     VALUES (?, ?, ?, ?, 'Operador', ?, ?, ?, 1)`,
    [nombres.trim(), apellidos.trim(), correoNorm, hash, rol_sistema, unidad_id || null, cargo || null]
  );

  res.status(201).json({
    ok: true,
    usuario: await obtener(insert.rows.insertId),
    clave_temporal: claveTemporal,
  });
});

// PATCH /api/admin/usuarios/:id
const actualizar = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const objetivo = await obtener(id);
  if (!objetivo) {
    return res.status(404).json({ ok: false, error: 'El usuario no existe' });
  }

  const { nombres, apellidos, rol_sistema, unidad_id, cargo, estado } = req.body;
  const esSiMismo = id === req.user.usuario_id;

  const cambiaRol = rol_sistema !== undefined && rol_sistema !== objetivo.rol_sistema;
  const cambiaEstado = estado !== undefined && Boolean(estado) !== objetivo.estado;

  if (esSiMismo && (cambiaRol || cambiaEstado)) {
    return res.status(409).json({
      ok: false,
      error: 'No puede cambiar su propio rol ni desactivar su propia cuenta',
    });
  }

  // Nunca dejar el sistema sin un administrador activo con credenciales.
  const dejaDeSerAdminActivo =
    objetivo.rol_sistema === 'Administrador' &&
    objetivo.estado &&
    ((cambiaRol && rol_sistema !== 'Administrador') || (cambiaEstado && !estado));
  if (dejaDeSerAdminActivo && (await otrosAdminsActivos(id)) === 0) {
    return res.status(409).json({
      ok: false,
      error: 'Debe existir al menos un administrador activo con credenciales',
    });
  }

  if (unidad_id) {
    const { rows } = await query(`SELECT unidad_id FROM unidades WHERE unidad_id = ? AND estado = 1`, [unidad_id]);
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'La unidad indicada no existe o esta inactiva' });
    }
  }

  const sets = [];
  const valores = [];
  if (nombres !== undefined) { sets.push('nombres = ?'); valores.push(nombres.trim()); }
  if (apellidos !== undefined) { sets.push('apellidos = ?'); valores.push(apellidos.trim()); }
  if (rol_sistema !== undefined) { sets.push('rol_sistema = ?'); valores.push(rol_sistema); }
  if (unidad_id !== undefined) { sets.push('unidad_id = ?'); valores.push(unidad_id || null); }
  if (cargo !== undefined) { sets.push('cargo = ?'); valores.push(cargo || null); }
  if (estado !== undefined) { sets.push('estado = ?'); valores.push(estado ? 1 : 0); }

  if (sets.length === 0) {
    return res.status(400).json({ ok: false, error: 'No se indico ningun campo a actualizar' });
  }

  valores.push(id);
  await query(`UPDATE usuarios_responsables SET ${sets.join(', ')} WHERE usuario_id = ?`, valores);

  if (cambiaEstado && !estado) {
    await query(`DELETE FROM sesiones WHERE usuario_id = ?`, [id]);
  }

  res.json({ ok: true, usuario: await obtener(id) });
});

// POST /api/admin/usuarios/:id/reset-clave
// Genera una clave temporal (se muestra una sola vez), obliga a cambiarla en
// el siguiente acceso, limpia bloqueos y cierra todas sus sesiones.
const resetClave = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const objetivo = await obtener(id);
  if (!objetivo) {
    return res.status(404).json({ ok: false, error: 'El usuario no existe' });
  }
  if (id === req.user.usuario_id) {
    return res.status(409).json({
      ok: false,
      error: 'Para cambiar su propia clave use la opcion "Cambiar clave" de su cuenta',
    });
  }
  if (!objetivo.estado) {
    return res.status(409).json({ ok: false, error: 'El usuario esta inactivo; activelo primero' });
  }

  const claveTemporal = generarClaveTemporal();
  const hash = await hashPassword(claveTemporal);

  const client = await getClient();
  try {
    await client.beginTransaction();
    await client.query(
      `UPDATE usuarios_responsables
          SET password_hash = ?, debe_cambiar_clave = 1, intentos_fallidos = 0,
              bloqueado_hasta = NULL, clave_actualizada_en = NULL
        WHERE usuario_id = ?`,
      [hash, id]
    );
    await client.query(`DELETE FROM sesiones WHERE usuario_id = ?`, [id]);
    await client.commit();
  } catch (err) {
    await client.rollback();
    throw err;
  } finally {
    client.release();
  }

  res.json({ ok: true, usuario: await obtener(id), clave_temporal: claveTemporal });
});

// POST /api/admin/usuarios/:id/desbloquear
const desbloquear = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const objetivo = await obtener(id);
  if (!objetivo) {
    return res.status(404).json({ ok: false, error: 'El usuario no existe' });
  }
  await query(
    `UPDATE usuarios_responsables SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE usuario_id = ?`,
    [id]
  );
  res.json({ ok: true, usuario: await obtener(id) });
});

module.exports = { listar, crear, actualizar, resetClave, desbloquear };
