// Importa las plantillas Excel llenadas por las oficinas/unidades de la OGBU
// (formato docs/formatos/Formato_Catalogo_Atenciones_OGBU.xlsx) hacia los
// catalogos del sistema: unidades, usuarios_responsables, categorias_atencion
// y catalogo_acciones.
//
// Uso:
//   docker compose run --rm backend npm run import:catalogo
//   (lee todos los .xlsx de FORMATOS_DIR, por defecto ./formatos_entrada,
//    montado desde docs/formatos/entrada en docker-compose.yml)
//
// Es idempotente: usa INSERT ... ON DUPLICATE KEY UPDATE. Nunca borra nada
// y reporta cada fila omitida con su motivo (nunca en silencio).
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const { query, pool } = require('../config/db');

const DIR = process.env.FORMATOS_DIR || path.join(process.cwd(), 'formatos_entrada');

const txt = (v) => (v == null ? '' : String(typeof v === 'object' && v.text ? v.text : v).trim());
const siNo = (v) => /^s[ií]$/i.test(txt(v));

async function cargarMapas() {
  const { rows: servicios } = await query('SELECT servicio_id, nombre_servicio FROM servicios_ogbu');
  const { rows: unidades } = await query('SELECT unidad_id, nombre FROM unidades');
  const norm = (s) =>
    s
      .toLowerCase()
      .replace(/[áàä]/g, 'a')
      .replace(/[éèë]/g, 'e')
      .replace(/[íìï]/g, 'i')
      .replace(/[óòö]/g, 'o')
      .replace(/[úùü]/g, 'u')
      .replace(/ñ/g, 'n')
      .replace(/\s+/g, ' ')
      .trim();
  return {
    servicioPorNombre: new Map(servicios.map((s) => [norm(s.nombre_servicio), s.servicio_id])),
    unidadPorNombre: new Map(unidades.map((u) => [norm(u.nombre), u.unidad_id])),
    norm,
  };
}

function filasDeHoja(ws) {
  const filas = [];
  ws.eachRow({ includeEmpty: false }, (row, n) => {
    if (n === 1) return; // encabezado
    const vals = row.values.slice(1).map(txt);
    if (vals.some((v) => v !== '')) filas.push({ n, vals });
  });
  return filas;
}

async function importarArchivo(file, mapas, reporte) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const base = path.basename(file);

  // --- Operadores ---
  const wsOpe = wb.getWorksheet('Operadores');
  if (wsOpe) {
    for (const { n, vals } of filasDeHoja(wsOpe)) {
      const [unidad, nombres, apellidos, correo, cargo] = vals;
      const unidadId = mapas.unidadPorNombre.get(mapas.norm(unidad));
      if (!unidadId) { reporte.omitidos.push(`${base} Operadores fila ${n}: unidad desconocida "${unidad}"`); continue; }
      if (!nombres || !apellidos || !/^[^\s@]+@[^\s@]+$/.test(correo)) {
        reporte.omitidos.push(`${base} Operadores fila ${n}: nombres/apellidos/correo invalidos`); continue;
      }
      const res = await query(
        `INSERT INTO usuarios_responsables (nombres, apellidos, correo_institucional, rol, unidad_id, cargo)
         VALUES (?, ?, ?, 'Operador', ?, ?)
         ON DUPLICATE KEY UPDATE nombres=VALUES(nombres), apellidos=VALUES(apellidos),
                                 unidad_id=VALUES(unidad_id), cargo=VALUES(cargo), estado=1`,
        [nombres, apellidos, correo.toLowerCase(), unidadId, cargo || null]
      );
      reporte.operadores += res.rows.affectedRows >= 1 ? 1 : 0;
    }
  }

  // --- Categorias ---
  const wsCat = wb.getWorksheet('Categorias');
  if (wsCat) {
    for (const { n, vals } of filasDeHoja(wsCat)) {
      const [servicio, , categoria, descripcion, repite, frecuencia] = vals;
      const servicioId = mapas.servicioPorNombre.get(mapas.norm(servicio));
      if (!servicioId) { reporte.omitidos.push(`${base} Categorias fila ${n}: servicio desconocido "${servicio}"`); continue; }
      if (!categoria) { reporte.omitidos.push(`${base} Categorias fila ${n}: categoria vacia`); continue; }
      const desc = descripcion
        ? `${descripcion}${frecuencia ? ` (frecuencia aprox. ${frecuencia}/mes)` : ''}`
        : frecuencia ? `Frecuencia aprox. ${frecuencia}/mes` : null;
      const res = await query(
        `INSERT INTO categorias_atencion (servicio_id, nombre, descripcion, suele_repetirse)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE descripcion=VALUES(descripcion),
                                 suele_repetirse=VALUES(suele_repetirse), activa=1`,
        [servicioId, categoria, desc, siNo(repite) ? 1 : 0]
      );
      reporte.categorias += res.rows.affectedRows >= 1 ? 1 : 0;
    }
  }

  // --- Acciones ---
  const wsAcc = wb.getWorksheet('Acciones');
  if (wsAcc) {
    for (const { n, vals } of filasDeHoja(wsAcc)) {
      const [servicio, accion, descripcion] = vals;
      const servicioId = mapas.servicioPorNombre.get(mapas.norm(servicio));
      if (!servicioId) { reporte.omitidos.push(`${base} Acciones fila ${n}: servicio desconocido "${servicio}"`); continue; }
      if (!accion) { reporte.omitidos.push(`${base} Acciones fila ${n}: accion vacia`); continue; }
      const res = await query(
        `INSERT INTO catalogo_acciones (servicio_id, nombre, descripcion)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE descripcion=VALUES(descripcion), activa=1`,
        [servicioId, accion, descripcion || null]
      );
      reporte.acciones += res.rows.affectedRows >= 1 ? 1 : 0;
    }
  }
}

async function main() {
  console.log('Importacion de catalogos desde:', DIR);
  if (!fs.existsSync(DIR)) {
    throw new Error(`No existe el directorio ${DIR}. Monta docs/formatos/entrada o define FORMATOS_DIR.`);
  }
  const archivos = fs.readdirSync(DIR).filter((f) => f.toLowerCase().endsWith('.xlsx') && !f.startsWith('~$'));
  if (archivos.length === 0) {
    console.log('No se encontraron archivos .xlsx para importar.');
    return;
  }

  const mapas = await cargarMapas();
  const reporte = { operadores: 0, categorias: 0, acciones: 0, omitidos: [] };

  for (const f of archivos) {
    console.log('  procesando', f);
    await importarArchivo(path.join(DIR, f), mapas, reporte);
  }

  console.log('');
  console.log('Operadores insertados/actualizados:', reporte.operadores);
  console.log('Categorias insertadas/actualizadas:', reporte.categorias);
  console.log('Acciones insertadas/actualizadas:  ', reporte.acciones);
  console.log('Filas omitidas:', reporte.omitidos.length);
  reporte.omitidos.forEach((o) => console.log('  -', o));
}

main()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error('La importacion fallo:', err.message);
    await pool.end().catch(() => {});
    process.exit(1);
  });
