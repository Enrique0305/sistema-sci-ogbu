// Genera la plantilla Excel que se envia a las oficinas/unidades de la OGBU
// para que registren sus unidades, a quien se asignan los casos, sus
// categorias, sus motivos de atencion recurrentes y sus acciones tipicas.
// El resultado se carga al sistema con `npm run import:catalogo`
// (backend/src/scripts/importCatalogo.js). Los nombres de hojas y el orden de
// columnas DEBEN coincidir con ese importador.
//
// Uso (requiere exceljs; ver docs/formatos/README.md):
//   node docs/formatos/_generar_formato.js
const ExcelJS = require('exceljs');
const path = require('path');

const VERSION = '2.0';

const SERVICIOS = [
  'Alimentacion',
  'Servicio Social',
  'Residencias Universitarias',
  'Soporte TI',
  'Gestion OGBU',
];
const TIPOS_UNIDAD = ['Atencion', 'Soporte', 'Direccion'];
const ROLES = ['Operador', 'Consulta'];
const SI_NO = ['Si', 'No'];

// Unidades vigentes en el sistema (se precargan para que cada oficina las
// confirme/corrija y pueda agregar las que falten).
const UNIDADES = [
  ['Oficina de Alimentación', 'Alimentacion', 'Atencion'],
  ['Comedor de CU', 'Alimentacion', 'Atencion'],
  ['Comedor de Cangallo', 'Alimentacion', 'Atencion'],
  ['Comedor de Veterinaria', 'Alimentacion', 'Atencion'],
  ['Comedor de San Juan de Lurigancho', 'Alimentacion', 'Atencion'],
  ['Residencia de Ciudad', 'Residencias Universitarias', 'Atencion'],
  ['Residencia de Tello', 'Residencias Universitarias', 'Atencion'],
  ['Oficina de Servicio Social', 'Servicio Social', 'Atencion'],
  ['Unidad de Informática', 'Soporte TI', 'Soporte'],
  ['Jefatura de OGBU', 'Gestion OGBU', 'Direccion'],
];

const FILAS = 300; // filas con validacion disponibles para llenar
const GRIS = 'FF9CA3AF';
const GUINDA = 'FF7A0019';
const AMARILLO = 'FFFEF3C7';

const FONT = { name: 'Arial', size: 10 };
const HEAD_REQ = {
  font: { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } },
  fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: GUINDA } },
  alignment: { vertical: 'middle', horizontal: 'left', wrapText: true },
};
// Columnas referenciales (no se cargan al sistema): encabezado en gris.
const HEAD_REF = {
  font: { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } },
  fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6B7280' } },
  alignment: { vertical: 'middle', horizontal: 'left', wrapText: true },
};
const EJEMPLO = { font: { name: 'Arial', size: 10, italic: true, color: { argb: GRIS } } };

