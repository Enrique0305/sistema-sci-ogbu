// Acceso de datos a la vista institucional OBIENESTAR.ALUMNO (fuente SUM).
// Capa de solo lectura: aqui solo viven consultas SELECT contra Oracle.
// El mapeo hacia el modelo local y el UPSERT en MySQL viven en
// sincronizarAlumnos.js, no en este archivo.
const oracle = require('../../config/oracle');

// Valores de ESTADO_PERMANENCIA que deben excluirse siempre de cualquier
// sincronizacion (aprendido de la integracion anterior: representan
// matriculas anuladas, no alumnos vigentes).
const ESTADOS_EXCLUIDOS = ['Anulacion de Ingreso'];

/**
 * Calcula dinamicamente la ventana de los N periodos academicos mas
 * recientes, consultando los valores distintos de ULTIMO_PERIODO_MAT que
 * existen en la propia vista. Nunca se hardcodean periodos en el codigo.
 */
async function obtenerPeriodosVigentes(n) {
  const filas = await oracle.query(
    `SELECT DISTINCT ULTIMO_PERIODO_MAT
       FROM OBIENESTAR.ALUMNO
      WHERE ULTIMO_PERIODO_MAT IS NOT NULL
      ORDER BY ULTIMO_PERIODO_MAT DESC
      FETCH FIRST :n ROWS ONLY`,
    { n }
  );
  return filas.map((f) => f.ULTIMO_PERIODO_MAT);
}

/**
 * Trae la poblacion vigente y deduplicada de alumnos para los periodos
 * indicados: un unico registro por CODIGO_MATRICULA (el mas reciente por
 * ULTIMO_PERIODO_MAT), excluyendo matriculas anuladas.
 *
 * Solo se seleccionan las columnas que efectivamente se usan en esta
 * integracion (alcance minimo acordado: no se trae DNI, telefono,
 * direccion, fecha de nacimiento, promedio, etc.).
 */
async function obtenerAlumnosVigentes(periodos) {
  if (!Array.isArray(periodos) || periodos.length === 0) {
    throw new Error('obtenerAlumnosVigentes requiere al menos un periodo');
  }

  // Binds nombrados generados dinamicamente (p0, p1, ...) - nunca se
  // concatenan los valores de periodo directamente en el SQL.
  const nombresBind = periodos.map((_, i) => `:p${i}`).join(', ');
  const binds = Object.fromEntries(periodos.map((p, i) => [`p${i}`, p]));
  const nombresExcluidos = ESTADOS_EXCLUIDOS.map((_, i) => `:ex${i}`).join(', ');
  Object.assign(binds, Object.fromEntries(ESTADOS_EXCLUIDOS.map((e, i) => [`ex${i}`, e])));

  const sql = `
    SELECT CODIGO_MATRICULA, APELLIDO_PATERNO, APELLIDO_MATERNO, NOMBRES,
           NOMBRE_FACULTAD, EMAIL, ESTADO_PERMANENCIA, ULTIMO_PERIODO_MAT
      FROM (
        SELECT A.*,
               ROW_NUMBER() OVER (PARTITION BY CODIGO_MATRICULA ORDER BY ULTIMO_PERIODO_MAT DESC) AS RN
          FROM OBIENESTAR.ALUMNO A
         WHERE ULTIMO_PERIODO_MAT IN (${nombresBind})
      )
     WHERE RN = 1
       AND ESTADO_PERMANENCIA NOT IN (${nombresExcluidos})
     ORDER BY CODIGO_MATRICULA ASC`;

  return oracle.query(sql, binds);
}

module.exports = { obtenerPeriodosVigentes, obtenerAlumnosVigentes, ESTADOS_EXCLUIDOS };
