const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, ShadingType, BorderStyle, ImageRun, AlignmentType, PageBreak,
  VerticalAlign, Header, Footer, PageNumber, NumberFormat,
} = require('docx');

const MAROON = '7A0019';
const MAROON_DARK = '5C0013';
const LIGHT_GRAY = 'F3F4F6';
const BORDER_GRAY = 'D1D5DB';
// Page (Letter, 12240 DXA) minus 1080 DXA margins on each side.
const CONTENT_WIDTH_DXA = 12240 - 1080 * 2;

const cellBorder = {
  top: { style: BorderStyle.SINGLE, size: 2, color: BORDER_GRAY },
  bottom: { style: BorderStyle.SINGLE, size: 2, color: BORDER_GRAY },
  left: { style: BorderStyle.SINGLE, size: 2, color: BORDER_GRAY },
  right: { style: BorderStyle.SINGLE, size: 2, color: BORDER_GRAY },
};

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 200, after: 200 },
    children: [new TextRun({ text, color: MAROON_DARK, bold: true })],
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, color: MAROON_DARK, bold: true })],
  });
}

function p(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 160 },
    children: [new TextRun({ text, ...opts })],
  });
}

function bullet(text) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 60 },
    children: [new TextRun({ text })],
  });
}

function codeLine(text, color) {
  return new Paragraph({
    spacing: { after: 0, line: 220 },
    children: [new TextRun({ text: text.length ? text : ' ', font: 'Consolas', size: 16, color })],
  });
}

function codeBlock(text, color) {
  return text.split('\n').map((line) => codeLine(line, color));
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

function headerCell(text, widthDxa) {
  return new TableCell({
    width: { size: widthDxa, type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, fill: MAROON },
    borders: cellBorder,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: 'FFFFFF', size: 19 })] })],
  });
}

function bodyCell(text, widthDxa, opts = {}) {
  return new TableCell({
    width: { size: widthDxa, type: WidthType.DXA },
    borders: cellBorder,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    shading: opts.shaded ? { type: ShadingType.CLEAR, fill: LIGHT_GRAY } : undefined,
    children: (Array.isArray(text) ? text : [text]).map((t) =>
      typeof t === 'string'
        ? new Paragraph({ children: [new TextRun({ text: t, size: 19, font: opts.mono ? 'Consolas' : undefined })] })
        : t
    ),
  });
}

function modelTable() {
  const rows = [
    ['usuarios_responsables', 'usuario_id', 'Operadores/trabajadores que registran atenciones', '-'],
    ['estudiantes', 'estudiante_id', 'Padron de estudiantes atendidos por la OGBU', '-'],
    ['servicios_ogbu', 'servicio_id', 'Catalogo de servicios (Alimentacion, Servicio Social, Residencias)', '-'],
    ['trimestres', 'trimestre_id', 'Periodos trimestrales usados para agrupar encuestas', '-'],
    ['atenciones', 'atencion_id', 'Registro de cada atencion brindada', 'estudiante_id, servicio_id, usuario_responsable_id'],
    ['preguntas_encuesta', 'pregunta_id', 'Preguntas de satisfaccion por servicio y trimestre', 'servicio_id, trimestre_id'],
    ['respuestas_encuesta', 'respuesta_id', 'Respuestas de satisfaccion (Likert 1-5 o texto libre)', 'pregunta_id, atencion_id (nullable)'],
  ];
  const W = [2200, 1300, 4380, 2200]; // DXA, sums to CONTENT_WIDTH_DXA
  return new Table({
    width: { size: CONTENT_WIDTH_DXA, type: WidthType.DXA },
    columnWidths: W,
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          headerCell('Tabla', W[0]),
          headerCell('Clave primaria', W[1]),
          headerCell('Descripcion', W[2]),
          headerCell('Claves foraneas (FK)', W[3]),
        ],
      }),
      ...rows.map(
        (r, i) =>
          new TableRow({
            children: [
              bodyCell(r[0], W[0], { mono: true, shaded: i % 2 === 1 }),
              bodyCell(r[1], W[1], { mono: true, shaded: i % 2 === 1 }),
              bodyCell(r[2], W[2], { shaded: i % 2 === 1 }),
              bodyCell(r[3], W[3], { mono: true, shaded: i % 2 === 1 }),
            ],
          })
      ),
    ],
  });
}

