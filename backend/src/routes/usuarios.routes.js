const { Router } = require('express');
const { query: queryValidator } = require('express-validator');
const validate = require('../middleware/validate');
const { listar } = require('../controllers/usuariosController');

const router = Router();

router.get(
  '/',
  [queryValidator('unidad_id').optional().isInt({ min: 1 }).toInt()],
  validate,
  listar
);

module.exports = router;
