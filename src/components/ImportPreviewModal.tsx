import { useState } from 'react'
import Modal from '@/components/Modal'

interface ImportPreviewModalProps {
  title: string
  rows: Record<string, unknown>[]
  columns: { key: string; label: string }[]
  onClose: () => void
  onConfirm: (rows: Record<string, unknown>[]) => Promise<void>
}

export default function ImportPreviewModal({
  title,
  rows,
  columns,
  onClose,
  onConfirm,
}: ImportPreviewModalProps) {
  const [importing, setImporting] = useState(false)
  const [done, setDone] = useState<{ ok: number; fail: number } | null>(null)

  async function handleConfirm() {
    setImporting(true)
    try {
      await onConfirm(rows)
      setDone({ ok: rows.length, fail: 0 })
    } catch (e) {
      console.error(e)
      setDone({ ok: 0, fail: rows.length })
    } finally {
      setImporting(false)
    }
  }

  return (
    <Modal title={title} onClose={onClose} wide>
      {done ? (
        <div className="text-center py-6">
          <p className="text-2xl mb-2">{done.fail === 0 ? '✅' : '⚠️'}</p>
          <p className="text-sm text-slate-600">
            {done.fail === 0
              ? `${done.ok} registro(s) importado(s) correctamente.`
              : `Ocurrió un error durante la importación. Revisa la consola o intenta de nuevo.`}
          </p>
          <button onClick={onClose} className="btn-primary mt-4">
            Cerrar
          </button>
        </div>
      ) : (
        <>
          <p className="mb-3 text-sm text-slate-500">
            Se encontraron <strong>{rows.length}</strong> registro(s) en el archivo. Revisa antes de
            importar — esto insertará filas nuevas, no reemplaza lo que ya existe.
          </p>
          <div className="max-h-80 overflow-auto rounded-lg border border-slate-200">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-50">
                <tr>
                  {columns.map((c) => (
                    <th key={c.key} className="px-2 py-1.5 text-left font-semibold text-slate-500">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.slice(0, 100).map((row, i) => (
                  <tr key={i}>
                    {columns.map((c) => (
                      <td key={c.key} className="px-2 py-1.5 text-slate-700">
                        {String(row[c.key] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 100 && (
            <p className="mt-1 text-xs text-slate-400">Mostrando 100 de {rows.length} filas.</p>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={onClose} className="btn-secondary">
              Cancelar
            </button>
            <button onClick={handleConfirm} disabled={importing || rows.length === 0} className="btn-primary">
              {importing ? 'Importando…' : `Importar ${rows.length} registro(s)`}
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}