function paaSmcTable() {
  const W = [3400, 3600, 3080]; // DXA, sums to CONTENT_WIDTH_DXA
  const rows = [
    [
      'Porcentaje de atencion',
      'ICA - Indicador de Cobertura de Atenciones (conteo de atenciones por servicio, filtrable por rango de fechas)',
      'Implementado',
    ],
    [
      'Tiempo promedio de atencion por tipo de servicio',
      'No se ha desarrollado un indicador especifico.',
      'Pendiente',
    ],
    [
      'Niveles de satisfaccion',
      'ISE - Indice de Satisfaccion Estudiantil (promedio de respuestas Likert 1-5 por servicio y trimestre)',
      'Implementado',
    ],
  ];
  const estadoColor = { Implementado: '166534', Pendiente: 'B45309' };
  const estadoFill = { Implementado: 'DCFCE7', Pendiente: 'FEF3C7' };
  return new Table({
    width: { size: CONTENT_WIDTH_DXA, type: WidthType.DXA },
    columnWidths: W,
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          headerCell('Indicador previsto (PAA-SMC)', W[0]),
          headerCell('Indicador desarrollado', W[1]),
          headerCell('Estado', W[2]),
        ],
      }),
      ...rows.map(
        (r, i) =>
          new TableRow({
            children: [
              bodyCell(r[0], W[0], { shaded: i % 2 === 1 }),
              bodyCell(r[1], W[1], { shaded: i % 2 === 1 }),
              new TableCell({
                width: { size: W[2], type: WidthType.DXA },
                borders: cellBorder,
                verticalAlign: VerticalAlign.CENTER,
                margins: { top: 80, bottom: 80, left: 100, right: 100 },
                shading: { type: ShadingType.CLEAR, fill: estadoFill[r[2]] },
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: r[2], bold: true, size: 19, color: estadoColor[r[2]] })],
                  }),
                ],
              }),
            ],
          })
      ),
    ],
  });
}

function relacionesList() {
  const rels = [
    'atenciones.estudiante_id -> estudiantes.estudiante_id  (ON DELETE RESTRICT)',
    'atenciones.servicio_id -> servicios_ogbu.servicio_id  (ON DELETE RESTRICT)',
    'atenciones.usuario_responsable_id -> usuarios_responsables.usuario_id  (ON DELETE RESTRICT)',
    'preguntas_encuesta.servicio_id -> servicios_ogbu.servicio_id  (ON DELETE CASCADE)',
    'preguntas_encuesta.trimestre_id -> trimestres.trimestre_id  (ON DELETE CASCADE)',
    'respuestas_encuesta.pregunta_id -> preguntas_encuesta.pregunta_id  (ON DELETE CASCADE)',
    'respuestas_encuesta.atencion_id -> atenciones.atencion_id  (ON DELETE SET NULL, nullable)',
  ];
  return rels.map((r) => new Paragraph({
    spacing: { after: 40 },
    children: [new TextRun({ text: r, font: 'Consolas', size: 18 })],
  }));
}

