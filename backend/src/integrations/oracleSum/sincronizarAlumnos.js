// Orquesta la sincronizacion de la poblacion vigente de alumnos desde
// Oracle SUM hacia la tabla local `estudiantes` (MySQL). Es la unica
// pieza de esta integracion con logica de negocio (mapeo/saneo); la
// lectura a Oracle vive en alumnoRepository.js y el pool MySQL se
// reutiliza tal cual de src/config/db.js.
const alumnoRepository = require('./alumnoRepository');
const db = require('../../config/db');

const CORREO_VALIDO = /^[^\s@]+@[^\s@]+$/; // mismo criterio que el CHECK de la tabla (LIKE '%@%')

function limpiarTexto(valor) {
  return (valor || '').toString().trim();
}

/**
 * Mapea una fila cruda de Oracle al shape de la tabla local `estudiantes`.
 * Solo se mapean los 5 campos del alcance acordado. Nota: SITUACION_ACADEMICA
 * y ESTADO_PERMANENCIA no se persisten aqui (ver README / plan de la
 * integracion) - unicamente se usan en el repositorio para excluir
 * matriculas anuladas antes de llegar a esta funcion.
 */
function mapearAlumno(fila) {
  const apellidos = [limpiarTexto(fila.APELLIDO_PATERNO), limpiarTexto(fila.APELLIDO_MATERNO)]
    .filter(Boolean)
    .join(' ');

  return {
    codigo_estudiante: limpiarTexto(fila.CODIGO_MATRICULA),
    nombres: limpiarTexto(fila.NOMBRES),
    apellidos,
    facultad: limpiarTexto(fila.NOMBRE_FACULTAD),
    correo_institucional: limpiarTexto(fila.EMAIL),
  };
}

async function upsertEstudiante(estudiante) {
  await db.query(
    `INSERT INTO estudiantes (codigo_estudiante, nombres, apellidos, facultad, correo_institucional)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       nombres = VALUES(nombres),
       apellidos = VALUES(apellidos),
       facultad = VALUES(facultad),
       correo_institucional = VALUES(correo_institucional)`,
    [
      estudiante.codigo_estudiante,
      estudiante.nombres,
      estudiante.apellidos,
      estudiante.facultad,
      estudiante.correo_institucional,
    ]
  );
}

/**
 * Sincroniza la poblacion vigente de alumnos desde Oracle SUM hacia la
 * tabla local `estudiantes`. Ninguna fila invalida detiene el lote
 * completo: se omite y se reporta con su motivo.
 */
async function sincronizarAlumnos({ periodosN } = {}) {
  const n = periodosN || Number(process.env.ORACLE_SYNC_PERIODOS_N) || 4;

  const periodos = await alumnoRepository.obtenerPeriodosVigentes(n);
  if (periodos.length === 0) {
    throw new Error('No se encontraron periodos academicos en la vista OBIENESTAR.ALUMNO');
  }

  const filasOracle = await alumnoRepository.obtenerAlumnosVigentes(periodos);

  const reporte = {
    periodos_usados: periodos,
    total_leidos: filasOracle.length,
    insertados_o_actualizados: 0,
    omitidos: [],
  };

  for (const fila of filasOracle) {
    const estudiante = mapearAlumno(fila);

    if (!estudiante.codigo_estudiante) {
      reporte.omitidos.push({ fila, motivo: 'codigo_matricula_vacio' });
      continue;
    }
    if (!CORREO_VALIDO.test(estudiante.correo_institucional)) {
      reporte.omitidos.push({
        codigo_matricula: estudiante.codigo_estudiante,
        motivo: 'correo_invalido_o_vacio',
        valor: estudiante.correo_institucional,
      });
      continue;
    }

    try {
      await upsertEstudiante(estudiante);
      reporte.insertados_o_actualizados += 1;
    } catch (err) {
      // Una colision (ej. correo_institucional UNIQUE ya usado por otro
      // codigo_estudiante) no debe abortar el resto del lote.
      reporte.omitidos.push({
        codigo_matricula: estudiante.codigo_estudiante,
        motivo: err.code === 'ER_DUP_ENTRY' ? 'correo_o_codigo_duplicado' : 'error_insercion',
        detalle: err.code || err.message,
      });
    }
  }

  return reporte;
}

module.exports = { sincronizarAlumnos, mapearAlumno };
