const { Router } = require('express');
const { query: queryValidator } = require('express-validator');
const validate = require('../middleware/validate');
const { listarActivos } = require('../controllers/serviciosController');

const router = Router();

router.get(
  '/',
  [queryValidator('ambito').optional().isIn(['sci', 'todos'])],
  validate,
  listarActivos
);

module.exports = router;