function endpointTable(spec) {
  // style: 'title' = bold monospace single line; 'prose' = plain bulleted list;
  // 'params' = monospace bulleted list; 'code' = monospace block, no bullets
  const rows = [
    { label: 'Metodo y ruta', value: `${spec.method} ${spec.path}`, style: 'title' },
    { label: 'Descripcion', value: spec.desc, style: 'text' },
    { label: 'Parametros / body', value: spec.params, style: 'params' },
    { label: 'Validaciones', value: spec.validations, style: 'prose' },
    { label: 'Respuesta exitosa', value: spec.success, style: 'code' },
    { label: 'Errores posibles', value: spec.errors, style: 'prose' },
  ];

  function renderValue(row) {
    if (!Array.isArray(row.value)) {
      return [
        new Paragraph({
          children: [
            new TextRun({
              text: row.value,
              bold: row.style === 'title',
              size: 19,
              font: row.style === 'title' ? 'Consolas' : undefined,
            }),
          ],
        }),
      ];
    }
    const mono = row.style === 'params' || row.style === 'code';
    const bulleted = row.style === 'params' || row.style === 'prose';
    return row.value.map(
      (line) =>
        new Paragraph({
          spacing: { after: 40 },
          bullet: bulleted ? { level: 0 } : undefined,
          children: [new TextRun({ text: line, size: 19, font: mono ? 'Consolas' : undefined })],
        })
    );
  }

  const W = [2400, CONTENT_WIDTH_DXA - 2400]; // DXA
  return new Table({
    width: { size: CONTENT_WIDTH_DXA, type: WidthType.DXA },
    columnWidths: W,
    rows: rows.map(
      (row) =>
        new TableRow({
          children: [
            new TableCell({
              width: { size: W[0], type: WidthType.DXA },
              shading: { type: ShadingType.CLEAR, fill: LIGHT_GRAY },
              borders: cellBorder,
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 80, bottom: 80, left: 100, right: 100 },
              children: [new Paragraph({ children: [new TextRun({ text: row.label, bold: true, size: 19 })] })],
            }),
            new TableCell({
              width: { size: W[1], type: WidthType.DXA },
              borders: cellBorder,
              margins: { top: 80, bottom: 80, left: 100, right: 100 },
              children: renderValue(row),
            }),
          ],
        })
    ),
  });
}

