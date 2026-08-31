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
// Indicadores de gestion del SCI (solo servicios es_sci = 1):
//   - ICA  (Cobertura de Atenciones): conteo por servicio en un rango.
//   - ISE  (Satisfaccion Estudiantil): promedio Likert 1-5 por servicio/trimestre.
//   - Tiempo promedio de resolucion por servicio (indicador PAA-SMC): horas
//     entre fecha_atencion y fecha_resolucion/fecha_cierre.
// Ademas, metricas operativas de mesa de ayuda: distribucion de estados,
// atenciones por unidad y reincidencia.
const dashboard = asyncHandler(async (req, res) => {
  const { fecha_inicio, fecha_fin, servicio_id } = req.query;
  const { inicio, fin } = rangoPorDefecto(fecha_inicio, fecha_fin);
  const finTs = `${fin} 23:59:59`;

  // --- ICA: cobertura de atenciones por servicio SCI ---
  const filtroServicio = servicio_id ? 'AND s.servicio_id = ?' : '';
  const valoresICA = [inicio, finTs];
  if (servicio_id) valoresICA.push(servicio_id);

  const { rows: ica } = await query(
    `SELECT s.servicio_id, s.nombre_servicio, COUNT(a.atencion_id) AS total_atenciones
       FROM servicios_ogbu s
       LEFT JOIN atenciones a
         ON a.servicio_id = s.servicio_id
        AND a.fecha_atencion BETWEEN ? AND ?
      WHERE s.estado = 'Activo' AND s.es_sci = 1 ${filtroServicio}
      GROUP BY s.servicio_id, s.nombre_servicio
      ORDER BY s.nombre_servicio`,
    valoresICA
  );

  // --- Tiempo promedio de resolucion por servicio (horas) ---
  const valoresTiempo = [inicio, finTs];
  if (servicio_id) valoresTiempo.push(servicio_id);
  const { rows: tiempoResolucion } = await query(
    `SELECT s.servicio_id, s.nombre_servicio,
            ROUND(AVG(TIMESTAMPDIFF(HOUR, a.fecha_atencion, COALESCE(a.fecha_resolucion, a.fecha_cierre))), 1)
              AS horas_promedio,
            COUNT(a.atencion_id) AS atenciones_resueltas
       FROM servicios_ogbu s
       JOIN atenciones a ON a.servicio_id = s.servicio_id
      WHERE s.es_sci = 1
        AND a.fecha_atencion BETWEEN ? AND ?
        AND COALESCE(a.fecha_resolucion, a.fecha_cierre) IS NOT NULL
        ${servicio_id ? 'AND s.servicio_id = ?' : ''}
      GROUP BY s.servicio_id, s.nombre_servicio
      ORDER BY s.nombre_servicio`,
    valoresTiempo
  );

  // --- ISE: satisfaccion estudiantil por servicio y trimestre ---
  const filtroServicioIse = servicio_id ? 'AND s.servicio_id = ?' : '';
  const valoresISE = servicio_id ? [servicio_id] : [];
  const { rows: ise } = await query(
    `SELECT s.servicio_id, s.nombre_servicio, t.trimestre_id, t.anio, t.periodo_trimestre,
            ROUND(AVG(CAST(re.valor_respuesta AS DECIMAL(10,2))), 2) AS promedio_satisfaccion,
            COUNT(re.respuesta_id) AS total_respuestas
       FROM respuestas_encuesta re
       JOIN preguntas_encuesta pe ON pe.pregunta_id = re.pregunta_id
       JOIN servicios_ogbu s ON s.servicio_id = pe.servicio_id
       JOIN trimestres t ON t.trimestre_id = pe.trimestre_id
      WHERE pe.tipo_respuesta = 'Likert_1_5' AND s.es_sci = 1 ${filtroServicioIse}
      GROUP BY s.servicio_id, s.nombre_servicio, t.trimestre_id, t.anio, t.periodo_trimestre
      ORDER BY t.anio DESC, t.periodo_trimestre DESC, s.nombre_servicio`,
    valoresISE
  );

  // --- Distribucion de estados (todas las atenciones del rango) ---
  const valoresEstados = [inicio, finTs];
  if (servicio_id) valoresEstados.push(servicio_id);
  const { rows: distribucionEstados } = await query(
    `SELECT a.estado_atencion, COUNT(*) AS total
       FROM atenciones a
      WHERE a.fecha_atencion BETWEEN ? AND ?
        ${servicio_id ? 'AND a.servicio_id = ?' : ''}
      GROUP BY a.estado_atencion`,
    valoresEstados
  );

  // --- Atenciones por unidad ---
  const valoresUnidad = [inicio, finTs];
  if (servicio_id) valoresUnidad.push(servicio_id);
  const { rows: atencionesPorUnidad } = await query(
    `SELECT un.unidad_id, un.nombre AS unidad_nombre, COUNT(*) AS total,
            SUM(a.estado_atencion IN ('Registrada','En atencion','Derivada','Reabierta')) AS abiertas
       FROM atenciones a
       JOIN unidades un ON un.unidad_id = a.unidad_id
      WHERE a.fecha_atencion BETWEEN ? AND ?
        ${servicio_id ? 'AND a.servicio_id = ?' : ''}
      GROUP BY un.unidad_id, un.nombre
      ORDER BY total DESC`,
    valoresUnidad
  );

  // --- Reincidencia: % de atenciones marcadas como reincidentes + top categorias ---
  const valoresReinc = [inicio, finTs];
  if (servicio_id) valoresReinc.push(servicio_id);
  const { rows: reincRows } = await query(
    `SELECT COUNT(*) AS total_atenciones,
            SUM(a.atencion_origen_id IS NOT NULL) AS total_reincidentes
       FROM atenciones a
      WHERE a.fecha_atencion BETWEEN ? AND ?
        ${servicio_id ? 'AND a.servicio_id = ?' : ''}`,
    valoresReinc
  );
  const valoresTopCat = [inicio, finTs];
  if (servicio_id) valoresTopCat.push(servicio_id);
  const { rows: topCategoriasReincidentes } = await query(
    `SELECT c.categoria_id, c.nombre AS categoria_nombre, s.nombre_servicio,
            COUNT(*) AS total_reincidentes
       FROM atenciones a
       JOIN categorias_atencion c ON c.categoria_id = a.categoria_id
       JOIN servicios_ogbu s ON s.servicio_id = a.servicio_id
      WHERE a.atencion_origen_id IS NOT NULL
        AND a.fecha_atencion BETWEEN ? AND ?
        ${servicio_id ? 'AND a.servicio_id = ?' : ''}
      GROUP BY c.categoria_id, c.nombre, s.nombre_servicio
      ORDER BY total_reincidentes DESC
      LIMIT 10`,
    valoresTopCat
  );

  // --- Atenciones por categoria ---
  const valoresCat = [inicio, finTs];
  if (servicio_id) valoresCat.push(servicio_id);
  const { rows: atencionesPorCategoria } = await query(
    `SELECT c.categoria_id, c.nombre AS categoria_nombre, s.nombre_servicio, COUNT(*) AS total
       FROM atenciones a
       JOIN categorias_atencion c ON c.categoria_id = a.categoria_id
       JOIN servicios_ogbu s ON s.servicio_id = a.servicio_id
      WHERE a.fecha_atencion BETWEEN ? AND ?
        ${servicio_id ? 'AND a.servicio_id = ?' : ''}
      GROUP BY c.categoria_id, c.nombre, s.nombre_servicio
      ORDER BY total DESC
      LIMIT 15`,
    valoresCat
  );

  const totalAtenciones = ica.reduce((acc, row) => acc + Number(row.total_atenciones), 0);
  const promedioGeneral = ise.length
    ? Math.round(
        (ise.reduce((acc, row) => acc + Number(row.promedio_satisfaccion) * Number(row.total_respuestas), 0) /
          ise.reduce((acc, row) => acc + Number(row.total_respuestas), 0)) *
          100
      ) / 100
    : null;

  const abiertas = distribucionEstados
    .filter((r) => ['Registrada', 'En atencion', 'Derivada', 'Reabierta'].includes(r.estado_atencion))
    .reduce((acc, r) => acc + Number(r.total), 0);

  const tiempoGlobal = tiempoResolucion.length
    ? Math.round(
        (tiempoResolucion.reduce((acc, r) => acc + Number(r.horas_promedio) * Number(r.atenciones_resueltas), 0) /
          tiempoResolucion.reduce((acc, r) => acc + Number(r.atenciones_resueltas), 0)) *
          10
      ) / 10
    : null;

  const totReinc = Number(reincRows[0]?.total_atenciones || 0);
  const totReincidentes = Number(reincRows[0]?.total_reincidentes || 0);

  res.json({
    ok: true,
    rango: { fecha_inicio: inicio, fecha_fin: fin },
    kpis: {
      total_atenciones: totalAtenciones,
      promedio_satisfaccion_general: promedioGeneral,
      tiempo_promedio_resolucion_horas: tiempoGlobal,
      atenciones_abiertas: abiertas,
      tasa_reincidencia: totReinc > 0 ? Math.round((totReincidentes / totReinc) * 1000) / 10 : 0,
    },
    indicador_cobertura_atenciones: ica,
    tiempo_promedio_resolucion: tiempoResolucion,
    indice_satisfaccion_estudiantil: ise,
    distribucion_estados: distribucionEstados,
    atenciones_por_unidad: atencionesPorUnidad,
    atenciones_por_categoria: atencionesPorCategoria,
    reincidencia: {
      total_atenciones: totReinc,
      total_reincidentes: totReincidentes,
      top_categorias: topCategoriasReincidentes,
    },
  });
});

module.exports = { dashboard };
