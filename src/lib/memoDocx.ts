// Generación del memorando de salida de equipos (.docx) en el navegador,
// replicando la plantilla oficial (Calibri, título "Memorando", tabla de
// equipos y bloque de firmas). Usa la librería `docx` cargada dinámicamente
// para no engordar el bundle inicial.

export interface MemoEquipoFila {
  caracteristica: string
  modelo: string
  marca: string
  serie: string
}

export interface MemoDatos {
  para: string // ej. "CD APOPA 7417"
  de: string // ej. "Automatización F&V"
  cc: string // ej. "PA"
  fecha: string // ej. "03/07/2026"
  asunto: string // ej. "Salida de equipo para inducción"
  cuerpo: string
  equipos: MemoEquipoFila[]
  /** Líneas adicionales sin serie, ej. "14 baterías para TC72" */
  extras: string[]
  autorizado1: string
  autorizado2: string
}

// Ancho útil de página A4 con márgenes de la plantilla (en DXA/twips):
// 11906 − 851 − 851 = 10204
const ANCHO_TABLA = 10204
const COLS_EQUIPOS = [3204, 2500, 1800, 2700] // Características, Modelo, Marca, Serie
const COL_FIRMA = Math.floor(ANCHO_TABLA / 4)

export function nombreArchivoMemo(datos: MemoDatos) {
  const cdSlug = datos.para.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '')
  const fechaSlug = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  return `Salida_${cdSlug}_${fechaSlug}.docx`
}

export function descargarBlob(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  a.click()
  URL.revokeObjectURL(url)
}

/** Construye el memorando y devuelve el archivo como Blob (sin descargarlo). */
export async function generarMemoBlob(datos: MemoDatos): Promise<Blob> {
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    Table,
    TableRow,
    TableCell,
    WidthType,
    AlignmentType,
    BorderStyle,
    ShadingType,
    VerticalAlign,
  } = await import('docx')

  const negrita = (texto: string, opts: { size?: number } = {}) =>
    new TextRun({ text: texto, bold: true, size: opts.size ?? 22 })

  const lineaEncabezado = (texto: string) =>
    new Paragraph({ spacing: { after: 160 }, children: [negrita(texto)] })

  const bordeFino = { style: BorderStyle.SINGLE, size: 4, color: '000000' }
  const bordesCelda = { top: bordeFino, bottom: bordeFino, left: bordeFino, right: bordeFino }

  const celdaEquipos = (texto: string, ancho: number, opts: { header?: boolean } = {}) =>
    new TableCell({
      width: { size: ancho, type: WidthType.DXA },
      borders: bordesCelda,
      verticalAlign: VerticalAlign.CENTER,
      shading: opts.header
        ? { type: ShadingType.CLEAR, fill: 'E7E6E6', color: 'auto' }
        : undefined,
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: texto, bold: true, size: 22 })],
        }),
      ],
    })

  const filaEquipo = (f: MemoEquipoFila) =>
    new TableRow({
      children: [
        celdaEquipos(f.caracteristica, COLS_EQUIPOS[0]),
        celdaEquipos(f.modelo, COLS_EQUIPOS[1]),
        celdaEquipos(f.marca, COLS_EQUIPOS[2]),
        celdaEquipos(f.serie, COLS_EQUIPOS[3]),
      ],
    })

  const filaExtra = (texto: string) =>
    new TableRow({
      children: [
        celdaEquipos(texto, COLS_EQUIPOS[0]),
        celdaEquipos('', COLS_EQUIPOS[1]),
        celdaEquipos('N/A', COLS_EQUIPOS[2]),
        celdaEquipos('N/A', COLS_EQUIPOS[3]),
      ],
    })

  const tablaEquipos = new Table({
    width: { size: ANCHO_TABLA, type: WidthType.DXA },
    columnWidths: COLS_EQUIPOS,
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          celdaEquipos('Características', COLS_EQUIPOS[0], { header: true }),
          celdaEquipos('Modelo', COLS_EQUIPOS[1], { header: true }),
          celdaEquipos('Marca', COLS_EQUIPOS[2], { header: true }),
          celdaEquipos('Serie', COLS_EQUIPOS[3], { header: true }),
        ],
      }),
      ...datos.equipos.map(filaEquipo),
      ...datos.extras.filter((e) => e.trim()).map((e) => filaExtra(e.trim())),
    ],
  })

  const celdaFirma = (lineas: string[]) =>
    new TableCell({
      width: { size: COL_FIRMA, type: WidthType.DXA },
      borders: bordesCelda,
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      children: lineas.map(
        (l) =>
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 60 },
            children: [new TextRun({ text: l, size: 22 })],
          })
      ),
    })

  const tablaFirmas = new Table({
    width: { size: ANCHO_TABLA, type: WidthType.DXA },
    columnWidths: [COL_FIRMA, COL_FIRMA, COL_FIRMA, COL_FIRMA],
    rows: [
      new TableRow({
        children: [
          celdaFirma(['', '', 'F.']),
          celdaFirma(['', '', 'F.']),
          celdaFirma(['', '', 'F.']),
          celdaFirma(['', '', 'F.']),
        ],
      }),
      new TableRow({
        children: [
          celdaFirma(['Autorizado Por:', datos.autorizado1]),
          celdaFirma(['Autorizado por:', datos.autorizado2]),
          celdaFirma(['Revisado Protección de activos Cd F&V']),
          celdaFirma(['Revisado Seguridad CD F&V']),
        ],
      }),
    ],
  })

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: 'Calibri', size: 22 } },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 }, // A4, igual que la plantilla
            margin: { top: 851, right: 851, bottom: 1134, left: 851 },
          },
        },
        children: [
          new Paragraph({
            spacing: { after: 240 },
            children: [
              new TextRun({ text: 'Memorando', size: 72, characterSpacing: -90 }),
            ],
          }),
          lineaEncabezado(`PARA: ${datos.para}`),
          lineaEncabezado(`DE: ${datos.de}`),
          lineaEncabezado(`CC: ${datos.cc}`),
          lineaEncabezado(`Fecha: ${datos.fecha}`),
          lineaEncabezado(`ASUNTO: ${datos.asunto}`),
          new Paragraph({
            spacing: { after: 240 },
            children: [new TextRun({ text: datos.cuerpo, size: 22 })],
          }),
          tablaEquipos,
          new Paragraph({ spacing: { after: 480 }, children: [] }),
          tablaFirmas,
          new Paragraph({ spacing: { before: 240 }, children: [] }),
          new Paragraph({ children: [new TextRun({ text: 'CC. Seguridad', size: 22 })] }),
        ],
      },
    ],
  })

  return Packer.toBlob(doc)
}

/** Genera el memorando y lo descarga de una vez. */
export async function descargarMemoDocx(datos: MemoDatos) {
  const blob = await generarMemoBlob(datos)
  descargarBlob(blob, nombreArchivoMemo(datos))
}
