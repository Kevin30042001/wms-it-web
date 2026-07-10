import { useState, type FormEvent } from 'react'
import Modal from '@/components/Modal'
import { supabase } from '@/lib/supabase'
import type { Falla } from '@/types/database'

interface CerrarFallaModalProps {
  falla: Falla
  onClose: () => void
  onSaved: () => void
}

export default function CerrarFallaModal({ falla, onClose, onSaved }: CerrarFallaModalProps) {
  const [resultado, setResultado] = useState<'Resuelta' | 'Irreparable'>('Resuelta')
  const [solucion, setSolucion] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!solucion.trim()) {
      setError('Describe la solución aplicada.')
      return
    }

    setSaving(true)
    const { error: dbError } = await supabase
      .from('fallas')
      .update({
        estado: resultado,
        fecha_resolucion: new Date().toISOString().slice(0, 10),
        solucion: solucion.trim(),
      })
      .eq('id', falla.id)
    setSaving(false)

    if (dbError) {
      setError(dbError.message)
      return
    }

    onSaved()
    onClose()
  }

  return (
    <Modal title={`Cerrar falla ${falla.codigo ?? ''}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">¿El equipo quedó operativo?</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setResultado('Resuelta')}
              className={`btn flex-1 justify-center ${
                resultado === 'Resuelta' ? 'bg-estado-operativo text-white' : 'btn-secondary'
              }`}
            >
              ✅ Sí, Operativo
            </button>
            <button
              type="button"
              onClick={() => setResultado('Irreparable')}
              className={`btn flex-1 justify-center ${
                resultado === 'Irreparable' ? 'bg-estado-fuera text-white' : 'btn-secondary'
              }`}
            >
              ❌ No, Fuera de servicio
            </button>
          </div>
        </div>

        <div>
          <label className="label">Solución aplicada *</label>
          <textarea
            className="input"
            rows={3}
            value={solucion}
            onChange={(e) => setSolucion(e.target.value)}
            placeholder="Ej: Cambio de batería, reconfiguración de red…"
            autoFocus
          />
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancelar
          </button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Guardando…' : 'Cerrar falla'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
