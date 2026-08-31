// Genera la plantilla Excel que se envia a las oficinas/unidades de la OGBU
// para que reporten su padron de operadores, sus categorias de atencion
// recurrentes y sus acciones tipicas. El resultado se importa al sistema con
// `npm run import:catalogo` (backend/src/scripts/importCatalogo.js).
//
// Uso (requiere exceljs; ver README de docs/formatos):
//   node docs/formatos/_generar_formato.js
const ExcelJS = require('exceljs');
const path = require('path');

const SERVICIOS = [
  'Alimentacion',
  'Servicio Social',
  'Residencias Universitarias',
  'Soporte TI',
  'Gestion OGBU',
];

const UNIDADES = [
  'Oficina de Alimentación',
  'Comedor de CU',
  'Comedor de Cangallo',
  'Comedor de Veterinaria',
  'Comedor de San Juan de Lurigancho',
  'Residencia de Ciudad',
  'Residencia de Tello',
  'Oficina de Servicio Social',
  'Unidad de Informática',
  'Jefatura de OGBU',
];

const SI_NO = ['Si', 'No'];
const FILAS = 300; // filas con validacion disponibles para llenar

const FONT = { name: 'Arial', size: 10 };
const HEAD = {
  font: { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } },
  fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7A0019' } },
  alignment: { vertical: 'middle', horizontal: 'left', wrapText: true },
};
const EJEMPLO = {
  font: { name: 'Arial', size: 10, italic: true, color: { argb: 'FF9CA3AF' } },
};