async function main() {
  const ddlLines = fs
    .readFileSync(path.join(__dirname, '..', '..', 'database', 'schema_mysql.sql'), 'utf8')
    .split('\n');
  const ddlEndIdx = ddlLines.findIndex((l) => l.includes('SET FOREIGN_KEY_CHECKS = 1;'));
  const ddlText = ddlLines.slice(0, ddlEndIdx + 1).join('\n');

  const imgRegistro = fs.readFileSync(path.join(__dirname, 'img', 'anexo2_registro.png'));
  const imgDashboard = fs.readFileSync(path.join(__dirname, 'img', 'anexo3_dashboard_top.png'));

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: 'Calibri', size: 21 } },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 }, // Letter
            margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: BORDER_GRAY } },
                spacing: { after: 100 },
                children: [
                  new TextRun({
                    text: 'Sistema Digital de Atenciones e Indicadores SCI - OGBU UNMSM',
                    size: 16,
                    color: '6B7280',
                    italics: true,
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: 'Pagina ', size: 16, color: '6B7280' }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '6B7280' }),
                  new TextRun({ text: ' de ', size: 16, color: '6B7280' }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: '6B7280' }),
                ],
              }),
            ],
          }),
        },
        children: [
          // ---------- PORTADA ----------
          new Paragraph({ spacing: { before: 1200 }, children: [] }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: 'ANEXOS TECNICOS', bold: true, size: 44, color: MAROON_DARK })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 80 },
            children: [
              new TextRun({ text: 'Sistema Digital de Atenciones e Indicadores SCI', bold: true, size: 30 }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 600 },
            children: [
              new TextRun({ text: 'Oficina General de Bienestar Universitario (OGBU) - UNMSM', size: 24, color: '374151' }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 40 },
            children: [new TextRun({ text: '13 de agosto de 2026', size: 20, color: '6B7280' })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 },
            children: [
              new TextRun({
                text: 'Servicios comprendidos: Alimentacion (Comedor), Servicio Social y Residencias Universitarias',
                size: 20,
                color: '6B7280',
                italics: true,
              }),
            ],
          }),
          new Table({
            width: { size: CONTENT_WIDTH_DXA, type: WidthType.DXA },
            columnWidths: [CONTENT_WIDTH_DXA],
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: CONTENT_WIDTH_DXA, type: WidthType.DXA },
                    shading: { type: ShadingType.CLEAR, fill: 'FEF3C7' },
                    borders: {
                      top: { style: BorderStyle.SINGLE, size: 6, color: 'D97706' },
                      bottom: { style: BorderStyle.SINGLE, size: 6, color: 'D97706' },
                      left: { style: BorderStyle.SINGLE, size: 6, color: 'D97706' },
                      right: { style: BorderStyle.SINGLE, size: 6, color: 'D97706' },
                    },
                    margins: { top: 160, bottom: 160, left: 200, right: 200 },
                    children: [
                      new Paragraph({
                        spacing: { after: 100 },
                        children: [
                          new TextRun({
                            text: 'ESTADO Y ALCANCE DEL SISTEMA - PERIODO REPORTADO: JULIO 2026',
                            bold: true,
                            size: 19,
                            color: '92400E',
                          }),
                        ],
                      }),
                      new Paragraph({
                        spacing: { after: 80 },
                        children: [
                          new TextRun({
                            text: 'Este documento presenta un PROTOTIPO FUNCIONAL, desarrollado y sometido a pruebas en agosto de 2026. ' +
                              'Al cierre de julio de 2026 el sistema no se encontraba implementado ni en uso operativo por las ' +
                              'oficinas y unidades de la OGBU; por lo tanto, no se adjunta evidencia de uso correspondiente a ese ' +
                              'periodo porque el aplicativo aun no habia sido desplegado.',
                            size: 19,
                            color: '78350F',
                          }),
                        ],
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: 'Los datos mostrados en los Anexos 2 y 3 (capturas de pantalla, registros e indicadores) son datos ' +
                              'de prueba (dummy), generados para validar el funcionamiento del sistema durante su desarrollo. No ' +
                              'corresponden a atenciones reales de estudiantes.',
                            size: 19,
                            color: '78350F',
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
          new Paragraph({ spacing: { after: 300 }, children: [] }),
          new Table({
            width: { size: CONTENT_WIDTH_DXA, type: WidthType.DXA },
            columnWidths: [1200, CONTENT_WIDTH_DXA - 1200],
            rows: [
              ['Anexo 1', 'Script y Modelo Fisico de Base de Datos'],
              ['Anexo 2', 'Capturas de Pantalla del Formulario de Registro de Atenciones'],
              ['Anexo 3', 'Capturas de Pantalla del Dashboard de Indicadores SCI'],
              ['Anexo 4', 'Especificacion de APIs Backend'],
            ].map(
              ([a, b]) =>
                new TableRow({
                  children: [
                    new TableCell({
                      width: { size: 1200, type: WidthType.DXA },
                      borders: cellBorder,
                      shading: { type: ShadingType.CLEAR, fill: MAROON },
                      verticalAlign: VerticalAlign.CENTER,
                      margins: { top: 100, bottom: 100, left: 120, right: 120 },
                      children: [new Paragraph({ children: [new TextRun({ text: a, bold: true, color: 'FFFFFF' })] })],
                    }),
                    new TableCell({
                      width: { size: CONTENT_WIDTH_DXA - 1200, type: WidthType.DXA },
                      borders: cellBorder,
                      verticalAlign: VerticalAlign.CENTER,
                      margins: { top: 100, bottom: 100, left: 120, right: 120 },
                      children: [new Paragraph({ children: [new TextRun({ text: b })] })],
                    }),
                  ],
                })
            ),
          }),

          pageBreak(),

          // ---------- ANEXO 1 ----------
          h1('Anexo 1 - Script y Modelo Fisico de Base de Datos'),
          p(
            'Estructura relacional que soporta el Registro Digital de Atenciones y las Encuestas de Satisfaccion. ' +
              'El modelo esta compuesto por 7 tablas con claves primarias autoincrementales, claves foraneas con reglas ' +
              'de integridad referencial (RESTRICT/CASCADE/SET NULL), indices sobre las columnas de filtrado frecuente ' +
              '(fecha_atencion, servicio_id) y restricciones CHECK para los valores enumerados (estado_atencion, tipo_respuesta).'
          ),
          h2('1.1 Resumen del modelo (entidades y llaves)'),
          modelTable(),
          new Paragraph({ spacing: { before: 200, after: 100 }, children: [] }),
          h2('1.2 Relaciones (claves foraneas)'),
          ...relacionesList(),
          h2('1.3 Script DDL (MySQL 8.0 - motor desplegado y probado)'),
          p(
            'El siguiente script crea la totalidad de tablas, llaves e indices. Version equivalente para PostgreSQL ' +
              'disponible en el repositorio del proyecto (database/schema_postgresql.sql). Los INSERT de datos de ' +
              'prueba (dummy) se encuentran en el mismo archivo fuente y se omiten aqui por brevedad.',
            { italics: true, size: 19, color: '6B7280' }
          ),
          new Table({
            width: { size: CONTENT_WIDTH_DXA, type: WidthType.DXA },
            columnWidths: [CONTENT_WIDTH_DXA],
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: CONTENT_WIDTH_DXA, type: WidthType.DXA },
                    shading: { type: ShadingType.CLEAR, fill: '1E1E1E' },
                    borders: cellBorder,
                    margins: { top: 160, bottom: 160, left: 200, right: 200 },
                    children: codeBlock(ddlText, 'D4D4D4'),
                  }),
                ],
              }),
            ],
          }),

          pageBreak(),

          // ---------- ANEXO 2 ----------
          h1('Anexo 2 - Capturas de Pantalla del Formulario de Registro de Atenciones'),
          p(
            'Formulario del frontend (React + Tailwind CSS) utilizado por el operador de la OGBU para registrar la ' +
              'toma de datos del estudiante en los tres servicios: Alimentacion (Comedor), Servicio Social y ' +
              'Residencias Universitarias. Incluye busqueda rapida por codigo de estudiante (con validacion contra la ' +
              'base de datos real), seleccion del servicio, y campos de texto libre para motivo de atencion y ' +
              'diagnostico/accion tomada.'
          ),
          p(
            'Estado al cierre de julio de 2026: el sistema se encontraba en etapa de diseño. El desarrollo y las ' +
              'pruebas funcionales que se documentan en este anexo se realizaron en agosto de 2026. El aplicativo aun ' +
              'no ha sido implementado en produccion ni puesto en uso operativo por las unidades de la OGBU.',
            { italics: true, size: 19, color: '92400E' }
          ),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 100 },
            children: [
              new ImageRun({
                type: 'png',
                data: imgRegistro,
                transformation: { width: 480, height: Math.round((480 * 1032) / 974) },
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: 'Figura 1. Formulario de Registro de Atencion con estudiante encontrado (codigo 20190001) y servicio ' +
                  'Alimentacion seleccionado. Captura tomada sobre la aplicacion en ejecucion (localhost:5173), ' +
                  'consumiendo datos reales de la API backend.',
                italics: true,
                size: 18,
                color: '6B7280',
              }),
            ],
          }),
          p(
            'Elementos visibles en la evidencia: (1) campo de busqueda por codigo de estudiante con boton "Buscar" que ' +
              'consulta GET /api/estudiantes/:codigo; (2) confirmacion visual en verde del estudiante encontrado ' +
              '(nombre y facultad); (3) desplegable "Servicio" poblado dinamicamente desde GET /api/servicios con las ' +
              'tres opciones: Alimentacion, Residencias Universitarias y Servicio Social; (4) selector de operador ' +
              'responsable; (5) areas de texto para motivo de atencion y diagnostico/accion; (6) boton de guardado ' +
              'que invoca POST /api/atenciones y muestra retroalimentacion visual (mensaje de exito o error).'
          ),

          pageBreak(),

          // ---------- ANEXO 3 ----------
          h1('Anexo 3 - Capturas de Pantalla del Dashboard de Indicadores SCI'),
          p(
            'Panel de indicadores que calcula en tiempo real, a partir de datos de prueba (dummy) registrados ' +
              'durante las pruebas funcionales del sistema, el Indicador de Cobertura de Atenciones (ICA) y el ' +
              'Indice de Satisfaccion Estudiantil (ISE) requeridos por el Sistema de Control Interno (SCI). Estos ' +
              'datos no corresponden a atenciones reales de estudiantes; ver recuadro de Estado y Alcance en la ' +
              'caratula.',
            { color: '92400E' }
          ),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 100 },
            children: [
              new ImageRun({
                type: 'png',
                data: imgDashboard,
                transformation: { width: 480, height: Math.round((480 * 1032) / 974) },
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: 'Figura 2. Dashboard de Indicadores SCI mostrando KPIs generales, cobertura de atenciones por ' +
                  'servicio (ICA) e indice de satisfaccion estudiantil por servicio y trimestre (ISE), calculados ' +
                  'automaticamente por el endpoint GET /api/indicadores/dashboard sobre datos de prueba (dummy). ' +
                  'No corresponden a atenciones reales de estudiantes.',
                italics: true,
                size: 18,
                color: '6B7280',
              }),
            ],
          }),
          h2('3.1 Formulas de calculo'),
          bullet(
            'ICA (Indicador de Cobertura de Atenciones): COUNT(atenciones) agrupado por servicio, dentro de un ' +
              'rango de fechas filtrable (por defecto, ultimos 90 dias).'
          ),
          bullet(
            'ISE (Indice de Satisfaccion Estudiantil): AVG(valor_respuesta) de las preguntas tipo Likert_1_5, ' +
              'agrupado por servicio y trimestre, redondeado a 2 decimales.'
          ),
          bullet(
            'KPI "Satisfaccion promedio general": promedio ponderado de todos los ISE por servicio/trimestre, ' +
              'ponderado por numero de respuestas.'
          ),
          p(
            'En la captura se observa, por ejemplo, el servicio Alimentacion con 5 atenciones de prueba en el rango ' +
              'de fechas consultado (ICA) y un ISE de 4.5/5 en el trimestre 2026-T3 (2 respuestas) y 4/5 en 2026-T2 ' +
              '(4 respuestas).'
          ),

          h2('3.2 Correspondencia con los indicadores previstos en el PAA-SMC'),
          p(
            'Comparacion entre los indicadores exigidos por la medida de control (Plan Anual de Auditoria - ' +
              'Seguimiento de Medidas de Control) y los efectivamente desarrollados en el sistema:'
          ),
          paaSmcTable(),
          new Paragraph({ spacing: { before: 200, after: 100 }, children: [] }),
          p(
            'Nota sobre el indicador pendiente: para calcular el tiempo promedio de atencion por servicio se ' +
              'requiere registrar el momento de cierre de cada atencion (adicional al campo estado_atencion ya ' +
              'existente), de modo que el sistema pueda obtener la diferencia entre la fecha de registro ' +
              '(fecha_atencion) y la fecha de cierre, agrupada por servicio. Esta funcionalidad no ha sido ' +
              'implementada y queda pendiente para una siguiente iteracion del sistema.',
            { italics: true, size: 19, color: '6B7280' }
          ),

          pageBreak(),

          // ---------- ANEXO 4 ----------
          h1('Anexo 4 - Especificacion de APIs Backend'),
          p(
            'Endpoints REST desarrollados en Node.js/Express, con validacion de entrada (express-validator), ' +
              'consultas parametrizadas (prevencion de inyeccion SQL) y manejo centralizado de errores. Base URL ' +
              'local: http://localhost:4000/api'
          ),

          h2('4.1 POST /api/atenciones'),
          endpointTable({
            method: 'POST',
            path: '/api/atenciones',
            desc: 'Registra una nueva atencion. Resuelve el estudiante por codigo y el servicio por ID, asigna la fecha/hora automaticamente en el servidor, y evalua si corresponde disparar la encuesta de satisfaccion del trimestre vigente.',
            params: [
              'codigo_estudiante (string, requerido, alfanumerico, max 20)',
              'servicio_id (entero, requerido)',
              'descripcion_motivo (string, requerido, max 2000)',
              'diagnostico_accion (string, opcional, max 2000)',
              'usuario_responsable_id (entero, requerido)',
            ],
            validations: [
              'Codigo de estudiante debe existir y estar activo (404/409 si no)',
              'Servicio debe existir y tener estado Activo (404/409 si no)',
              'Usuario responsable debe existir y estar activo (404 si no)',
              'descripcion_motivo no puede estar vacio ni exceder 2000 caracteres',
            ],
            success: [
              '201 Created',
              '{ ok: true, atencion_id, fecha_atencion, estado_atencion,',
              '  trigger_encuesta: true|false, trimestre_id,',
              '  preguntas_encuesta: [...] }',
            ],
            errors: [
              '400 Bad Request - datos invalidos (detalle por campo)',
              '404 Not Found - estudiante, servicio o usuario no existen',
              '409 Conflict - estudiante/servicio inactivo',
            ],
          }),

          new Paragraph({ spacing: { after: 200 }, children: [] }),
          h2('4.2 GET /api/atenciones'),
          endpointTable({
            method: 'GET',
            path: '/api/atenciones',
            desc: 'Lista atenciones con filtros opcionales, usada por la tabla de "Atenciones recientes" del dashboard.',
            params: [
              'fecha_inicio (fecha ISO 8601, opcional)',
              'fecha_fin (fecha ISO 8601, opcional)',
              'servicio_id (entero, opcional)',
              'estado_atencion (En Proceso | Completado, opcional)',
              'limite (entero 1-200, opcional, default 50)',
              'pagina (entero >=1, opcional, default 1)',
            ],
            validations: ['Todos los filtros son validados por tipo/formato antes de construir la consulta parametrizada'],
            success: ['200 OK', '{ ok: true, total_retornado, atenciones: [...] }'],
            errors: ['400 Bad Request - filtros con formato invalido'],
          }),

          new Paragraph({ spacing: { after: 200 }, children: [] }),
          h2('4.3 GET /api/indicadores/dashboard'),
          endpointTable({
            method: 'GET',
            path: '/api/indicadores/dashboard',
            desc: 'Calcula y retorna los indicadores de gestion del SCI: ICA e ISE, mas KPIs generales.',
            params: [
              'fecha_inicio (fecha ISO 8601, opcional, default: hoy - 90 dias)',
              'fecha_fin (fecha ISO 8601, opcional, default: hoy)',
              'servicio_id (entero, opcional - filtra ambos indicadores a un solo servicio)',
            ],
            validations: ['Fechas deben tener formato ISO 8601 valido'],
            success: [
              '200 OK',
              '{ ok: true, rango: {...},',
              '  kpis: { total_atenciones, promedio_satisfaccion_general },',
              '  indicador_cobertura_atenciones: [...],',
              '  indice_satisfaccion_estudiantil: [...] }',
            ],
            errors: ['400 Bad Request - fechas o servicio_id invalidos'],
          }),

          new Paragraph({ spacing: { after: 200 }, children: [] }),
          h2('4.4 POST /api/encuestas/responder'),
          endpointTable({
            method: 'POST',
            path: '/api/encuestas/responder',
            desc: 'Guarda de forma masiva (transaccional) las respuestas de una encuesta de satisfaccion. Si una respuesta es invalida, no se guarda ninguna del lote.',
            params: [
              'respuestas (array, 1-50 elementos, requerido), cada elemento:',
              '  pregunta_id (entero, requerido)',
              '  atencion_id (entero, opcional/nullable)',
              '  valor_respuesta (string, requerido, max 500)',
            ],
            validations: [
              'Cada pregunta_id debe existir y estar activa',
              'Si tipo_respuesta = Likert_1_5, el valor debe ser un entero entre 1 y 5',
              'Operacion ejecutada dentro de una transaccion (BEGIN/COMMIT/ROLLBACK)',
            ],
            success: ['201 Created', '{ ok: true, respuestas_guardadas, respuesta_ids: [...] }'],
            errors: [
              '400 Bad Request - respuesta Likert fuera de rango 1-5',
              '404 Not Found - pregunta_id no existe',
              '409 Conflict - pregunta ya no esta activa',
            ],
          }),

          new Paragraph({ spacing: { after: 200 }, children: [] }),
          h2('4.5 GET /api/estudiantes/:codigo'),
          endpointTable({
            method: 'GET',
            path: '/api/estudiantes/:codigo',
            desc: 'Busqueda rapida de un estudiante por su codigo, usada para autocompletar el formulario de registro.',
            params: ['codigo (parametro de ruta, alfanumerico, requerido)'],
            validations: ['Formato de codigo validado (alfanumerico, max 20 caracteres)'],
            success: ['200 OK', '{ ok: true, estudiante: { estudiante_id, codigo_estudiante, nombres,', '  apellidos, facultad, correo_institucional, estado } }'],
            errors: ['404 Not Found - codigo no existe', '409 Conflict - estudiante inactivo'],
          }),

          new Paragraph({ spacing: { after: 200 }, children: [] }),
          h2('4.6 GET /api/servicios'),
          endpointTable({
            method: 'GET',
            path: '/api/servicios',
            desc: 'Lista los servicios OGBU activos (Alimentacion, Servicio Social, Residencias Universitarias), usada para poblar el desplegable del formulario.',
            params: ['Sin parametros'],
            validations: ['No aplica'],
            success: ['200 OK', '{ ok: true, servicios: [{ servicio_id, nombre_servicio, descripcion }, ...] }'],
            errors: ['500 Internal Server Error (fallo de conexion a BD)'],
          }),

          new Paragraph({ spacing: { after: 200 }, children: [] }),
          h2('4.7 GET /api/health'),
          endpointTable({
            method: 'GET',
            path: '/api/health',
            desc: 'Verificacion de disponibilidad del servicio backend (health check).',
            params: ['Sin parametros'],
            validations: ['No aplica'],
            success: ['200 OK', '{ ok: true, servicio: "sci-ogbu-backend" }'],
            errors: ['-'],
          }),

          new Paragraph({ spacing: { before: 300, after: 100 }, children: [] }),
          h2('4.8 Seguridad transversal'),
          bullet('Consultas 100% parametrizadas (placeholders), sin concatenacion de entrada de usuario - previene inyeccion SQL.'),
          bullet('Validacion y sanitizacion de entrada con express-validator en cada ruta (tipos, longitudes, formatos, whitelists).'),
          bullet('Cabeceras HTTP endurecidas (helmet) y CORS restringido a origenes configurados explicitamente.'),
          bullet('Rate limiting general (300 req/15min) y reforzado en endpoints de escritura (100 req/15min).'),
          bullet('Manejo centralizado de errores que no filtra detalles internos (stack traces, SQL) al cliente.'),
        ],
      },
    ],
  });

  const buf = await Packer.toBuffer(doc);
  const outPath = path.join(__dirname, 'Anexos_Tecnicos_SCI_OGBU.docx');
  fs.writeFileSync(outPath, buf);
  console.log('Generado:', outPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
