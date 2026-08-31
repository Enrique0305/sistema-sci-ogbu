const { Router } = require('express');
const { body, param, query: queryValidator } = require('express-validator');
const validate = require('../middleware/validate');
const {
  crearAtencion,
  listarAtenciones,
  obtenerAtencion,
  cambiarEstado,
} = require('../controllers/atencionesController');
const { ESTADOS } = require('../utils/estadoAtencion');

const router = Router();

const PRIORIDADES = ['Baja', 'Media', 'Alta'];

router.post(
  '/',
  [
    body('codigo_estudiante')
      .optional({ nullable: true, checkFalsy: true })
      .trim()
      .isLength({ max: 20 }).withMessage('El codigo de estudiante es demasiado largo')
      .matches(/^[A-Za-z0-9]+$/).withMessage('El codigo de estudiante solo admite letras y numeros'),
    body('solicitante_desc')
      .optional({ nullable: true, checkFalsy: true })
      .trim()
      .isLength({ max: 200 }).withMessage('La descripcion del solicitante es demasiado larga'),
    body('servicio_id')
      .notEmpty().withMessage('El servicio es obligatorio')
      .isInt({ min: 1 }).withMessage('El servicio_id debe ser un entero positivo')
      .toInt(),
    body('unidad_id')
      .notEmpty().withMessage('La unidad responsable es obligatoria')
      .isInt({ min: 1 }).withMessage('El unidad_id debe ser un entero positivo')
      .toInt(),
    body('categoria_id')
      .optional({ nullable: true, checkFalsy: true })
      .isInt({ min: 1 }).withMessage('El categoria_id debe ser un entero positivo')
      .toInt(),
    body('descripcion_motivo')
      .trim()
      .notEmpty().withMessage('El motivo de atencion es obligatorio')
      .isLength({ max: 2000 }).withMessage('El motivo de atencion es demasiado largo'),
    body('diagnostico_accion')
      .optional({ nullable: true, checkFalsy: true })
      .trim()
      .isLength({ max: 2000 }).withMessage('El diagnostico/accion es demasiado largo'),
    body('accion_id')
      .optional({ nullable: true, checkFalsy: true })
      .isInt({ min: 1 }).withMessage('El accion_id debe ser un entero positivo')
      .toInt(),
    body('usuario_responsable_id')
      .optional({ nullable: true, checkFalsy: true })
      .isInt({ min: 1 }).withMessage('usuario_responsable_id debe ser un entero positivo')
      .toInt(),
    body('prioridad')
      .optional({ nullable: true, checkFalsy: true })
      .isIn(PRIORIDADES).withMessage('Prioridad invalida'),
  ],
  validate,
  crearAtencion
);

router.get(
  '/',
  [
    queryValidator('fecha_inicio').optional().isISO8601().withMessage('fecha_inicio invalida'),
    queryValidator('fecha_fin').optional().isISO8601().withMessage('fecha_fin invalida'),
    queryValidator('servicio_id').optional().isInt({ min: 1 }).toInt(),
    queryValidator('unidad_id').optional().isInt({ min: 1 }).toInt(),
    queryValidator('categoria_id').optional().isInt({ min: 1 }).toInt(),
    queryValidator('estado_atencion').optional().isIn(ESTADOS),
    queryValidator('prioridad').optional().isIn(PRIORIDADES),
    queryValidator('solo_reincidentes').optional().isBoolean(),
    queryValidator('limite').optional().isInt({ min: 1, max: 200 }).toInt(),
    queryValidator('pagina').optional().isInt({ min: 1 }).toInt(),
  ],
  validate,
  listarAtenciones
);

router.get(
  '/:id',
  [param('id').isInt({ min: 1 }).withMessage('id invalido').toInt()],
  validate,
  obtenerAtencion
);

router.patch(
  '/:id/estado',
  [
    param('id').isInt({ min: 1 }).withMessage('id invalido').toInt(),
    body('estado_nuevo')
      .notEmpty().withMessage('estado_nuevo es obligatorio')
      .isIn(ESTADOS).withMessage('estado_nuevo invalido'),
    body('comentario')
      .optional({ nullable: true, checkFalsy: true })
      .trim()
      .isLength({ max: 600 }).withMessage('El comentario es demasiado largo'),
    body('unidad_derivada_id').optional({ nullable: true, checkFalsy: true }).isInt({ min: 1 }).toInt(),
    body('unidad_id').optional({ nullable: true, checkFalsy: true }).isInt({ min: 1 }).toInt(),
    body('usuario_responsable_id').optional({ nullable: true, checkFalsy: true }).isInt({ min: 1 }).toInt(),
  ],
  validate,
  cambiarEstado
);

module.exports = router;
