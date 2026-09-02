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
    ['servicios_ogbu', 'servicio_id', 'Catalogo de servicios; es_sci distingue SCI (Alimentacion, Servicio Social, Residencias) de internos (Soporte TI, Gestion OGBU)', '-'],
    ['unidades', 'unidad_id', 'Oficinas/unidades operativas de la OGBU', 'servicio_id (nullable)'],
    ['usuarios_responsables', 'usuario_id', 'Operadores que registran/atienden, adscritos a una unidad', 'unidad_id (nullable)'],
    ['estudiantes', 'estudiante_id', 'Padron de estudiantes (sincronizado desde Oracle SUM)', '-'],
    ['trimestres', 'trimestre_id', 'Periodos trimestrales usados para agrupar encuestas', '-'],
    ['categorias_atencion', 'categoria_id', 'Catalogo de tipos de atencion por servicio', 'servicio_id'],
    ['catalogo_acciones', 'accion_id', 'Catalogo de acciones tomadas por servicio', 'servicio_id'],
    ['atenciones', 'atencion_id', 'Registro de cada atencion/ticket, con ciclo de estados y reincidencia', 'estudiante_id (nullable), servicio_id, unidad_id, categoria_id, accion_id, usuario_responsable_id, atencion_origen_id'],
    ['atenciones_historial', 'historial_id', 'Trazabilidad de cada cambio de estado de una atencion', 'atencion_id, unidad_id, usuario_responsable_id'],
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
      'Promedio de horas entre fecha_atencion y fecha_resolucion/fecha_cierre, por servicio. Habilitado por el ciclo de estados y el registro de fecha de cierre.',
      'Implementado',
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

function oracleMapTable() {
  const W = [3200, 3200, 3680]; // DXA, sums to CONTENT_WIDTH_DXA
  const rows = [
    ['CODIGO_MATRICULA', 'codigo_estudiante', 'Deduplicado: 1 fila por alumno (el periodo mas reciente)'],
    ['NOMBRES', 'nombres', 'Saneado: NULL/vacio -> \'\' (evita violar NOT NULL)'],
    ['APELLIDO_PATERNO + APELLIDO_MATERNO', 'apellidos', 'Concatenados con espacio; cada uno saneado por separado'],
    ['NOMBRE_FACULTAD', 'facultad', 'Directo (ya es un nombre, no un codigo)'],
    ['EMAIL', 'correo_institucional', 'Validado contra el mismo patron que el CHECK de la tabla; si falla, se omite y reporta'],
    ['SITUACION_ACADEMICA / ESTADO_PERMANENCIA', '(no se persiste)', 'Solo se usan para excluir "Anulacion de Ingreso" en el repositorio; fuera de alcance de esta version'],
  ];
  return new Table({
    width: { size: CONTENT_WIDTH_DXA, type: WidthType.DXA },
    columnWidths: W,
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          headerCell('Campo Oracle SUM', W[0]),
          headerCell('Campo local (estudiantes)', W[1]),
          headerCell('Tratamiento', W[2]),
        ],
      }),
      ...rows.map(
        (r, i) =>
          new TableRow({
            children: [
              bodyCell(r[0], W[0], { mono: true, shaded: i % 2 === 1 }),
              bodyCell(r[1], W[1], { mono: true, shaded: i % 2 === 1 }),
              bodyCell(r[2], W[2], { shaded: i % 2 === 1 }),
            ],
          })
      ),
    ],
  });
}

