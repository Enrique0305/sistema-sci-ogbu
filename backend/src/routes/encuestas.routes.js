const { Router } = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { responder } = require('../controllers/encuestasController');

const router = Router();

router.post(
  '/responder',
  [
    body('respuestas')
      .isArray({ min: 1, max: 50 }).withMessage('respuestas debe ser un arreglo con al menos 1 elemento'),
    body('respuestas.*.pregunta_id')
      .isInt({ min: 1 }).withMessage('pregunta_id debe ser un entero positivo')
      .toInt(),
    body('respuestas.*.atencion_id')
      .optional({ nullable: true })
      .isInt({ min: 1 }).withMessage('atencion_id debe ser un entero positivo')
      .toInt(),
    body('respuestas.*.valor_respuesta')
      .trim()
      .notEmpty().withMessage('valor_respuesta es obligatorio')
      .isLength({ max: 500 }).withMessage('valor_respuesta es demasiado largo'),
  ],
  validate,
  responder
);

module.exports = router;
