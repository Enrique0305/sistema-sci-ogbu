const { Router } = require('express');
const { query: queryValidator } = require('express-validator');
const validate = require('../middleware/validate');
const { dashboard } = require('../controllers/indicadoresController');

const router = Router();

router.get(
  '/dashboard',
  [
    queryValidator('fecha_inicio').optional().isISO8601().withMessage('fecha_inicio invalida'),
    queryValidator('fecha_fin').optional().isISO8601().withMessage('fecha_fin invalida'),
    queryValidator('servicio_id').optional().isInt({ min: 1 }).toInt(),
  ],
  validate,
  dashboard
);

module.exports = router;