function encabezado(ws, columnas) {
  ws.columns = columnas.map((c) => ({ header: c.h, key: c.k, width: c.w }));
  ws.getRow(1).eachCell((cell) => Object.assign(cell, HEAD));
  ws.getRow(1).height = 28;
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

function validacionLista(ws, colLetra, rangoNombrado) {
  for (let r = 2; r <= FILAS; r++) {
    ws.getCell(`${colLetra}${r}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [rangoNombrado],
      showErrorMessage: true,
      errorTitle: 'Valor no permitido',
      error: 'Selecciona un valor de la lista desplegable.',
    };
  }
}

async function main() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sistema SCI-OGBU';
  wb.created = new Date();

  // --- Hoja Listas (oculta): fuentes de las listas desplegables ---
  const listas = wb.addWorksheet('Listas');
  listas.state = 'veryHidden';
  listas.getColumn(1).values = ['SERVICIOS', ...SERVICIOS];
  listas.getColumn(2).values = ['UNIDADES', ...UNIDADES];
  listas.getColumn(3).values = ['SI_NO', ...SI_NO];
  wb.definedNames.add(`Listas!$A$2:$A$${SERVICIOS.length + 1}`, 'lst_servicios');
  wb.definedNames.add(`Listas!$B$2:$B$${UNIDADES.length + 1}`, 'lst_unidades');
  wb.definedNames.add(`Listas!$C$2:$C$${SI_NO.length + 1}`, 'lst_sino');

  // --- Hoja Instrucciones ---
  const ins = wb.addWorksheet('Instrucciones');
  ins.getColumn(1).width = 110;
  const lineas = [
    ['FORMATO — Catálogo de atenciones y operadores de la OGBU', true],
    ['', false],
    ['Este archivo alimenta el Sistema Digital de Atenciones e Indicadores SCI. Complételo por unidad/oficina y devuélvalo a la Unidad de Informática de la OGBU.', false],
    ['', false],
    ['1. Hoja "Operadores": las personas de su unidad que registran o atienden atenciones.', false],
    ['   - Unidad: elija de la lista. Correo institucional: debe ser @unmsm.edu.pe y único por persona.', false],
    ['', false],
    ['2. Hoja "Categorias": los tipos de atención que su unidad recibe habitualmente.', false],
    ['   - Servicio y Unidad: elija de la lista. Categoría: nombre corto (ej. "Reclamo por calidad de alimentos").', false],
    ['   - ¿Suele repetirse?: "Si" si un mismo estudiante suele volver por lo mismo (ayuda a medir reincidencia).', false],
    ['   - Frecuencia mensual aprox.: número estimado de casos por mes (opcional).', false],
    ['', false],
    ['3. Hoja "Acciones": las respuestas/acciones típicas que su unidad aplica (ej. "Constancia emitida").', false],
    ['', false],
    ['La primera fila de datos de cada hoja es un EJEMPLO (en gris cursiva): reemplácela o bórrela.', false],
    ['No cambie los encabezados ni el nombre de las hojas.', false],
  ];
  lineas.forEach(([txt, bold], i) => {
    const cell = ins.getCell(`A${i + 1}`);
    cell.value = txt;
    cell.font = { name: 'Arial', size: bold ? 12 : 10, bold: !!bold };
    cell.alignment = { wrapText: true };
  });

  // --- Hoja Operadores ---
  const ope = wb.addWorksheet('Operadores');
  encabezado(ope, [
    { h: 'Unidad', k: 'unidad', w: 34 },
    { h: 'Nombres', k: 'nombres', w: 24 },
    { h: 'Apellidos', k: 'apellidos', w: 26 },
    { h: 'Correo institucional', k: 'correo', w: 32 },
    { h: 'Cargo', k: 'cargo', w: 26 },
  ]);
  ope.addRow(['Oficina de Servicio Social', 'María', 'Quispe Rojas', 'maria.quispe@unmsm.edu.pe', 'Trabajadora social']);
  ope.getRow(2).eachCell((c) => Object.assign(c, EJEMPLO));
  validacionLista(ope, 'A', 'lst_unidades');

  // --- Hoja Categorias ---
  const cat = wb.addWorksheet('Categorias');
  encabezado(cat, [
    { h: 'Servicio', k: 'servicio', w: 26 },
    { h: 'Unidad', k: 'unidad', w: 34 },
    { h: 'Categoría (nombre corto)', k: 'categoria', w: 40 },
    { h: 'Descripción', k: 'descripcion', w: 50 },
    { h: '¿Suele repetirse? (Si/No)', k: 'repite', w: 22 },
    { h: 'Frecuencia mensual aprox.', k: 'frecuencia', w: 24 },
  ]);
  cat.addRow(['Alimentacion', 'Comedor de CU', 'Reclamo por calidad de alimentos', 'Queja sobre sabor, cantidad o temperatura de los alimentos', 'Si', 15]);
  cat.getRow(2).eachCell((c) => Object.assign(c, EJEMPLO));
  validacionLista(cat, 'A', 'lst_servicios');
  validacionLista(cat, 'B', 'lst_unidades');
  validacionLista(cat, 'E', 'lst_sino');

  // --- Hoja Acciones ---
  const acc = wb.addWorksheet('Acciones');
  encabezado(acc, [
    { h: 'Servicio', k: 'servicio', w: 26 },
    { h: 'Acción (nombre corto)', k: 'accion', w: 40 },
    { h: 'Descripción', k: 'descripcion', w: 55 },
  ]);
  acc.addRow(['Alimentacion', 'Derivado a control de calidad', 'Se traslada el reclamo al área de control de calidad para inspección']);
  acc.getRow(2).eachCell((c) => Object.assign(c, EJEMPLO));
  validacionLista(acc, 'A', 'lst_servicios');

  // Fuente por defecto en las hojas de datos
  [ope, cat, acc].forEach((ws) => {
    ws.eachRow({ includeEmpty: false }, (row, n) => {
      if (n === 1) return;
      row.eachCell((c) => {
        if (!c.font || !c.font.italic) c.font = FONT;
      });
    });
  });

  const out = path.join(__dirname, 'Formato_Catalogo_Atenciones_OGBU.xlsx');
  await wb.xlsx.writeFile(out);
  console.log('Generado:', out);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
