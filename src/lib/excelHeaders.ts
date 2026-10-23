// ═══════════════════════════════════════════════════════════════
// Helpers para leer un Excel "por nombre de encabezado" en vez de
// por letra de columna fija (A, B, C...). Así el import no se rompe
// si alguien reordena o agrega columnas en el archivo de origen.
// ═══════════════════════════════════════════════════════════════

/** Quita tildes, pasa a minúsculas y recorta espacios de más, para que
 *  "N° Usuario", " n° usuario " y "N° USUARIO" se consideren el mismo
 *  encabezado al compararlos. */
export function normalizeHeader(text: unknown): string {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

/** A partir de la fila cruda de encabezados (clave = letra de columna,
 *  tal como la devuelve SheetJS con `header: 'A'`), arma un mapa
 *  texto-normalizado -> letra de columna. */
export function buildHeaderIndex(headerRow: Record<string, unknown>): Record<string, string> {
  const index: Record<string, string> = {}
  for (const [col, value] of Object.entries(headerRow)) {
    const key = normalizeHeader(value)
    if (key) index[key] = col
  }
  return index
}

export type ColumnGetter = (row: Record<string, unknown>, headerText: string) => unknown

/** Crea un getter: dada una fila de datos y el texto del encabezado tal
 *  como aparece en el Excel (sin importar acentos/mayúsculas/espacios),
 *  devuelve el valor de esa columna para esa fila. */
export function makeColumnGetter(headerIndex: Record<string, string>): ColumnGetter {
  return (row, headerText) => {
    const col = headerIndex[normalizeHeader(headerText)]
    return col ? row[col] : undefined
  }
}
