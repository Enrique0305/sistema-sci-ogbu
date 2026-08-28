const { Router } = require('express');
const { body, query: queryValidator } = require('express-validator');
const validate = require('../middleware/validate');
const { crearAtencion, listarAtenciones } = require('../controllers/atencionesController');

const router = Router();

router.post(
  '/',
  [
    body('codigo_estudiante')
      .trim()
      .notEmpty().withMessage('El codigo de estudiante es obligatorio')
      .isLength({ max: 20 }).withMessage('El codigo de estudiante es demasiado largo')
      .matches(/^[A-Za-z0-9]+$/).withMessage('El codigo de estudiante solo admite letras y numeros'),
    body('servicio_id')
      .notEmpty().withMessage('El servicio es obligatorio')
      .isInt({ min: 1 }).withMessage('El servicio_id debe ser un entero positivo')
      .toInt(),
    body('descripcion_motivo')
      .trim()
      .notEmpty().withMessage('El motivo de atencion es obligatorio')
      .isLength({ max: 2000 }).withMessage('El motivo de atencion es demasiado largo'),
    body('diagnostico_accion')
      .optional({ nullable: true, checkFalsy: true })
      .trim()
      .isLength({ max: 2000 }).withMessage('El diagnostico/accion es demasiado largo'),
    body('usuario_responsable_id')
      .notEmpty().withMessage('El usuario responsable es obligatorio')
      .isInt({ min: 1 }).withMessage('usuario_responsable_id debe ser un entero positivo')
      .toInt(),
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
    queryValidator('estado_atencion').optional().isIn(['En Proceso', 'Completado']),
    queryValidator('limite').optional().isInt({ min: 1, max: 200 }).toInt(),
    queryValidator('pagina').optional().isInt({ min: 1 }).toInt(),
  ],
  validate,
  listarAtenciones
);

module.exports = router;