async function main() {
  const ddlLines = fs
    .readFileSync(path.join(__dirname, '..', '..', 'database', 'schema_mysql.sql'), 'utf8')
    .split('\n');
  const ddlEndIdx = ddlLines.findIndex((l) => l.includes('SET FOREIGN_KEY_CHECKS = 1;'));
  const ddlText = ddlLines.slice(0, ddlEndIdx + 1).join('\n');

  const imgRegistro = fs.readFileSync(path.join(__dirname, 'img', 'anexo2_registro_agosto.png'));
  const imgDashboard = fs.readFileSync(path.join(__dirname, 'img', 'anexo3_dashboard_agosto.png'));

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
            children: [new TextRun({ text: '2 de septiembre de 2026', size: 20, color: '6B7280' })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 },
            children: [
              new TextRun({
                text: 'Servicios SCI: Alimentacion (Comedor), Servicio Social y Residencias Universitarias. ' +
                  'Servicios internos (mesa de ayuda, no reportables al SCI): Soporte TI y Gestion OGBU.',
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
                            text: 'ESTADO Y ALCANCE DEL SISTEMA - PERIODO REPORTADO: AGOSTO 2026',
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
                            text: 'Avance respecto al reporte de julio: el sistema fue empaquetado en contenedores Docker y ' +
                              'desplegado en un servidor de la red interna institucional ' +
                              '(http://172.16.173.212:8080) el 31 de agosto de 2026 -- verificado de forma independiente ' +
                              'el 2 de septiembre de 2026 (respuesta HTTP 200, encabezados de nginx, endpoints de la API ' +
                              'respondiendo con datos reales). El alcance del sistema tambien se amplio de un registro de ' +
                              'atenciones SCI a una mesa de ayuda completa (unidades, categorias, ciclo de estados, ' +
                              'reincidencia) y se integro con la fuente institucional Oracle SUM (Anexo 5).',
                            size: 19,
                            color: '78350F',
                          }),
                        ],
                      }),
                      new Paragraph({
                        spacing: { after: 80 },
                        children: [
                          new TextRun({
                            text: 'Uso operativo: a la fecha de este reporte, el trafico registrado en el servidor desplegado ' +
                              'corresponde a pruebas de aceptacion realizadas por el equipo de desarrollo inmediatamente ' +
                              'despues del despliegue (31 de agosto), no a uso operativo diario por parte del personal de ' +
                              'la OGBU. Los Anexos 2 y 3 muestran capturas de ese servidor real; las atenciones visibles ' +
                              'en ellas son, segun corresponda, datos de prueba (dummy) sembrados en el esquema o tickets ' +
                              'de validacion post-despliegue -- ninguna corresponde a un caso operativo reportado por una ' +
                              'oficina de la OGBU.',
                            size: 19,
                            color: '78350F',
                          }),
                        ],
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: 'Hallazgo y correccion durante la elaboracion de este reporte: se detecto que el esquema ' +
                              'base cargaba automaticamente 8 estudiantes y 10 atenciones ficticias en cualquier despliegue ' +
                              'nuevo, lo que en el servidor real produjo atenciones de prueba asociadas a dos estudiantes ' +
                              'reales tras ejecutar la sincronizacion con Oracle SUM. Se separaron los datos ficticios del ' +
                              'esquema base (ahora en un archivo aparte, no desplegado automaticamente) y se goberno la ' +
                              'limpieza de los registros afectados en el servidor real.',
                            size: 19,
                            color: '78350F',
                            italics: true,
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
              ['Anexo 5', 'Integracion con Fuente Institucional Oracle SUM'],
              ['Anexo 6', 'Empaquetado en Contenedores y Despliegue en Red Institucional'],
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
            'Estructura relacional que soporta el Registro Digital de Atenciones, la Mesa de Ayuda interna y las ' +
              'Encuestas de Satisfaccion. En agosto de 2026 el modelo crecio de 7 a 11 tablas para incorporar unidades, ' +
              'categorias/acciones tipificadas, ciclo de estados con trazabilidad (atenciones_historial) y tickets ' +
              'internos sin estudiante asociado. Claves primarias autoincrementales, claves foraneas con reglas de ' +
              'integridad referencial (RESTRICT/CASCADE/SET NULL), indices sobre columnas de filtrado frecuente y ' +
              'restricciones CHECK para los valores enumerados.'
          ),
          h2('1.1 Resumen del modelo (entidades y llaves)'),
          modelTable(),
          new Paragraph({ spacing: { before: 200, after: 100 }, children: [] }),
          h2('1.2 Relaciones (claves foraneas)'),
          ...relacionesList(),
          h2('1.3 Script DDL (MySQL 8.0 - motor desplegado y probado)'),
          p(
            'El siguiente script crea la totalidad de tablas, llaves e indices, mas los catalogos de referencia ' +
              '(servicios, unidades, categorias, acciones, trimestres, preguntas de encuesta) necesarios para que el ' +
              'sistema sea usable desde el primer arranque. A partir de este mes, los datos ficticios (8 estudiantes ' +
              'y 10 atenciones de prueba) se separaron a un archivo aparte (database/seed_demo_dummy.sql) que un ' +
              'despliegue real NO carga automaticamente -- ver Anexo 6 para el hallazgo que motivo este cambio. ' +
              'Version equivalente para PostgreSQL disponible en el repositorio (database/schema_postgresql.sql), ' +
              'pendiente de actualizar con las tablas de mesa de ayuda de este mes.',
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
            'Formulario del frontend (React + Tailwind CSS), ahora reorganizado como mesa de ayuda: una pestaña ' +
              '"Atencion a estudiante" (busqueda por codigo contra el padron real sincronizado desde Oracle SUM) y ' +
              'una pestaña "Ticket interno" (sin estudiante, para Soporte TI o Gestion OGBU). Agrega unidad ' +
              'responsable, categoria y prioridad tipificadas, y accion tomada, sobre los tres servicios SCI: ' +
              'Alimentacion (Comedor), Servicio Social y Residencias Universitarias.'
          ),
          p(
            'Captura tomada el 2 de septiembre de 2026 directamente sobre el servidor real desplegado en la red ' +
              'institucional (http://172.16.173.212:8080), no sobre un entorno local -- ver Anexo 6 para el detalle ' +
              'del despliegue. El uso de este servidor a la fecha corresponde a pruebas de validacion del equipo de ' +
              'desarrollo, no a uso operativo de la OGBU.',
            { italics: true, size: 19, color: '92400E' }
          ),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 100 },
            children: [
              new ImageRun({
                type: 'png',
                data: imgRegistro,
                transformation: { width: 560, height: Math.round((560 * 935) / 1920) },
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: 'Figura 1. Formulario de Registro de Atencion (mesa de ayuda) en http://172.16.173.212:8080, ' +
                  'con las pestañas "Atencion a estudiante"/"Ticket interno" y los nuevos campos de unidad ' +
                  'responsable, categoria y prioridad.',
                italics: true,
                size: 18,
                color: '6B7280',
              }),
            ],
          }),
          p(
            'Elementos visibles en la evidencia: (1) selector "Atencion a estudiante" / "Ticket interno"; ' +
              '(2) busqueda por codigo de estudiante contra GET /api/estudiantes/:codigo; (3) desplegables ' +
              'encadenados Servicio -> Unidad responsable (GET /api/servicios, GET /api/unidades); ' +
              '(4) Operador responsable (opcional, GET /api/usuarios); (5) Categoria y Prioridad (opcional, ' +
              'GET /api/categorias); (6) motivo de atencion y accion tomada tipificada (GET /api/acciones); ' +
              '(7) boton de guardado que invoca POST /api/atenciones, detecta reincidencia y muestra ' +
              'retroalimentacion visual.'
          ),

          pageBreak(),

          // ---------- ANEXO 3 ----------
          h1('Anexo 3 - Capturas de Pantalla del Dashboard de Indicadores SCI'),
          p(
            'Panel de indicadores que calcula en tiempo real el Indicador de Cobertura de Atenciones (ICA), el ' +
              'Indice de Satisfaccion Estudiantil (ISE) y, nuevo este mes, el Tiempo Promedio de Resolucion por ' +
              'servicio -- los tres indicadores previstos en la medida de control PAA-SMC (ver 3.2). Captura tomada ' +
              'sobre el servidor real (http://172.16.173.212:8080); las atenciones que alimentan estos numeros son ' +
              'datos de prueba (sembrados en el esquema o registrados por el equipo de desarrollo al validar el ' +
              'despliegue), no casos operativos reportados por la OGBU -- ver recuadro de Estado y Alcance en la ' +
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
                text: 'Figura 2. Dashboard de Indicadores SCI en http://172.16.173.212:8080, con los 5 KPIs ' +
                  '(incluye Tiempo prom. resolucion y Tasa de reincidencia, nuevos este mes) y el desglose ICA por ' +
                  'servicio, calculados por GET /api/indicadores/dashboard sobre datos de prueba del servidor real.',
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
            'En la captura del servidor real se observa: 6 atenciones totales en el rango por defecto, satisfaccion ' +
              'promedio 3.89/5, tiempo promedio de resolucion de 24 horas (4 atenciones cerradas, todas de ' +
              'Alimentacion), 3 atenciones abiertas y una tasa de reincidencia de 12.5%. El desglose ICA muestra ' +
              '5 atenciones en Alimentacion y 1 en Residencias Universitarias.'
          ),

          h2('3.2 Correspondencia con los indicadores previstos en el PAA-SMC'),
          p(
            'Comparacion entre los indicadores exigidos por la medida de control (Plan Anual de Auditoria - ' +
              'Seguimiento de Medidas de Control) y los efectivamente desarrollados en el sistema:'
          ),
          paaSmcTable(),
          new Paragraph({ spacing: { before: 200, after: 100 }, children: [] }),
          p(
            'Los tres indicadores previstos estan implementados. El tiempo promedio de atencion se obtiene del ' +
              'ciclo de estados de cada atencion (Registrada -> En atencion -> Resuelta -> Cerrada): al pasar a ' +
              'Resuelta/Cerrada el sistema registra fecha_resolucion/fecha_cierre y el dashboard promedia las ' +
              'horas transcurridas desde fecha_atencion, agrupadas por servicio. Cada cambio de estado queda ' +
              'trazado en la tabla atenciones_historial.',
            { italics: true, size: 19, color: '6B7280' }
          ),

          pageBreak(),

          // ---------- ANEXO 4 ----------
          h1('Anexo 4 - Especificacion de APIs Backend'),
          p(
            'Endpoints REST desarrollados en Node.js/Express, con validacion de entrada (express-validator), ' +
              'consultas parametrizadas (prevencion de inyeccion SQL) y manejo centralizado de errores. Este mes se ' +
              'ampliaron con el ciclo de vida de la mesa de ayuda (4.2-4.3) y los catalogos de unidades/operadores/' +
              'categorias/acciones (4.8-4.11). Base URL en el servidor real: http://172.16.173.212:8080/api ' +
              '(nginx enruta /api hacia el backend; en desarrollo local: http://localhost:4000/api).'
          ),

          h2('4.1 POST /api/atenciones'),
          endpointTable({
            method: 'POST',
            path: '/api/atenciones',
            desc: 'Registra una atencion a estudiante o un ticket interno (sin estudiante, con solicitante_desc). ' +
              'Valida unidad/categoria/accion contra el servicio, asigna la fecha en el servidor, detecta ' +
              'reincidencia (misma categoria y estudiante), y evalua el trigger de encuesta de satisfaccion.',
            params: [
              'codigo_estudiante (string, opcional*, alfanumerico, max 20)',
              'solicitante_desc (string, opcional*, max 200) -- *uno de los dos es obligatorio',
              'servicio_id (entero, requerido)',
              'unidad_id (entero, requerido)',
              'categoria_id (entero, opcional)',
              'descripcion_motivo (string, requerido, max 2000)',
              'diagnostico_accion (string, opcional, max 2000)',
              'accion_id (entero, opcional)',
              'usuario_responsable_id (entero, opcional)',
              'prioridad (Baja|Media|Alta, opcional, default Media)',
            ],
            validations: [
              'Debe indicarse codigo_estudiante o solicitante_desc (400 si ninguno)',
              'Unidad debe existir, estar activa y pertenecer al servicio (404/409 si no)',
              'Categoria/accion (si se envian) deben pertenecer al servicio y estar activas (409 si no)',
              'Estudiante/operador (si se envian) deben existir y estar activos (404/409 si no)',
            ],
            success: [
              '201 Created',
              '{ ok: true, atencion_id, fecha_atencion, estado_atencion: "Registrada", prioridad,',
              '  reincidencia: { es_reincidente, total_previas, atencion_origen_id },',
              '  trigger_encuesta: true|false, trimestre_id, preguntas_encuesta: [...] }',
            ],
            errors: [
              '400 Bad Request - datos invalidos o falta estudiante/solicitante',
              '404 Not Found - unidad, estudiante, categoria, accion u operador no existen',
              '409 Conflict - unidad/estudiante inactivo, o categoria/accion no corresponde al servicio',
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
              'servicio_id, unidad_id, categoria_id (entero, opcional)',
              'estado_atencion (Registrada|En atencion|Derivada|Resuelta|Cerrada|Reabierta, opcional)',
              'prioridad (Baja|Media|Alta, opcional)',
              'solo_reincidentes (booleano, opcional)',
              'limite (entero 1-200, opcional, default 50)',
              'pagina (entero >=1, opcional, default 1)',
            ],
            validations: ['Todos los filtros son validados por tipo/formato antes de construir la consulta parametrizada'],
            success: ['200 OK', '{ ok: true, total_retornado, atenciones: [...] }'],
            errors: ['400 Bad Request - filtros con formato invalido'],
          }),

          new Paragraph({ spacing: { after: 200 }, children: [] }),
          h2('4.3 GET /api/atenciones/:id'),
          endpointTable({
            method: 'GET',
            path: '/api/atenciones/:id',
            desc: 'Detalle de una atencion, con la linea de tiempo de cambios de estado y las transiciones ' +
              'validas desde su estado actual (para que el frontend sepa que opciones ofrecer).',
            params: ['id (parametro de ruta, entero, requerido)'],
            validations: ['id debe ser un entero positivo'],
            success: [
              '200 OK',
              '{ ok: true, atencion: {...}, historial: [{ estado_anterior, estado_nuevo,',
              '  comentario, unidad_nombre, creado_en }, ...], estados_siguientes: [...] }',
            ],
            errors: ['404 Not Found - la atencion no existe'],
          }),

          new Paragraph({ spacing: { after: 200 }, children: [] }),
          h2('4.4 PATCH /api/atenciones/:id/estado'),
          endpointTable({
            method: 'PATCH',
            path: '/api/atenciones/:id/estado',
            desc: 'Cambia el estado de una atencion respetando el ciclo de vida (utils/estadoAtencion.js), ' +
              'fija/limpia fecha_resolucion y fecha_cierre segun el estado destino, y registra el cambio en ' +
              'atenciones_historial. Al derivar (estado_nuevo = "Derivada") exige unidad_derivada_id.',
            params: [
              'estado_nuevo (string, requerido, uno de los 6 estados)',
              'comentario (string, opcional, max 600)',
              'unidad_derivada_id (entero, requerido solo si estado_nuevo = "Derivada")',
              'unidad_id, usuario_responsable_id (entero, opcional -- reasignar)',
            ],
            validations: [
              'La transicion debe estar permitida desde el estado actual (409 con las transiciones validas si no)',
              'No se permite "cambiar" al mismo estado en que ya esta (409)',
              'Al derivar, la unidad destino debe existir y estar activa (404 si no)',
            ],
            success: [
              '200 OK',
              '{ ok: true, atencion: { atencion_id, estado_atencion, fecha_resolucion,',
              '  fecha_cierre }, estados_siguientes: [...] }',
            ],
            errors: [
              '404 Not Found - la atencion o la unidad de derivacion no existen',
              '409 Conflict - transicion no permitida, o falta unidad_derivada_id al derivar',
            ],
          }),

          new Paragraph({ spacing: { after: 200 }, children: [] }),
          h2('4.5 GET /api/indicadores/dashboard'),
          endpointTable({
            method: 'GET',
            path: '/api/indicadores/dashboard',
            desc: 'Indicadores de gestion del SCI (ICA, ISE, tiempo promedio de resolucion) mas metricas ' +
              'operativas de mesa de ayuda (distribucion de estados, atenciones por unidad/categoria, reincidencia).',
            params: [
              'fecha_inicio (fecha ISO 8601, opcional, default: hoy - 90 dias)',
              'fecha_fin (fecha ISO 8601, opcional, default: hoy)',
              'servicio_id (entero, opcional - filtra todos los indicadores a un solo servicio)',
            ],
            validations: ['Fechas deben tener formato ISO 8601 valido'],
            success: [
              '200 OK',
              '{ ok: true, rango: {...}, kpis: { total_atenciones, promedio_satisfaccion_general,',
              '  tiempo_promedio_resolucion_horas, atenciones_abiertas, tasa_reincidencia },',
              '  indicador_cobertura_atenciones: [...], tiempo_promedio_resolucion: [...],',
              '  indice_satisfaccion_estudiantil: [...], distribucion_estados: [...],',
              '  atenciones_por_unidad: [...], atenciones_por_categoria: [...],',
              '  reincidencia: { total_atenciones, total_reincidentes, top_categorias: [...] } }',
            ],
            errors: ['400 Bad Request - fechas o servicio_id invalidos'],
          }),

          new Paragraph({ spacing: { after: 200 }, children: [] }),
          h2('4.6 POST /api/encuestas/responder'),
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
          h2('4.7 GET /api/estudiantes/:codigo'),
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
          h2('4.8 GET /api/servicios'),
          endpointTable({
            method: 'GET',
            path: '/api/servicios',
            desc: 'Lista los servicios OGBU activos, usada para poblar los desplegables del formulario y del dashboard.',
            params: ['ambito (sci|todos, opcional, default todos) -- "sci" excluye Soporte TI/Gestion OGBU'],
            validations: ['ambito debe ser uno de los dos valores permitidos'],
            success: ['200 OK', '{ ok: true, servicios: [{ servicio_id, nombre_servicio, descripcion, es_sci }, ...] }'],
            errors: ['500 Internal Server Error (fallo de conexion a BD)'],
          }),

          new Paragraph({ spacing: { after: 200 }, children: [] }),
          h2('4.9 GET /api/unidades'),
          endpointTable({
            method: 'GET',
            path: '/api/unidades',
            desc: 'Lista las unidades/oficinas activas, para el desplegable "Unidad responsable" encadenado al servicio.',
            params: ['servicio_id (entero, opcional)', 'tipo (Atencion|Soporte|Direccion, opcional)'],
            validations: ['No aplica'],
            success: ['200 OK', '{ ok: true, unidades: [{ unidad_id, nombre, servicio_id, tipo,', '  nombre_servicio, es_sci }, ...] }'],
            errors: ['-'],
          }),

          new Paragraph({ spacing: { after: 200 }, children: [] }),
          h2('4.10 GET /api/usuarios'),
          endpointTable({
            method: 'GET',
            path: '/api/usuarios',
            desc: 'Lista los operadores activos, opcionalmente filtrados por unidad. Mientras no haya ' +
              'autenticacion, el operador se elige manualmente en el formulario.',
            params: ['unidad_id (entero, opcional)'],
            validations: ['No aplica'],
            success: ['200 OK', '{ ok: true, usuarios: [{ usuario_id, nombres, apellidos, rol,', '  cargo, unidad_id, unidad_nombre }, ...] }'],
            errors: ['-'],
          }),

          new Paragraph({ spacing: { after: 200 }, children: [] }),
          h2('4.11 GET /api/categorias'),
          endpointTable({
            method: 'GET',
            path: '/api/categorias',
            desc: 'Catalogo de tipos de atencion, para categorizar en el formulario y en los desgloses del dashboard.',
            params: ['servicio_id (entero, opcional)'],
            validations: ['No aplica'],
            success: ['200 OK', '{ ok: true, categorias: [{ categoria_id, servicio_id, nombre,', '  descripcion, suele_repetirse, orden }, ...] }'],
            errors: ['-'],
          }),

          new Paragraph({ spacing: { after: 200 }, children: [] }),
          h2('4.12 GET /api/acciones'),
          endpointTable({
            method: 'GET',
            path: '/api/acciones',
            desc: 'Catalogo de acciones tomadas tipificadas, filtrable por servicio.',
            params: ['servicio_id (entero, opcional)'],
            validations: ['No aplica'],
            success: ['200 OK', '{ ok: true, acciones: [{ accion_id, servicio_id, nombre,', '  descripcion, orden }, ...] }'],
            errors: ['-'],
          }),

          new Paragraph({ spacing: { after: 200 }, children: [] }),
          h2('4.13 GET /api/health'),
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
          h2('4.14 Seguridad transversal'),
          bullet('Consultas 100% parametrizadas (placeholders), sin concatenacion de entrada de usuario - previene inyeccion SQL.'),
          bullet('Validacion y sanitizacion de entrada con express-validator en cada ruta (tipos, longitudes, formatos, whitelists).'),
          bullet('Cabeceras HTTP endurecidas (helmet) y CORS restringido a origenes configurados explicitamente.'),
          bullet('Rate limiting general (300 req/15min) y reforzado en endpoints de escritura (100 req/15min).'),
          bullet('Manejo centralizado de errores que no filtra detalles internos (stack traces, SQL) al cliente.'),
          bullet('El backend nunca conoce credenciales del navegador ni expone /api/atenciones/:id/estado a ' +
            'transiciones fuera del ciclo de vida definido en utils/estadoAtencion.js.'),

          pageBreak(),

          // ---------- ANEXO 5 ----------
          h1('Anexo 5 - Integracion con Fuente Institucional Oracle SUM'),
          p(
            'Modulo de sincronizacion de solo lectura que trae la poblacion vigente de alumnos desde la vista ' +
              'autorizada OBIENESTAR.ALUMNO (Sistema Unico de Matricula, Oracle Autonomous Database) hacia la tabla ' +
              'local estudiantes, reemplazando el padron de prueba por matricula real.'
          ),
          h2('5.1 Arquitectura y aislamiento'),
          bullet('Capa dedicada (backend/src/config/oracle.js + backend/src/integrations/oracleSum/), separada de la logica de negocio del resto del sistema.'),
          bullet('El servidor HTTP principal nunca inicializa la conexion a Oracle: si la fuente no esta disponible, el resto de la API (atenciones, indicadores, encuestas) sigue funcionando con normalidad.'),
          bullet('Se ejecuta como script manual/cron (npm run sync:alumnos), no como endpoint HTTP, porque el proyecto aun no tiene autenticacion de usuarios.'),
          bullet('Conexion 100% de solo lectura: el modulo (src/config/oracle.js) rechaza en codigo cualquier sentencia que no empiece con SELECT/WITH.'),
          bullet('Credenciales y Wallet solo en variables de entorno / carpeta excluida de git; nunca se registran en logs.'),

          h2('5.2 Reglas de negocio aplicadas'),
          bullet('Deduplicacion: CODIGO_MATRICULA no es unico en la vista (una fila por periodo matriculado); se usa ROW_NUMBER() OVER (PARTITION BY CODIGO_MATRICULA ORDER BY ULTIMO_PERIODO_MAT DESC) y se filtra RN = 1.'),
          bullet('Ventana de periodos calculada dinamicamente (SELECT DISTINCT ULTIMO_PERIODO_MAT ... ORDER BY DESC FETCH FIRST N ROWS ONLY) -- nunca hardcodeada.'),
          bullet('Se excluyen matriculas con ESTADO_PERMANENCIA = \'Anulacion de Ingreso\'.'),
          bullet('Alcance minimo de datos (minimizacion): solo se sincronizan los 5 campos que ya existen en estudiantes -- no se trae DNI, telefono, direccion, fecha de nacimiento ni promedio.'),
          bullet('Ninguna fila invalida se descarta en silencio: se omite y se reporta con su motivo (ver 5.4).'),
          oracleMapTable(),

          h2('5.3 Resolucion tecnica: Wallet cifrado sin contraseña conocida'),
          p(
            'El ewallet.pem del Wallet institucional resulto estar cifrado (confirmado de forma independiente con ' +
              '`openssl pkcs8 -in ewallet.pem -nocrypt`, que pide contraseña) y esa contraseña no estaba disponible. ' +
              'La solucion fue cambiar a modo Thick (Oracle Instant Client) en lugar de modo Thin: cwallet.sso, el ' +
              'otro archivo del mismo Wallet, es de auto-login (sin contraseña) pero solo lo pueden leer las ' +
              'librerias nativas de Oracle. Adicionalmente, al usar Instant Client como paquete zip (sin ORACLE_HOME) ' +
              'fue necesario editar sqlnet.ora para que WALLET_LOCATION apunte a la ruta absoluta real del Wallet en ' +
              'lugar del placeholder "?/network/admin" (que de otro modo produce el error ORA-28759).',
            { italics: true, size: 19, color: '6B7280' }
          ),

          h2('5.4 Resultado de la sincronizacion (prueba real, 28 de agosto de 2026)'),
          bullet('Periodos vigentes detectados dinamicamente: 4 mas recientes.'),
          bullet('Filas leidas de Oracle: 43,006.'),
          bullet('Insertados/actualizados en estudiantes: 43,000.'),
          bullet('Omitidos y reportados (correo invalido o vacio en la fuente): 6.'),
          p(
            'Hallazgo posterior: dos codigos de estudiante de prueba usados durante el desarrollo (20190001, ' +
              '20190045) coincidieron por casualidad con matriculas reales, y el UPSERT sobreescribio el nombre de ' +
              'prueba con el real -- dejando, en ese momento, atenciones de prueba asociadas a estudiantes reales. ' +
              'Se identifico, elimino y documento (ver Anexo 6.4) antes de este reporte.',
            { italics: true, size: 19, color: '6B7280' }
          ),

          pageBreak(),

          // ---------- ANEXO 6 ----------
          h1('Anexo 6 - Empaquetado en Contenedores y Despliegue en Red Institucional'),
          p(
            'El sistema, desarrollado localmente durante julio y la primera mitad de agosto, se empaqueto en ' +
              'contenedores Docker y se desplego en un servidor de la red institucional interna, dejandolo ' +
              'accesible por IP a cualquier equipo de la LAN en vez de solo a la maquina de desarrollo.'
          ),

          h2('6.1 Arquitectura del stack'),
          bullet('docker-compose.yml orquesta 3 servicios: mysql (con volumen persistente), backend (Node/Express) y frontend (React, build estatico servido por nginx).'),
          bullet('nginx en el contenedor frontend sirve la SPA Y actua como proxy inverso de /api hacia el backend -- asi el navegador siempre consume rutas relativas (/api/...) y el sistema funciona igual desde cualquier equipo de la LAN, sin depender de "localhost".'),
          bullet('Seguridad de red: MySQL publicado solo en 127.0.0.1 del servidor (no alcanzable desde la LAN); el backend no publica ningun puerto (unicamente "expose", alcanzable solo desde nginx dentro de la red interna de Docker).'),
          bullet('Unico puerto expuesto a la LAN: el de nginx (configurable, HTTP_PORT), por defecto 8080.'),

          h2('6.2 Despliegue real y verificacion independiente'),
          p(
            'Desplegado el 31 de agosto de 2026 en http://172.16.173.212:8080 (red interna institucional). ' +
              'Verificado de forma independiente el 2 de septiembre de 2026 (no solo declarado): respuesta HTTP ' +
              '200 con encabezado Server: nginx/1.27.5; GET /api/health respondiendo { ok: true }; GET /api/servicios ' +
              'y GET /api/unidades devolviendo los catalogos de la migracion de mesa de ayuda; GET ' +
              '/api/indicadores/dashboard devolviendo indicadores calculados sobre datos reales del servidor. Las ' +
              'capturas de los Anexos 2 y 3 se tomaron directamente sobre este servidor.',
            { italics: true, size: 19, color: '6B7280' }
          ),

          h2('6.3 Correccion durante el build: Instant Client en Linux'),
          bullet('El backend corre en Linux dentro del contenedor, por lo que requiere el Instant Client para Linux x64 (no el de Windows usado en las pruebas locales del Anexo 5).'),
          bullet('Se agrego ca-certificates a la imagen -- sin el, la descarga HTTPS del Instant Client fallaba en el build ("curl exit 77").'),
          bullet('La descarga del Instant Client es best-effort: si falla, el build continua igual (el servidor HTTP no depende de Oracle) y solo advierte que "npm run sync:alumnos" necesitara un Instant Client montado aparte.'),

          h2('6.4 Hallazgo y correccion: datos de prueba en el servidor real'),
          p(
            'Al verificar el despliegue se detecto que schema_mysql.sql incluia, en el mismo INSERT que los ' +
              'catalogos de referencia, 8 estudiantes y 10 atenciones ficticias. Como docker-compose monta ese ' +
              'archivo en /docker-entrypoint-initdb.d, todo despliegue nuevo los cargaba automaticamente -- y al ' +
              'correr despues la sincronizacion con Oracle SUM, dos codigos ficticios coincidieron con matriculas ' +
              'reales, dejando atenciones de prueba visiblemente asociadas a dos estudiantes reales por nombre.'
          ),
          bullet('Correccion de raiz: los datos ficticios se movieron a database/seed_demo_dummy.sql, que docker-compose.yml NO monta -- un despliegue nuevo desde ahora arranca con la tabla estudiantes vacia.'),
          bullet('Verificado localmente: schema_mysql.sql solo produce 0 estudiantes/atenciones; + seed_demo_dummy.sql produce los 8/10 de siempre, solo para uso en desarrollo.'),
          bullet('Remediacion en el servidor ya desplegado: se entregaron los comandos para respaldar la base, actualizar el codigo y eliminar especificamente las 10 atenciones ficticias, sin afectar los tickets reales de validacion ya registrados.'),
          p(
            'Este hallazgo es la razon por la que, en la caratula de este reporte, se distingue explicitamente entre ' +
              'datos de prueba y uso operativo real -- la leccion del reporte de julio (documentar solo lo que se ' +
              'puede verificar) se aplico tambien al verificar este despliegue.',
            { italics: true, size: 19, color: '6B7280' }
          ),
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
