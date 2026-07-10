import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'

interface ExcelImportProps {
  /** Nombre(s) de hoja a buscar dentro del libro, en orden de preferencia */
  sheetNames: string[]
  /** Fila (1-indexed) donde empiezan los datos reales (después de encabezados) */
  startRow: number
  /** Convierte una fila cruda de la hoja a un objeto tipado, o null si se debe ignorar */
  mapRow: (row: Record<string, unknown>) => Record<string, unknown> | null
  /** Se llama con las filas mapeadas para mostrar la vista previa */
  onParsed: (rows: Record<string, unknown>[]) => void
}

/**
 * Botón + input de archivo que lee un .xlsx/.xlsm en el navegador (SheetJS),
 * localiza la hoja correspondiente y devuelve las filas ya mapeadas.
 * No sube nada a ningún servidor: todo el parseo ocurre en el cliente.
 */
export default function ExcelImportButton({ sheetNames, startRow, mapRow, onParsed }: ExcelImportProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setFileName(file.name)

    try {
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array', cellDates: true })

      const sheetName = sheetNames.find((n) => wb.SheetNames.includes(n))
      if (!sheetName) {
        setError(
          `No se encontró ninguna hoja llamada ${sheetNames.map((n) => `"${n}"`).join(' / ')} en el archivo. Hojas disponibles: ${wb.SheetNames.join(', ')}`
        )
        return
      }

      const ws = wb.Sheets[sheetName]
      const raw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, {
        header: 'A',
        range: startRow - 1,
        defval: '',
      })

      const mapped = raw
        .map((row) => mapRow(row))
        .filter((row): row is Record<string, unknown> => row !== null)

      onParsed(mapped)
    } catch (err) {
      setError('No se pudo leer el archivo. ¿Es un .xlsx o .xlsm válido?')
      console.error(err)
    } finally {
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xlsm,.xls"
        onChange={handleFile}
        className="hidden"
        id="excel-import-input"
      />
      <label htmlFor="excel-import-input" className="btn-secondary cursor-pointer">
        📤 Importar desde Excel
      </label>
      {fileName && <p className="mt-1 text-xs text-slate-400">Archivo: {fileName}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}
