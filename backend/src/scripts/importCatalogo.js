// Importa las plantillas Excel llenadas por las oficinas/unidades de la OGBU
// (docs/formatos/Formato_Catalogo_Atenciones_OGBU.xlsx) hacia el sistema.
//
// Hojas (todas opcionales; se procesan en este orden):
//   Unidades    -> unidades
//   Operadores  -> usuarios_responsables (sin clave: el administrador la genera)
//   Categorias  -> categorias_atencion
//   Acciones    -> catalogo_acciones
//   Motivos     -> motivos_recurrentes
//
// Uso:
//   docker compose run --rm backend npm run import:catalogo
//   (lee todos los .xlsx de FORMATOS_DIR, por defecto ./formatos_entrada,
//    montado desde docs/formatos/entrada en docker-compose.yml)
//
// Es idempotente (INSERT ... ON DUPLICATE KEY UPDATE) y nunca borra nada.
// Cada fila omitida se reporta con su motivo. Salvaguardas:
//   - las filas cuya primera celda empieza con "EJEMPLO" se ignoran;
//   - la plantilla no puede asignar el rol Administrador, ni degradar a un
//     administrador existente, ni reactivar a un usuario desactivado.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const { query, pool } = require('../config/db');

const DIR = process.env.FORMATOS_DIR || path.join(process.cwd(), 'formatos_entrada');

const txt = (v) => {
  if (v == null) return '';
  if (typeof v === 'object') {
    if (v.text != null) return String(v.text).trim(); // hipervinculo
    if (v.richText) return v.richText.map((r) => r.text).join('').trim();
    if (v.result != null) return String(v.result).trim(); // formula
  }
  return String(v).trim();
};

const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/[áàä]/g, 'a')
    .replace(/[éèë]/g, 'e')
    .replace(/[íìï]/g, 'i')
    .replace(/[óòö]/g, 'o')
    .replace(/[úùü]/g, 'u')
    .replace(/ñ/g, 'n')
    .replace(/\s+/g, ' ')
    .trim();

const siNo = (v) => norm(v) === 'si';
const entero = (v) => {
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
};

const TIPOS_UNIDAD = { atencion: 'Atencion', soporte: 'Soporte', direccion: 'Direccion' };
const ROLES_PLANTILLA = { operador: 'Operador', consulta: 'Consulta' };

async function cargarMapas() {
  const { rows: servicios } = await query('SELECT servicio_id, nombre_servicio FROM servicios_ogbu');
  const { rows: unidades } = await query('SELECT unidad_id, nombre FROM unidades');
  return {
    servicioPorNombre: new Map(servicios.map((s) => [norm(s.nombre_servicio), s.servicio_id])),
    unidadPorNombre: new Map(unidades.map((u) => [norm(u.nombre), u.unidad_id])),
  };
}

async function recargarUnidades(mapas) {
  const { rows } = await query('SELECT unidad_id, nombre FROM unidades');
  mapas.unidadPorNombre = new Map(rows.map((u) => [norm(u.nombre), u.unidad_id]));
}

function filasDeHoja(ws) {
  const filas = [];
  ws.eachRow({ includeEmpty: false }, (row, n) => {
    if (n === 1) return; // encabezado
    const vals = row.values.slice(1).map(txt);
    if (!vals.some((v) => v !== '')) return;
    if (norm(vals[0]).startsWith('ejemplo')) return; // fila de ejemplo
    filas.push({ n, vals });
  });
  return filas;
}

