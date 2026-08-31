const { Router } = require('express');
const { query: queryValidator } = require('express-validator');
const validate = require('../middleware/validate');
const { listar } = require('../controllers/unidadesController');

const router = Router();

router.get(
  '/',
  [
    queryValidator('servicio_id').optional().isInt({ min: 1 }).toInt(),
    queryValidator('tipo').optional().isIn(['Atencion', 'Soporte', 'Direccion']),
  ],
  validate,
  listar
);

module.exports = router;
