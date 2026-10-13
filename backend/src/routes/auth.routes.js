const { Router } = require('express');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const validate = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { login, logout, me, cambiarClave } = require('../controllers/authController');

const router = Router();

// Capa adicional contra fuerza bruta por IP (ademas del bloqueo por cuenta).
const limitadorLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Demasiados intentos. Intente nuevamente mas tarde.', codigo: 'DEMASIADOS_INTENTOS' },
});

router.post(
  '/login',
  limitadorLogin,
  [
    body('correo')
      .trim()
      .notEmpty().withMessage('El correo es obligatorio')
      .isLength({ max: 150 }).withMessage('Correo demasiado largo'),
    body('clave')
      .isString().withMessage('La clave es obligatoria')
      .notEmpty().withMessage('La clave es obligatoria')
      .isLength({ max: 128 }).withMessage('Clave demasiado larga'),
  ],
  validate,
  login
);

// Estos tres endpoints siguen disponibles aunque el usuario deba cambiar
// su clave (es justamente lo que tiene que poder hacer).
const sesion = requireAuth({ permitirCambioPendiente: true });

router.post('/logout', logout);
router.get('/me', sesion, me);
router.post(
  '/cambiar-clave',
  sesion,
  [
    body('clave_actual').isString().notEmpty().withMessage('La clave actual es obligatoria'),
    body('clave_nueva')
      .isString().withMessage('La clave nueva es obligatoria')
      .isLength({ max: 128 }).withMessage('Clave demasiado larga'),
  ],
  validate,
  cambiarClave
);

module.exports = router;
