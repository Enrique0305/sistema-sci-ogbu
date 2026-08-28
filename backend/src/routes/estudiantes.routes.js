const { Router } = require('express');
const { param } = require('express-validator');
const validate = require('../middleware/validate');
const { buscarPorCodigo } = require('../controllers/estudiantesController');

const router = Router();

router.get(
  '/:codigo',
  [
    param('codigo')
      .trim()
      .isLength({ min: 1, max: 20 })
      .matches(/^[A-Za-z0-9]+$/).withMessage('Codigo de estudiante invalido'),
  ],
  validate,
  buscarPorCodigo
);

module.exports = router;
