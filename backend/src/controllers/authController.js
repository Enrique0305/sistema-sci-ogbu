const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const {
  hashPassword,
  verifyPassword,
  verificarContraRelleno,
  validarPolitica,
} = require('../utils/password');
const { crearSesion, destruirSesion } = require('../middleware/auth');

const MAX_INTENTOS = 5;
const BLOQUEO_MINUTOS = 15;

async function usuarioPublico(usuarioId) {
  const { rows } = await query(
    `SELECT u.usuario_id, u.nombres, u.apellidos, u.correo_institucional AS correo,
            u.rol_sistema, u.cargo, u.unidad_id, un.nombre AS unidad_nombre,
            u.debe_cambiar_clave
       FROM usuarios_responsables u
       LEFT JOIN unidades un ON un.unidad_id = u.unidad_id
      WHERE u.usuario_id = ?`,
    [usuarioId]
  );
  const u = rows[0];
  return u ? { ...u, debe_cambiar_clave: Boolean(u.debe_cambiar_clave) } : null;
}

// POST /api/auth/login   { correo, clave }
// Mensaje generico ante cualquier fallo de credenciales (no revela si el
// correo existe). Tras 5 fallos consecutivos la cuenta se bloquea 15 minutos.
const login = asyncHandler(async (req, res) => {
  const correo = String(req.body.correo).trim().toLowerCase();
  const clave = String(req.body.clave);

  const credencialesInvalidas = () =>
    res.status(401).json({
      ok: false,
      error: 'Correo o clave incorrectos',
      codigo: 'CREDENCIALES_INVALIDAS',
    });

  const { rows } = await query(
    `SELECT usuario_id, password_hash, estado, intentos_fallidos,
            (bloqueado_hasta IS NOT NULL AND bloqueado_hasta > NOW()) AS bloqueado,
            GREATEST(1, CEIL(TIMESTAMPDIFF(SECOND, NOW(), bloqueado_hasta) / 60)) AS minutos_bloqueo
       FROM usuarios_responsables
      WHERE correo_institucional = ?`,
    [correo]
  );
  const u = rows[0];

  if (!u || !u.estado || !u.password_hash) {
    await verificarContraRelleno(clave);
    return credencialesInvalidas();
  }

  if (u.bloqueado) {
    return res.status(423).json({
      ok: false,
      error: `Cuenta bloqueada temporalmente por intentos fallidos. Intente de nuevo en ${u.minutos_bloqueo} minuto(s).`,
      codigo: 'CUENTA_BLOQUEADA',
    });
  }

  const valida = await verifyPassword(clave, u.password_hash);
  if (!valida) {
    const intentos = u.intentos_fallidos + 1;
    if (intentos >= MAX_INTENTOS) {
      await query(
        `UPDATE usuarios_responsables
            SET intentos_fallidos = 0, bloqueado_hasta = DATE_ADD(NOW(), INTERVAL ? MINUTE)
          WHERE usuario_id = ?`,
        [BLOQUEO_MINUTOS, u.usuario_id]
      );
    } else {
      await query(`UPDATE usuarios_responsables SET intentos_fallidos = ? WHERE usuario_id = ?`, [
        intentos,
        u.usuario_id,
      ]);
    }
    return credencialesInvalidas();
  }

  await query(
    `UPDATE usuarios_responsables
        SET intentos_fallidos = 0, bloqueado_hasta = NULL, ultimo_acceso = NOW()
      WHERE usuario_id = ?`,
    [u.usuario_id]
  );
  await crearSesion(req, res, u.usuario_id);

  res.json({ ok: true, usuario: await usuarioPublico(u.usuario_id) });
});

// POST /api/auth/logout
const logout = asyncHandler(async (req, res) => {
  await destruirSesion(req, res);
  res.json({ ok: true });
});

// GET /api/auth/me
const me = asyncHandler(async (req, res) => {
  res.json({ ok: true, usuario: await usuarioPublico(req.user.usuario_id) });
});

// POST /api/auth/cambiar-clave   { clave_actual, clave_nueva }
// Invalida las demas sesiones del usuario (conserva la actual).
const cambiarClave = asyncHandler(async (req, res) => {
  const { clave_actual, clave_nueva } = req.body;

  const { rows } = await query(
    `SELECT password_hash FROM usuarios_responsables WHERE usuario_id = ?`,
    [req.user.usuario_id]
  );
  const vigente = await verifyPassword(String(clave_actual), rows[0] && rows[0].password_hash);
  if (!vigente) {
    return res
      .status(400)
      .json({ ok: false, error: 'La clave actual es incorrecta', codigo: 'CLAVE_ACTUAL_INCORRECTA' });
  }

  const errorPolitica = validarPolitica(String(clave_nueva));
  if (errorPolitica) {
    return res.status(400).json({ ok: false, error: errorPolitica, codigo: 'CLAVE_DEBIL' });
  }
  if (clave_nueva === clave_actual) {
    return res
      .status(400)
      .json({ ok: false, error: 'La clave nueva debe ser distinta de la actual', codigo: 'CLAVE_REPETIDA' });
  }

  const hash = await hashPassword(String(clave_nueva));
  await query(
    `UPDATE usuarios_responsables
        SET password_hash = ?, debe_cambiar_clave = 0, clave_actualizada_en = NOW(),
            intentos_fallidos = 0, bloqueado_hasta = NULL
      WHERE usuario_id = ?`,
    [hash, req.user.usuario_id]
  );
  await query(`DELETE FROM sesiones WHERE usuario_id = ? AND sesion_id <> ?`, [
    req.user.usuario_id,
    req.user.sesion_id,
  ]);

  res.json({ ok: true, usuario: await usuarioPublico(req.user.usuario_id) });
});

module.exports = { login, logout, me, cambiarClave };
