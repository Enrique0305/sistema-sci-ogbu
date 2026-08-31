const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const apiRoutes = require('./routes');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const app = express();

// Detras de un proxy inverso (nginx en el despliegue con Docker): confiar en
// el primer salto para que el rate limiting y los logs usen la IP real del
// cliente a partir de X-Forwarded-For.
app.set('trust proxy', 1);

// Seguridad: cabeceras HTTP endurecidas.
app.use(helmet());

// CORS restringido a los origenes configurados (frontend autorizado).
// CORS_ORIGIN="*" permite cualquier origen (util para una herramienta interna
// en LAN servida detras del proxy de nginx, donde las peticiones ya son del
// mismo origen). Con una lista separada por comas se restringe a esos origenes.
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
const origenesPermitidos =
  corsOrigin.trim() === '*'
    ? '*'
    : corsOrigin.split(',').map((o) => o.trim());
app.use(
  cors({
    origin: origenesPermitidos,
    methods: ['GET', 'POST', 'PATCH'],
  })
);

app.use(express.json({ limit: '100kb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Limite de peticiones para mitigar abuso/fuerza bruta sobre la API,
// mas estricto en los endpoints de escritura.
const limitadorGeneral = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
const limitadorEscritura = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });

app.use('/api', limitadorGeneral);
app.use(['/api/atenciones', '/api/encuestas'], (req, res, next) => {
  if (req.method === 'POST' || req.method === 'PATCH') return limitadorEscritura(req, res, next);
  next();
});

app.get('/api/health', (req, res) => res.json({ ok: true, servicio: 'sci-ogbu-backend' }));
app.use('/api', apiRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
