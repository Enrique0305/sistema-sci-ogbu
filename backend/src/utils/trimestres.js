// Trimestres de la encuesta de satisfaccion: se crean solos.
//
// La encuesta solo se dispara si existe un trimestre vigente (fila de
// `trimestres` que contiene la fecha de hoy) con preguntas activas para el
// servicio. Antes los trimestres se cargaban a mano, de modo que al cambiar de
// trimestre la encuesta dejaba de aparecer y el ISE se quedaba sin datos.
//
// `asegurarTrimestre` garantiza, de forma idempotente y segura ante llamadas
// simultaneas, que:
//   1. exista el trimestre calendario que contiene la fecha (ene-mar, abr-jun,
//      jul-sep, oct-dic);
//   2. si ese trimestre no tiene NINGUNA pregunta, se copien las del trimestre
//      mas reciente que si las tenga. Si ya tiene preguntas (aunque esten
//      inactivas) no se toca: la edicion manual manda.
const { query, getClient } = require('../config/db');

const BLOQUEO = 'sci_ogbu_trimestres';

/**
 * @param {string|null} fecha - 'YYYY-MM-DD'; por defecto, la fecha actual de la
 *   base de datos. El parametro existe para poder probar cambios de trimestre.
 * @returns {Promise<{trimestre_id:number, creado:boolean, preguntas_copiadas:number}>}
 */
async function asegurarTrimestre(fecha = null) {
  // Camino rapido (el habitual): el trimestre existe y ya tiene preguntas.
  const { rows: previo } = await query(
    `SELECT t.trimestre_id,
            (SELECT COUNT(*) FROM preguntas_encuesta p WHERE p.trimestre_id = t.trimestre_id) AS n
       FROM trimestres t
      WHERE COALESCE(?, CURRENT_DATE) BETWEEN t.fecha_inicio AND t.fecha_fin
      LIMIT 1`,
    [fecha]
  );
  if (previo.length > 0 && previo[0].n > 0) {
    return { trimestre_id: previo[0].trimestre_id, creado: false, preguntas_copiadas: 0 };
  }

  const cliente = await getClient();
  let bloqueado = false;
  try {
    // Un solo proceso a la vez crea el trimestre; los demas esperan y luego
    // encuentran todo hecho. Un bloqueo con nombre evita los bloqueos de
    // intervalo (y los deadlocks) de operar sobre filas que aun no existen.
    const { rows: lock } = await cliente.query('SELECT GET_LOCK(?, 10) AS ok', [BLOQUEO]);
    if (lock[0].ok !== 1) throw new Error('No se obtuvo el bloqueo para crear el trimestre');
    bloqueado = true;

    await cliente.beginTransaction();

    // 1. Crear el trimestre calendario si no existe.
    let trimestreId;
    let creado = false;
    const { rows: existente } = await cliente.query(
      `SELECT trimestre_id FROM trimestres
        WHERE anio = YEAR(COALESCE(?, CURRENT_DATE))
          AND periodo_trimestre = QUARTER(COALESCE(?, CURRENT_DATE))`,
      [fecha, fecha]
    );
    if (existente.length > 0) {
      trimestreId = existente[0].trimestre_id;
    } else {
      const { rows: ins } = await cliente.query(
        `INSERT INTO trimestres (anio, periodo_trimestre, fecha_inicio, fecha_fin)
         SELECT YEAR(d), QUARTER(d),
                MAKEDATE(YEAR(d), 1) + INTERVAL (QUARTER(d) - 1) * 3 MONTH,
                LAST_DAY(MAKEDATE(YEAR(d), 1) + INTERVAL (QUARTER(d) - 1) * 3 + 2 MONTH)
           FROM (SELECT COALESCE(?, CURRENT_DATE) AS d) AS x`,
        [fecha]
      );
      trimestreId = ins.insertId;
      creado = true;
    }

    // 2. Copiar preguntas solo si el trimestre no tiene ninguna.
    let copiadas = 0;
    const { rows: cuenta } = await cliente.query(
      'SELECT COUNT(*) AS n FROM preguntas_encuesta WHERE trimestre_id = ?',
      [trimestreId]
    );
    if (cuenta[0].n === 0) {
      const { rows: origen } = await cliente.query(
        `SELECT t.trimestre_id
           FROM trimestres t
          WHERE t.trimestre_id <> ?
            AND EXISTS (SELECT 1 FROM preguntas_encuesta p
                         WHERE p.trimestre_id = t.trimestre_id AND p.activa = 1)
          ORDER BY t.anio DESC, t.periodo_trimestre DESC
          LIMIT 1`,
        [trimestreId]
      );
      if (origen.length > 0) {
        const { rows: copia } = await cliente.query(
          `INSERT INTO preguntas_encuesta (servicio_id, trimestre_id, texto_pregunta, tipo_respuesta, activa)
           SELECT servicio_id, ?, texto_pregunta, tipo_respuesta, activa
             FROM preguntas_encuesta
            WHERE trimestre_id = ? AND activa = 1`,
          [trimestreId, origen[0].trimestre_id]
        );
        copiadas = copia.affectedRows;
      }
    }

    await cliente.commit();
    if (creado || copiadas > 0) {
      console.log(
        `[trimestres] ${creado ? 'Trimestre creado' : 'Trimestre existente'} (id ${trimestreId}); ` +
        `${copiadas} pregunta(s) de encuesta copiadas del trimestre anterior.`
      );
    }
    return { trimestre_id: trimestreId, creado, preguntas_copiadas: copiadas };
  } catch (err) {
    try { await cliente.rollback(); } catch (_) { /* sin transaccion abierta */ }
    throw err;
  } finally {
    if (bloqueado) {
      try { await cliente.query('SELECT RELEASE_LOCK(?)', [BLOQUEO]); } catch (_) { /* se libera al cerrar */ }
    }
    cliente.release();
  }
}

module.exports = { asegurarTrimestre };
