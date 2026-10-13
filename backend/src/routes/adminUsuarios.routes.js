const { Router } = require('express');
const { body, param, query: queryValidator } = require('express-validator');
const validate = require('../middleware/validate');
const {
  listar,
  crear,
  actualizar,
  resetClave,
  desbloquear,
} = require('../controllers/adminUsuariosController');

const router = Router();

const ROLES = ['Administrador', 'Operador', 'Consulta'];
const idParam = param('id').isInt({ min: 1 }).withMessage('id invalido').toInt();

router.get(
  '/',
  [
    queryValidator('q').optional().trim().isLength({ max: 100 }),
    queryValidator('rol_sistema').optional().isIn(ROLES),
    queryValidator('unidad_id').optional().isInt({ min: 1 }).toInt(),
    queryValidator('estado').optional().isIn(['0', '1']),
  ],
  validate,
  listar
);

router.post(
  '/',
  [
    body('nombres').trim().notEmpty().withMessage('Los nombres son obligatorios').isLength({ max: 100 }),
    body('apellidos').trim().notEmpty().withMessage('Los apellidos son obligatorios').isLength({ max: 100 }),
    body('correo')
      .trim()
      .isEmail().withMessage('Correo invalido')
      .isLength({ max: 150 }).withMessage('Correo demasiado largo'),
    body('rol_sistema').isIn(ROLES).withMessage('Rol invalido'),
    body('unidad_id').optional({ nullable: true, checkFalsy: true }).isInt({ min: 1 }).toInt(),
    body('cargo').optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 80 }),
  ],
  validate,
  crear
);

router.patch(
  '/:id',
  [
    idParam,
    body('nombres').optional().trim().notEmpty().isLength({ max: 100 }),
    body('apellidos').optional().trim().notEmpty().isLength({ max: 100 }),
    body('rol_sistema').optional().isIn(ROLES).withMessage('Rol invalido'),
    body('unidad_id').optional({ nullable: true }).custom((v) => v === null || v === '' || Number.isInteger(Number(v)) && Number(v) > 0)
      .withMessage('unidad_id invalido'),
    body('cargo').optional({ nullable: true }).trim().isLength({ max: 80 }),
    body('estado').optional().isBoolean().withMessage('estado invalido').toBoolean(),
  ],
  validate,
  actualizar
);

router.post('/:id/reset-clave', [idParam], validate, resetClave);
router.post('/:id/desbloquear', [idParam], validate, desbloquear);

module.exports = router;
