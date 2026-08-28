const { Router } = require('express');

const atencionesRoutes = require('./atenciones.routes');
const indicadoresRoutes = require('./indicadores.routes');
const encuestasRoutes = require('./encuestas.routes');
const estudiantesRoutes = require('./estudiantes.routes');
const serviciosRoutes = require('./servicios.routes');

const router = Router();

router.use('/atenciones', atencionesRoutes);
router.use('/indicadores', indicadoresRoutes);
router.use('/encuestas', encuestasRoutes);
router.use('/estudiantes', estudiantesRoutes);
router.use('/servicios', serviciosRoutes);

module.exports = router;