async function importarArchivo(file, mapas, rep) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const base = path.basename(file);
  const omitir = (hoja, n, motivo) => rep.omitidos.push(`${base} / ${hoja} fila ${n}: ${motivo}`);

  // --- Unidades ---
  const wsUni = wb.getWorksheet('Unidades');
  if (wsUni) {
    for (const { n, vals } of filasDeHoja(wsUni)) {
      const [nombre, servicio, tipo] = vals;
      if (!nombre) { omitir('Unidades', n, 'nombre de unidad vacio'); continue; }
      if (nombre.length > 120) { omitir('Unidades', n, 'nombre de unidad demasiado largo (max 120)'); continue; }
      const servicioId = mapas.servicioPorNombre.get(norm(servicio));
      if (!servicioId) { omitir('Unidades', n, `servicio desconocido "${servicio}"`); continue; }
      const tipoNorm = tipo ? TIPOS_UNIDAD[norm(tipo)] : 'Atencion';
      if (!tipoNorm) { omitir('Unidades', n, `tipo invalido "${tipo}" (Atencion, Soporte o Direccion)`); continue; }
      await query(
        `INSERT INTO unidades (nombre, servicio_id, tipo) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE servicio_id = VALUES(servicio_id), tipo = VALUES(tipo)`,
        [nombre, servicioId, tipoNorm]
      );
      rep.unidades += 1;
    }
    await recargarUnidades(mapas); // para que Operadores/Categorias vean unidades nuevas
  }

  // --- Operadores ---
  const wsOpe = wb.getWorksheet('Operadores');
  if (wsOpe) {
    for (const { n, vals } of filasDeHoja(wsOpe)) {
      const [unidad, nombres, apellidos, correo, cargo, rolTxt] = vals;
      const unidadId = mapas.unidadPorNombre.get(norm(unidad));
      if (!unidadId) { omitir('Operadores', n, `unidad desconocida "${unidad}" (agreguela en la hoja Unidades)`); continue; }
      if (!nombres || !apellidos) { omitir('Operadores', n, 'faltan nombres o apellidos'); continue; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) { omitir('Operadores', n, `correo invalido "${correo}"`); continue; }

      let rol = 'Operador';
      if (rolTxt) {
        rol = ROLES_PLANTILLA[norm(rolTxt)];
        if (!rol) {
          omitir('Operadores', n, `rol "${rolTxt}" no permitido en la plantilla (use Operador o Consulta)`);
          continue;
        }
      }
      await query(
        `INSERT INTO usuarios_responsables
            (nombres, apellidos, correo_institucional, rol, rol_sistema, unidad_id, cargo)
         VALUES (?, ?, ?, 'Operador', ?, ?, ?)
         ON DUPLICATE KEY UPDATE
            nombres = VALUES(nombres), apellidos = VALUES(apellidos),
            unidad_id = VALUES(unidad_id), cargo = VALUES(cargo),
            rol_sistema = IF(rol_sistema = 'Administrador', rol_sistema, VALUES(rol_sistema))`,
        [nombres, apellidos, correo.toLowerCase(), rol, unidadId, cargo || null]
      );
      rep.operadores += 1;
    }
  }

  // --- Categorias ---
  const wsCat = wb.getWorksheet('Categorias');
  if (wsCat) {
    for (const { n, vals } of filasDeHoja(wsCat)) {
      const [servicio, , categoria, descripcion, repite, frecuencia] = vals;
      const servicioId = mapas.servicioPorNombre.get(norm(servicio));
      if (!servicioId) { omitir('Categorias', n, `servicio desconocido "${servicio}"`); continue; }
      if (!categoria) { omitir('Categorias', n, 'categoria vacia'); continue; }
      if (categoria.length > 150) { omitir('Categorias', n, 'categoria demasiado larga (max 150)'); continue; }
      let desc = descripcion || null;
      if (frecuencia) desc = `${desc ? `${desc} ` : ''}(frecuencia aprox. ${frecuencia}/mes)`;
      await query(
        `INSERT INTO categorias_atencion (servicio_id, nombre, descripcion, suele_repetirse)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE descripcion = VALUES(descripcion),
                                 suele_repetirse = VALUES(suele_repetirse), activa = 1`,
        [servicioId, categoria, desc ? desc.slice(0, 400) : null, siNo(repite) ? 1 : 0]
      );
      rep.categorias += 1;
    }
  }

  // --- Acciones ---
  const wsAcc = wb.getWorksheet('Acciones');
  if (wsAcc) {
    for (const { n, vals } of filasDeHoja(wsAcc)) {
      const [servicio, accion, descripcion] = vals;
      const servicioId = mapas.servicioPorNombre.get(norm(servicio));
      if (!servicioId) { omitir('Acciones', n, `servicio desconocido "${servicio}"`); continue; }
      if (!accion) { omitir('Acciones', n, 'accion vacia'); continue; }
      if (accion.length > 150) { omitir('Acciones', n, 'accion demasiado larga (max 150)'); continue; }
      await query(
        `INSERT INTO catalogo_acciones (servicio_id, nombre, descripcion)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE descripcion = VALUES(descripcion), activa = 1`,
        [servicioId, accion, descripcion ? descripcion.slice(0, 400) : null]
      );
      rep.acciones += 1;
    }
  }

  // --- Motivos recurrentes ---
  const wsMot = wb.getWorksheet('Motivos');
  if (wsMot) {
    for (const { n, vals } of filasDeHoja(wsMot)) {
      const [servicio, categoria, motivo, frecuencia] = vals;
      const servicioId = mapas.servicioPorNombre.get(norm(servicio));
      if (!servicioId) { omitir('Motivos', n, `servicio desconocido "${servicio}"`); continue; }
      if (!motivo) { omitir('Motivos', n, 'motivo vacio'); continue; }
      if (motivo.length > 300) { omitir('Motivos', n, 'motivo demasiado largo (max 300)'); continue; }

      let categoriaId = null;
      if (categoria) {
        const { rows } = await query(
          `SELECT categoria_id FROM categorias_atencion
            WHERE servicio_id = ? AND nombre = ? AND activa = 1`,
          [servicioId, categoria]
        );
        if (rows.length === 0) {
          omitir('Motivos', n, `la categoria "${categoria}" no existe en ese servicio (definala en la hoja Categorias)`);
          continue;
        }
        categoriaId = rows[0].categoria_id;
      }
      await query(
        `INSERT INTO motivos_recurrentes (servicio_id, categoria_id, texto, frecuencia_mensual)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE categoria_id = VALUES(categoria_id),
                                 frecuencia_mensual = VALUES(frecuencia_mensual), activo = 1`,
        [servicioId, categoriaId, motivo, frecuencia ? entero(frecuencia) : null]
      );
      rep.motivos += 1;
    }
  }
}

