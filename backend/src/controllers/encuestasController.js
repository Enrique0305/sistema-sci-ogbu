const { query, getClient } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

// POST /api/encuestas/responder
// Guarda de forma masiva las respuestas de una encuesta de satisfaccion.
// Body: { respuestas: [{ pregunta_id, atencion_id, valor_respuesta }, ...] }
// Se ejecuta en una transaccion: si una respuesta es invalida (p. ej. un
// valor Likert fuera de 1-5), no se guarda ninguna respuesta del lote.
const responder = asyncHandler(async (req, res) => {
  const { respuestas } = req.body;

  const preguntaIds = [...new Set(respuestas.map((r) => r.pregunta_id))];
  const placeholders = preguntaIds.map(() => '?').join(',');
  const { rows: preguntas } = await query(
    `SELECT pregunta_id, tipo_respuesta, activa FROM preguntas_encuesta WHERE pregunta_id IN (${placeholders})`,
    preguntaIds
  );
  const preguntasMap = new Map(preguntas.map((p) => [p.pregunta_id, p]));

  for (const r of respuestas) {
    const pregunta = preguntasMap.get(r.pregunta_id);
    if (!pregunta) {
      return res.status(404).json({ ok: false, error: `La pregunta ${r.pregunta_id} no existe` });
    }
    if (!pregunta.activa) {
      return res.status(409).json({ ok: false, error: `La pregunta ${r.pregunta_id} ya no esta activa` });
    }
    if (pregunta.tipo_respuesta === 'Likert_1_5') {
      const valorNum = Number(r.valor_respuesta);
      if (!Number.isInteger(valorNum) || valorNum < 1 || valorNum > 5) {
        return res.status(400).json({
          ok: false,
          error: `La respuesta a la pregunta ${r.pregunta_id} debe ser un entero entre 1 y 5`,
        });
      }
    }
  }

  const client = await getClient();
  try {
    await client.beginTransaction();

    const idsInsertados = [];
    for (const r of respuestas) {
      const insertResult = await client.query(
        `INSERT INTO respuestas_encuesta (pregunta_id, atencion_id, valor_respuesta)
         VALUES (?, ?, ?)`,
        [r.pregunta_id, r.atencion_id || null, String(r.valor_respuesta).trim()]
      );
      idsInsertados.push(insertResult.rows.insertId);
    }

    await client.commit();
    res.status(201).json({ ok: true, respuestas_guardadas: idsInsertados.length, respuesta_ids: idsInsertados });
  } catch (err) {
    await client.rollback();
    throw err;
  } finally {
    client.release();
  }
});

module.exports = { responder };
