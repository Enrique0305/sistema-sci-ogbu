require('dotenv').config();
const app = require('./app');
const { asegurarTrimestre } = require('./utils/trimestres');

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Sistema SCI-OGBU backend escuchando en http://localhost:${PORT}`);
  // Deja listo el trimestre vigente de la encuesta desde el arranque; ademas
  // se vuelve a asegurar al registrar cada atencion.
  asegurarTrimestre().catch((err) =>
    console.error('[trimestres] No se pudo asegurar el trimestre vigente:', err.message)
  );
});