async function main() {
  console.log('Importacion de catalogos desde:', DIR);
  if (!fs.existsSync(DIR)) {
    throw new Error(`No existe el directorio ${DIR}. Monta docs/formatos/entrada o define FORMATOS_DIR.`);
  }
  const archivos = fs
    .readdirSync(DIR)
    .filter((f) => f.toLowerCase().endsWith('.xlsx') && !f.startsWith('~$'))
    .sort();
  if (archivos.length === 0) {
    console.log('No se encontraron archivos .xlsx para importar.');
    return;
  }

  const mapas = await cargarMapas();
  const rep = { unidades: 0, operadores: 0, categorias: 0, acciones: 0, motivos: 0, omitidos: [] };

  for (const f of archivos) {
    console.log('  procesando', f);
    await importarArchivo(path.join(DIR, f), mapas, rep);
  }

  console.log('');
  console.log('Filas procesadas:');
  console.log('  Unidades:  ', rep.unidades);
  console.log('  Operadores:', rep.operadores);
  console.log('  Categorias:', rep.categorias);
  console.log('  Acciones:  ', rep.acciones);
  console.log('  Motivos:   ', rep.motivos);
  console.log('Filas omitidas:', rep.omitidos.length);
  rep.omitidos.forEach((o) => console.log('  -', o));
  if (rep.operadores > 0) {
    console.log('');
    console.log('Nota: los operadores importados no tienen clave. Generela desde el modulo Usuarios.');
  }
}

main()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error('La importacion fallo:', err.message);
    await pool.end().catch(() => {});
    process.exit(1);
  });
