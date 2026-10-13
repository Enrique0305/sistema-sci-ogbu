const { Router } = require('express');
const { query: queryValidator } = require('express-validator');
const validate = require('../middleware/validate');
const {
  listarCategorias,
  listarAcciones,
  listarMotivos,
} = require('../controllers/catalogosController');

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

const motivosRouter = Router();
motivosRouter.get(
  '/',
  [
    queryValidator('servicio_id').optional().isInt({ min: 1 }).toInt(),
    queryValidator('categoria_id').optional().isInt({ min: 1 }).toInt(),
  ],
  validate,
  listarMotivos
);

module.exports = { categoriasRouter, accionesRouter, motivosRouter };
