const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

function rangoPorDefecto(fecha_inicio, fecha_fin) {
  const fin = fecha_fin || new Date().toISOString().slice(0, 10);
  const inicioDate = fecha_inicio
    ? new Date(fecha_inicio)
    : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const inicio = fecha_inicio || inicioDate.toISOString().slice(0, 10);
  return { inicio, fin };
}

// GET /api/indicadores/dashboard
// Calcula los indicadores de gestion del SCI:
//   - ICA (Indicador de Cobertura de Atenciones): total de atenciones por
//     servicio dentro de un rango de fechas.
//   - ISE (Indice de Satisfaccion Estudiantil): promedio de respuestas
//     Likert (1-5) agrupado por servicio y trimestre.
const dashboard = asyncHandler(async (req, res) => {
  const { fecha_inicio, fecha_fin, servicio_id } = req.query;
  const { inicio, fin } = rangoPorDefecto(fecha_inicio, fecha_fin);

  const filtroServicio = servicio_id ? 'AND s.servicio_id = ?' : '';
  const valoresICA = [inicio, `${fin} 23:59:59`];
  if (servicio_id) valoresICA.push(servicio_id);

  const icaSql = `
    SELECT s.servicio_id, s.nombre_servicio, COUNT(a.atencion_id) AS total_atenciones
      FROM servicios_ogbu s
      LEFT JOIN atenciones a
        ON a.servicio_id = s.servicio_id
       AND a.fecha_atencion BETWEEN ? AND ?
     WHERE s.estado = 'Activo' ${filtroServicio}
     GROUP BY s.servicio_id, s.nombre_servicio
     ORDER BY s.nombre_servicio`;
  const { rows: ica } = await query(icaSql, valoresICA);

  const filtroServicioIse = servicio_id ? 'AND s.servicio_id = ?' : '';
  const valoresISE = servicio_id ? [servicio_id] : [];

  const iseSql = `
    SELECT s.servicio_id, s.nombre_servicio, t.trimestre_id, t.anio, t.periodo_trimestre,
           ROUND(AVG(CAST(re.valor_respuesta AS DECIMAL(10,2))), 2) AS promedio_satisfaccion,
           COUNT(re.respuesta_id) AS total_respuestas
      FROM respuestas_encuesta re
      JOIN preguntas_encuesta pe ON pe.pregunta_id = re.pregunta_id
      JOIN servicios_ogbu s ON s.servicio_id = pe.servicio_id
      JOIN trimestres t ON t.trimestre_id = pe.trimestre_id
     WHERE pe.tipo_respuesta = 'Likert_1_5' ${filtroServicioIse}
     GROUP BY s.servicio_id, s.nombre_servicio, t.trimestre_id, t.anio, t.periodo_trimestre
     ORDER BY t.anio DESC, t.periodo_trimestre DESC, s.nombre_servicio`;
  const { rows: ise } = await query(iseSql, valoresISE);

  const totalAtenciones = ica.reduce((acc, row) => acc + Number(row.total_atenciones), 0);
  const promedioGeneral = ise.length
    ? Math.round(
        (ise.reduce((acc, row) => acc + Number(row.promedio_satisfaccion) * Number(row.total_respuestas), 0) /
          ise.reduce((acc, row) => acc + Number(row.total_respuestas), 0)) *
          100
      ) / 100
    : null;

  res.json({
    ok: true,
    rango: { fecha_inicio: inicio, fecha_fin: fin },
    kpis: {
      total_atenciones: totalAtenciones,
      promedio_satisfaccion_general: promedioGeneral,
    },
    indicador_cobertura_atenciones: ica,
    indice_satisfaccion_estudiantil: ise,
  });
});

module.exports = { dashboard };
