// Exportación a Excel con formato profesional (encabezados con color,
// bordes, filtros, columnas auto-ajustadas y fila de encabezado congelada).
// Usa xlsx-js-style (fork de SheetJS con soporte de estilos), cargado
// dinámicamente para no engordar el bundle inicial.

const AZUL_MARCA = '0B1220' // mismo azul del tema de la app
const GRIS_CLARO = 'F1F5F9'

type Fila = Record<string, unknown>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function hojaConEstilo(XLSX: any, rows: Fila[]) {
  const ws = XLSX.utils.json_to_sheet(rows)
  if (rows.length === 0) return ws

  const headers = Object.keys(rows[0])
  const nFilas = rows.length + 1 // + encabezado

  const bordeFino = {
    top: { style: 'thin', color: { rgb: 'CBD5E1' } },
    bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
    left: { style: 'thin', color: { rgb: 'CBD5E1' } },
    right: { style: 'thin', color: { rgb: 'CBD5E1' } },
  }

  // Estilo de encabezados
  headers.forEach((_, c) => {
    const ref = XLSX.utils.encode_cell({ r: 0, c })
    if (!ws[ref]) return
    ws[ref].s = {
      font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
      fill: { patternType: 'solid', fgColor: { rgb: AZUL_MARCA } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: bordeFino,
    }
  })

  // Estilo de datos: bordes + zebra
  for (let r = 1; r < nFilas; r++) {
    for (let c = 0; c < headers.length; c++) {
      const ref = XLSX.utils.encode_cell({ r, c })
      if (!ws[ref]) continue
      ws[ref].s = {
        border: bordeFino,
        alignment: { vertical: 'center' },
        fill:
          r % 2 === 0
            ? { patternType: 'solid', fgColor: { rgb: GRIS_CLARO } }
            : undefined,
      }
    }
  }

  // Ancho de columnas según el contenido (con mínimo y máximo razonables)
  ws['!cols'] = headers.map((h, c) => {
    let max = h.length
    for (const row of rows) {
      const len = String(row[h] ?? '').length
      if (len > max) max = len
    }
    return { wch: Math.min(Math.max(max + 2, 10), 40) }
  })

  // Filtro automático + congelar fila de encabezado
  ws['!autofilter'] = {
    ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: nFilas - 1, c: headers.length - 1 } }),
  }
  ws['!freeze'] = { xSplit: 0, ySplit: 1 }

  // Altura de la fila de encabezado
  ws['!rows'] = [{ hpt: 22 }]

  return ws
}

export async function exportToExcel(rows: Fila[], sheetName: string, fileBaseName: string) {
  const XLSX = await import('xlsx-js-style')
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, hojaConEstilo(XLSX, rows), sheetName)
  const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  XLSX.writeFile(wb, `${fileBaseName}_${fecha}.xlsx`)
}

/** Exporta varias hojas en un solo libro: [{ name, rows }, ...] */
export async function exportMultiSheetExcel(
  sheets: { name: string; rows: Fila[] }[],
  fileBaseName: string
) {
  const XLSX = await import('xlsx-js-style')
  const wb = XLSX.utils.book_new()
  for (const s of sheets) {
    XLSX.utils.book_append_sheet(wb, hojaConEstilo(XLSX, s.rows), s.name)
  }
  const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  XLSX.writeFile(wb, `${fileBaseName}_${fecha}.xlsx`)
}
