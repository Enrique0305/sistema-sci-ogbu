const { Router } = require('express');
const { listarActivos } = require('../controllers/serviciosController');

const router = Router();

router.get('/', listarActivos);

module.exports = router;
