const { Router } = require('express');
const { query: queryValidator } = require('express-validator');
const validate = require('../middleware/validate');
const { listarCategorias, listarAcciones } = require('../controllers/catalogosController');

const categoriasRouter = Router();
categoriasRouter.get(
  '/',
  [queryValidator('servicio_id').optional().isInt({ min: 1 }).toInt()],
  validate,
  listarCategorias
);

const accionesRouter = Router();
accionesRouter.get(
  '/',
  [queryValidator('servicio_id').optional().isInt({ min: 1 }).toInt()],
  validate,
  listarAcciones
);

module.exports = { categoriasRouter, accionesRouter };
