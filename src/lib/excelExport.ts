import * as XLSX from 'xlsx'

/**
 * Descarga un array de objetos como archivo .xlsx (una sola hoja).
 * Uso: exportToExcel(equipos, 'Inventario', 'Inventario_WMS-IT')
 */
export function exportToExcel(
  rows: Record<string, unknown>[],
  sheetName: string,
  fileBaseName: string
) {
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  XLSX.writeFile(wb, `${fileBaseName}_${fecha}.xlsx`)
}

/** Exporta varias hojas en un solo libro: [{ name, rows }, ...] */
export function exportMultiSheetExcel(
  sheets: { name: string; rows: Record<string, unknown>[] }[],
  fileBaseName: string
) {
  const wb = XLSX.utils.book_new()
  for (const s of sheets) {
    const ws = XLSX.utils.json_to_sheet(s.rows)
    XLSX.utils.book_append_sheet(wb, ws, s.name)
  }
  const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  XLSX.writeFile(wb, `${fileBaseName}_${fecha}.xlsx`)
}
