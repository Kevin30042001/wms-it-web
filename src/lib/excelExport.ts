// Exportación a Excel. SheetJS se carga dinámicamente (import()) para no
// engordar el bundle inicial de la app.

export async function exportToExcel(
  rows: Record<string, unknown>[],
  sheetName: string,
  fileBaseName: string
) {
  const XLSX = await import('xlsx')
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  XLSX.writeFile(wb, `${fileBaseName}_${fecha}.xlsx`)
}

/** Exporta varias hojas en un solo libro: [{ name, rows }, ...] */
export async function exportMultiSheetExcel(
  sheets: { name: string; rows: Record<string, unknown>[] }[],
  fileBaseName: string
) {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  for (const s of sheets) {
    const ws = XLSX.utils.json_to_sheet(s.rows)
    XLSX.utils.book_append_sheet(wb, ws, s.name)
  }
  const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  XLSX.writeFile(wb, `${fileBaseName}_${fecha}.xlsx`)
}
