const { Router } = require('express');

const authRoutes = require('./auth.routes');
const adminUsuariosRoutes = require('./adminUsuarios.routes');
const atencionesRoutes = require('./atenciones.routes');
const indicadoresRoutes = require('./indicadores.routes');
const encuestasRoutes = require('./encuestas.routes');
const estudiantesRoutes = require('./estudiantes.routes');
const serviciosRoutes = require('./servicios.routes');
const unidadesRoutes = require('./unidades.routes');
const usuariosRoutes = require('./usuarios.routes');
const { categoriasRouter, accionesRouter, motivosRouter } = require('./catalogos.routes');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = Router();

// Publico: login (y los endpoints de sesion, que se protegen internamente).
router.use('/auth', authRoutes);

// Todo lo demas exige sesion valida y clave vigente.
router.use(requireAuth());

// Roles: Administrador (todo + gestion de usuarios), Operador (registra y
// gestiona atenciones), Consulta (solo lectura de indicadores y listados).
const puedeOperar = requireRole('Administrador', 'Operador');

router.use('/admin/usuarios', requireRole('Administrador'), adminUsuariosRoutes);

router.use('/atenciones', atencionesRoutes); // permisos por metodo, dentro del router
router.use('/indicadores', indicadoresRoutes);
router.use('/encuestas', puedeOperar, encuestasRoutes);
router.use('/estudiantes', puedeOperar, estudiantesRoutes);
router.use('/servicios', serviciosRoutes);
router.use('/unidades', unidadesRoutes);
router.use('/usuarios', usuariosRoutes);
router.use('/categorias', categoriasRouter);
router.use('/acciones', accionesRouter);
router.use('/motivos', motivosRouter);

module.exports = router;