function hoja(wb, nombre, columnas) {
  const ws = wb.addWorksheet(nombre, {
    views: [{ state: 'frozen', ySplit: 1 }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  ws.columns = columnas.map((c) => ({ header: c.h, key: c.k, width: c.w }));
  ws.getRow(1).height = 32;
  columnas.forEach((c, i) => {
    const cell = ws.getRow(1).getCell(i + 1);
    Object.assign(cell, c.ref ? HEAD_REF : HEAD_REQ);
    if (c.nota) cell.note = { texts: [{ text: c.nota }] };
  });
  return ws;
}

function lista(ws, col, formula, { estricta = true } = {}) {
  for (let r = 2; r <= FILAS; r++) {
    ws.getCell(`${col}${r}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [formula],
      showErrorMessage: estricta,
      errorStyle: 'stop',
      errorTitle: 'Valor no permitido',
      error: 'Selecciona un valor de la lista desplegable.',
    };
  }
}

function ejemplo(ws, valores) {
  ws.addRow(valores);
  ws.getRow(ws.rowCount).eachCell((c) => Object.assign(c, EJEMPLO));
}

function fuenteDatos(ws, desde = 2) {
  ws.eachRow({ includeEmpty: false }, (row, n) => {
    if (n < desde) return;
    row.eachCell((c) => {
      if (!c.font || !c.font.italic) c.font = FONT;
      c.alignment = { vertical: 'top', wrapText: true };
    });
  });
}

async function main() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sistema SCI-OGBU';
  wb.created = new Date();

  // --- Listas (oculta) ---
  const listas = wb.addWorksheet('Listas');
  listas.state = 'veryHidden';
  listas.getColumn(1).values = ['SERVICIOS', ...SERVICIOS];
  listas.getColumn(2).values = ['TIPOS', ...TIPOS_UNIDAD];
  listas.getColumn(3).values = ['ROLES', ...ROLES];
  listas.getColumn(4).values = ['SI_NO', ...SI_NO];
  wb.definedNames.add(`Listas!$A$2:$A$${SERVICIOS.length + 1}`, 'lst_servicios');
  wb.definedNames.add(`Listas!$B$2:$B$${TIPOS_UNIDAD.length + 1}`, 'lst_tipos');
  wb.definedNames.add(`Listas!$C$2:$C$${ROLES.length + 1}`, 'lst_roles');
  wb.definedNames.add(`Listas!$D$2:$D$${SI_NO.length + 1}`, 'lst_sino');

  // ============ Instrucciones ============
  const ins = wb.addWorksheet('Instrucciones');
  ins.getColumn(1).width = 38;
  ins.getColumn(2).width = 78;

  const titulo = ins.getCell('A1');
  titulo.value = 'FORMATO DE REGISTRO DE UNIDADES, OPERADORES Y CATEGORÍAS DE ATENCIÓN';
  titulo.font = { name: 'Arial', size: 13, bold: true, color: { argb: GUINDA } };
  ins.mergeCells('A1:B1');
  const sub = ins.getCell('A2');
  sub.value = `Sistema Digital de Atenciones e Indicadores SCI · OGBU - UNMSM · Versión ${VERSION}`;
  sub.font = { name: 'Arial', size: 9, color: { argb: GRIS } };
  ins.mergeCells('A2:B2');

  const datos = [
    ['Oficina / unidad que remite', 'Escriba aquí'],
    ['Persona que completa el formato', 'Escriba aquí'],
    ['Cargo', 'Escriba aquí'],
    ['Fecha', 'dd/mm/aaaa'],
  ];
  datos.forEach(([etq, ph], i) => {
    const r = 4 + i;
    const a = ins.getCell(`A${r}`);
    a.value = etq;
    a.font = { name: 'Arial', size: 10, bold: true };
    const b = ins.getCell(`B${r}`);
    b.value = ph;
    b.font = { name: 'Arial', size: 10, color: { argb: GRIS } };
    b.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AMARILLO } };
    b.border = { bottom: { style: 'thin', color: { argb: GRIS } } };
  });

  const texto = [
    ['', false],
    ['QUÉ SE LES PIDE', true],
    ['Complete las hojas de este libro con la información de SU oficina/unidad. Los datos se cargarán al sistema para que el registro de atenciones use las unidades, el personal, las categorías y los motivos reales de cada oficina.', false],
    ['', false],
    ['HOJAS (en este orden)', true],
    ['1. Unidades — Confirme o corrija las unidades de su servicio y agregue las que falten (ya vienen precargadas las vigentes). Elija el servicio y el tipo de la lista.', false],
    ['2. Operadores — Personal de su unidad que atenderá o registrará casos: nombres, apellidos, correo institucional (@unmsm.edu.pe), cargo y rol en el sistema (Operador: registra y gestiona atenciones · Consulta: solo ve indicadores).', false],
    ['3. Categorias — Los TIPOS de atención que su unidad recibe (ej. "Reclamo por calidad de alimentos"). Indique si suelen repetirse y, en la última columna, a quién se asignaría cada tipo de caso.', false],
    ['4. Motivos — Los MOTIVOS recurrentes concretos, tal como se escribirían al registrar (ej. "Comida fría en el comedor"). Son atajos: en el sistema el motivo SIEMPRE se puede escribir como texto libre. Si su oficina no tiene motivos fijos, deje esta hoja vacía.', false],
    ['5. Acciones — Las acciones o respuestas típicas que su unidad aplica (ej. "Constancia emitida", "Derivado a control de calidad").', false],
    ['', false],
    ['REGLAS', true],
    ['• Una fila por registro. No cambie los nombres de las hojas ni el orden/encabezado de las columnas.', false],
    ['• Las columnas con encabezado GUINDA se cargan al sistema. Las de encabezado GRIS son referenciales (sirven a la jefatura, no se cargan).', false],
    ['• Las filas en gris cursiva que empiezan con "EJEMPLO" son solo ilustrativas: se ignoran al cargar (puede borrarlas).', false],
    ['• Use los desplegables donde existan. Un nombre de unidad nuevo debe escribirse primero en la hoja Unidades.', false],
    ['• Los operadores se cargan SIN clave; el administrador del sistema genera la clave de acceso de cada persona.', false],
    ['• No incluya datos personales sensibles (DNI, teléfonos personales, etc.).', false],
    ['', false],
    ['DEVOLUCIÓN', true],
    ['Remita este archivo completado a la Unidad de Informática de la OGBU, indicando en el oficio de respuesta la oficina que lo completa.', false],
  ];
  texto.forEach(([t, bold], i) => {
    const r = 9 + i;
    const c = ins.getCell(`A${r}`);
    c.value = t;
    c.font = { name: 'Arial', size: bold ? 11 : 10, bold, color: bold ? { argb: GUINDA } : undefined };
    c.alignment = { wrapText: true, vertical: 'top' };
    ins.mergeCells(`A${r}:B${r}`);
    if (t.length > 110) ins.getRow(r).height = 14 * Math.ceil(t.length / 110);
  });

  // ============ Unidades ============
  const uni = hoja(wb, 'Unidades', [
    { h: 'Unidad / oficina', k: 'unidad', w: 38, nota: 'Nombre oficial de la unidad. Para agregar una nueva, escríbala en una fila vacía.' },
    { h: 'Servicio al que pertenece', k: 'servicio', w: 28, nota: 'Elija de la lista.' },
    { h: 'Tipo', k: 'tipo', w: 14, nota: 'Atencion (atiende estudiantes), Soporte (apoyo interno) o Direccion (gestión).' },
    { h: 'Responsable de la unidad (referencial)', k: 'resp', w: 34, ref: true },
    { h: 'Observaciones (referencial)', k: 'obs', w: 40, ref: true },
  ]);
  UNIDADES.forEach((u) => uni.addRow(u));
  lista(uni, 'B', 'lst_servicios');
  lista(uni, 'C', 'lst_tipos');
  fuenteDatos(uni);

  // ============ Operadores ============
  const ope = hoja(wb, 'Operadores', [
    { h: 'Unidad', k: 'unidad', w: 36, nota: 'Elija la unidad (la lista toma las de la hoja Unidades).' },
    { h: 'Nombres', k: 'nombres', w: 24 },
    { h: 'Apellidos', k: 'apellidos', w: 26 },
    { h: 'Correo institucional', k: 'correo', w: 32, nota: 'Debe ser único por persona (@unmsm.edu.pe).' },
    { h: 'Cargo', k: 'cargo', w: 26 },
    { h: 'Rol en el sistema', k: 'rol', w: 18, nota: 'Operador: registra y gestiona atenciones. Consulta: solo ve indicadores. (El rol Administrador lo asigna el administrador del sistema.)' },
  ]);
  ejemplo(ope, ['EJEMPLO › Comedor de CU', 'Lucía', 'Ramos Soto', 'lucia.ramos@unmsm.edu.pe', 'Cajera', 'Operador']);
  lista(ope, 'A', 'Unidades!$A$2:$A$60', { estricta: false });
  lista(ope, 'F', 'lst_roles');
  fuenteDatos(ope);

  // ============ Categorias ============
  const cat = hoja(wb, 'Categorias', [
    { h: 'Servicio', k: 'servicio', w: 26 },
    { h: 'Unidad', k: 'unidad', w: 34, nota: 'Unidad que recibe este tipo de caso (informativo para ordenar).' },
    { h: 'Categoría (tipo de atención)', k: 'categoria', w: 40, nota: 'Nombre corto del tipo de atención. Ej.: "Reclamo por calidad de alimentos".' },
    { h: 'Descripción', k: 'descripcion', w: 46 },
    { h: '¿Suele repetirse? (Si/No)', k: 'repite', w: 20, nota: 'Si el mismo estudiante suele volver por lo mismo (permite medir reincidencia).' },
    { h: 'Frecuencia mensual aprox.', k: 'frecuencia', w: 20, nota: 'Número estimado de casos por mes (opcional).' },
    { h: 'Se asigna a (correo del operador) · referencial', k: 'asignado', w: 36, ref: true, nota: 'A quién se asignaría este tipo de caso. Referencial: hoy el sistema asigna al usuario que registra.' },
  ]);
  ejemplo(cat, ['EJEMPLO › Alimentacion', 'Comedor de CU', 'Reclamo por calidad de alimentos', 'Queja por sabor, cantidad o temperatura de los alimentos', 'Si', 15, 'lucia.ramos@unmsm.edu.pe']);
  lista(cat, 'A', 'lst_servicios');
  lista(cat, 'B', 'Unidades!$A$2:$A$60', { estricta: false });
  lista(cat, 'E', 'lst_sino');
  fuenteDatos(cat);

  // ============ Motivos ============
  const mot = hoja(wb, 'Motivos', [
    { h: 'Servicio', k: 'servicio', w: 26 },
    { h: 'Categoría a la que corresponde (opcional)', k: 'categoria', w: 40, nota: 'Elija una categoría definida en la hoja Categorias (o déjela vacía si aplica al servicio en general).' },
    { h: 'Motivo recurrente', k: 'motivo', w: 60, nota: 'Texto tal como se registraría. Máx. 300 caracteres. En el sistema siempre se podrá escribir otro motivo libremente.' },
    { h: 'Frecuencia mensual aprox.', k: 'frecuencia', w: 20, nota: 'Opcional. Sirve para ordenar los motivos más comunes primero.' },
  ]);
  ejemplo(mot, ['EJEMPLO › Alimentacion', 'Reclamo por calidad de alimentos', 'La comida llegó fría o en mal estado', 12]);
  lista(mot, 'A', 'lst_servicios');
  lista(mot, 'B', 'Categorias!$C$2:$C$300', { estricta: false });
  fuenteDatos(mot);

  // ============ Acciones ============
  const acc = hoja(wb, 'Acciones', [
    { h: 'Servicio', k: 'servicio', w: 26 },
    { h: 'Acción tomada (nombre corto)', k: 'accion', w: 42 },
    { h: 'Descripción', k: 'descripcion', w: 56 },
  ]);
  ejemplo(acc, ['EJEMPLO › Alimentacion', 'Derivado a control de calidad', 'Se traslada el reclamo al área de control de calidad para inspección']);
  lista(acc, 'A', 'lst_servicios');
  fuenteDatos(acc);

  // Hoja activa al abrir: Instrucciones
  wb.views = [{ activeTab: 1, firstSheet: 0, visibility: 'visible' }];

  const out = path.join(__dirname, 'Formato_Catalogo_Atenciones_OGBU.xlsx');
  await wb.xlsx.writeFile(out);
  console.log('Generado:', out);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
