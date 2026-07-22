import { useMemo, useState, type FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { useUI } from '@/hooks/useUI'
import Modal from '@/components/Modal'
import type { CentroDistribucion, Equipo, UsuarioResumen } from '@/types/database'

// ── Formulario de nueva transferencia ────────────────────────────
export default function TransferForm({
  equipos,
  centros,
  usuarios,
  onClose,
  onSaved,
  equipoPreseleccionado,
}: {
  equipos: Equipo[]
  centros: CentroDistribucion[]
  usuarios: UsuarioResumen[]
  onClose: () => void
  onSaved: () => void
  /** Cuando viene de una fila específica de Inventario: fija el equipo por su
   * id real (nunca por posición/índice) y bloquea el buscador para que no se
   * pueda cambiar por accidente a otro equipo. */
  equipoPreseleccionado?: Equipo
}) {
  const { toast } = useUI()
  const [busquedaSN, setBusquedaSN] = useState(equipoPreseleccionado?.serie ?? '')
  const [equipoId, setEquipoId] = useState(equipoPreseleccionado?.id ?? '')
  const [cdDestino, setCdDestino] = useState('')
  const [responsable, setResponsable] = useState('')
  const [motivo, setMotivo] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const equipoSel = equipos.find((e) => e.id === equipoId)
  const centroPorId = useMemo(() => new Map(centros.map((c) => [c.id, c])), [centros])

  const sugerencias = useMemo(() => {
    if (!busquedaSN.trim() || equipoId) return []
    const q = busquedaSN.toLowerCase()
    return equipos
      .filter((e) => e.estado !== 'Transferido' && e.serie.toLowerCase().includes(q))
      .slice(0, 6)
  }, [busquedaSN, equipoId, equipos])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!equipoId) {
      setError('Selecciona el equipo por su S/N.')
      return
    }
    if (!cdDestino) {
      setError('Selecciona el CD destino.')
      return
    }
    if (cdDestino === equipoSel?.cd_id) {
      setError('El destino no puede ser el mismo CD donde está el equipo.')
      return
    }
    setSaving(true)
    const { error: dbError } = await supabase.from('transferencias').insert({
      equipo_id: equipoId,
      cd_origen_id: equipoSel?.cd_id ?? null,
      cd_destino_id: cdDestino,
      responsable_id: responsable || null,
      motivo: motivo.trim() || null,
    })
    setSaving(false)
    if (dbError) {
      setError(dbError.message)
      return
    }
    toast('success', `Transferencia creada. El equipo ${equipoSel?.serie} quedó En tránsito.`)
    onSaved()
    onClose()
  }

  return (
    <Modal
      title={equipoPreseleccionado ? `Transferir equipo ${equipoPreseleccionado.serie}` : 'Nueva transferencia'}
      onClose={onClose}
      wide
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <label className="label">S/N del equipo *</label>
          <input
            className="input font-mono disabled:bg-slate-50 disabled:text-slate-500"
            value={busquedaSN}
            autoFocus={!equipoPreseleccionado}
            disabled={!!equipoPreseleccionado}
            onChange={(e) => {
              setBusquedaSN(e.target.value)
              setEquipoId('')
            }}
            placeholder="Escribe o escanea el S/N…"
          />
          {equipoPreseleccionado && (
            <p className="mt-1 text-xs text-slate-400">
              Equipo fijado desde la fila seleccionada — no puede cambiarse aquí.
            </p>
          )}
          {!equipoPreseleccionado && sugerencias.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-pop">
              {sugerencias.map((eq) => (
                <li key={eq.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50"
                    onClick={() => {
                      setEquipoId(eq.id)
                      setBusquedaSN(eq.serie)
                    }}
                  >
                    <span className="font-mono text-xs">{eq.serie}</span>
                    <span className="text-xs text-slate-400">
                      {centroPorId.get(eq.cd_id ?? '')?.nombre ?? 'Sin CD'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {equipoSel && (
            <p className="mt-1 text-xs text-slate-500">
              Origen: <strong>{centroPorId.get(equipoSel.cd_id ?? '')?.nombre ?? 'Sin CD'}</strong>
              {' '}· Estado: {equipoSel.estado}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">CD destino *</label>
            <select className="input" value={cdDestino} onChange={(e) => setCdDestino(e.target.value)}>
              <option value="">— Seleccionar —</option>
              {centros
                .filter((c) => c.id !== equipoSel?.cd_id)
                .map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
            </select>
          </div>
          <div>
            <label className="label">Responsable del envío</label>
            <select className="input" value={responsable} onChange={(e) => setResponsable(e.target.value)}>
              <option value="">— Seleccionar —</option>
              {usuarios.filter((u) => u.activo).map((u) => (
                <option key={u.id} value={u.id}>{u.nombre_completo}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="label">Motivo</label>
          <textarea
            className="input"
            rows={2}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej: Refuerzo de equipos para temporada alta"
          />
        </div>

        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Creando…' : 'Crear transferencia'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

