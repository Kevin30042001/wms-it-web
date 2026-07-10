import { useMemo, useState, type FormEvent } from 'react'
import Modal from '@/components/Modal'
import { supabase } from '@/lib/supabase'
import type { Equipo, PrioridadFalla, TipoEquipo, UsuarioResumen } from '@/types/database'

interface FallaFormProps {
  equipoPreseleccionado: Equipo | null
  equipos: Equipo[]
  tipos: TipoEquipo[]
  usuarios: UsuarioResumen[]
  onClose: () => void
  onSaved: () => void
}

const PRIORIDADES: PrioridadFalla[] = ['CRÍTICA', 'ALTA', 'MEDIA', 'BAJA']

export default function FallaForm({
  equipoPreseleccionado,
  equipos,
  tipos,
  usuarios,
  onClose,
  onSaved,
}: FallaFormProps) {
  const [busquedaSN, setBusquedaSN] = useState(equipoPreseleccionado?.serie ?? '')
  const [equipoId, setEquipoId] = useState(equipoPreseleccionado?.id ?? '')
  const [problema, setProblema] = useState('')
  const [prioridad, setPrioridad] = useState<PrioridadFalla>('MEDIA')
  const [reportadoPor, setReportadoPor] = useState('')
  const [tecnicoAsignado, setTecnicoAsignado] = useState('')
  const [requiereProveedor, setRequiereProveedor] = useState(false)
  const [observaciones, setObservaciones] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tipoPorId = useMemo(() => new Map(tipos.map((t) => [t.id, t])), [tipos])

  const sugerencias = useMemo(() => {
    if (!busquedaSN.trim() || equipoId) return []
    const q = busquedaSN.toLowerCase()
    return equipos.filter((e) => e.serie.toLowerCase().includes(q)).slice(0, 6)
  }, [busquedaSN, equipoId, equipos])

  const equipoSeleccionado = equipos.find((e) => e.id === equipoId)
  const tipoEquipoSeleccionado = equipoSeleccionado
    ? tipoPorId.get(equipoSeleccionado.tipo_equipo_id ?? '')
    : null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!equipoId) {
      setError('Selecciona un equipo válido por su S/N.')
      return
    }
    if (problema.trim().length < 10) {
      setError('Describe el problema con al menos 10 caracteres.')
      return
    }

    setSaving(true)
    const { error: dbError } = await supabase.from('fallas').insert({
      equipo_id: equipoId,
      problema: problema.trim(),
      prioridad,
      reportado_por: reportadoPor || null,
      tecnico_asignado: tecnicoAsignado || null,
      requiere_proveedor: requiereProveedor,
      observaciones: observaciones.trim() || null,
    })
    setSaving(false)

    if (dbError) {
      setError(dbError.message)
      return
    }

    if (prioridad === 'CRÍTICA') {
      alert(`⚠️ ALERTA CRÍTICA\n\nSe reportó una falla CRÍTICA para el equipo S/N: ${equipoSeleccionado?.serie}.\nRequiere atención inmediata.`)
    }

    onSaved()
    onClose()
  }

  return (
    <Modal title="Reportar falla" onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <label className="label">S/N del equipo *</label>
          <input
            className="input font-mono"
            value={busquedaSN}
            autoFocus={!equipoPreseleccionado}
            onChange={(e) => {
              setBusquedaSN(e.target.value)
              setEquipoId('')
            }}
            placeholder="Escribe o escanea el S/N…"
          />
          {sugerencias.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg">
              {sugerencias.map((eq) => {
                const t = tipoPorId.get(eq.tipo_equipo_id ?? '')
                return (
                  <li key={eq.id}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50"
                      onClick={() => {
                        setEquipoId(eq.id)
                        setBusquedaSN(eq.serie)
                      }}
                    >
                      <span className="font-mono">{eq.serie}</span>
                      <span className="text-xs text-slate-400">
                        {t?.tipo} {t?.modelo}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          {equipoSeleccionado && (
            <p className="mt-1 text-xs text-slate-500">
              {tipoEquipoSeleccionado?.tipo} {tipoEquipoSeleccionado?.modelo} · Estado actual:{' '}
              <span className="font-medium">{equipoSeleccionado.estado}</span>
            </p>
          )}
        </div>

        <div>
          <label className="label">Descripción del problema * (mínimo 10 caracteres)</label>
          <textarea
            className="input"
            rows={3}
            value={problema}
            onChange={(e) => setProblema(e.target.value)}
            placeholder="Ej: Falta configurar, sin IP en sistema vocollect"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Prioridad</label>
            <select className="input" value={prioridad} onChange={(e) => setPrioridad(e.target.value as PrioridadFalla)}>
              {PRIORIDADES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={requiereProveedor}
                onChange={(e) => setRequiereProveedor(e.target.checked)}
              />
              Requiere envío a proveedor
            </label>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Reportado por</label>
            <select className="input" value={reportadoPor} onChange={(e) => setReportadoPor(e.target.value)}>
              <option value="">— Seleccionar —</option>
              {usuarios.filter((u) => u.activo).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre_completo}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Técnico asignado</label>
            <select className="input" value={tecnicoAsignado} onChange={(e) => setTecnicoAsignado(e.target.value)}>
              <option value="">— Sin asignar —</option>
              {usuarios.filter((u) => u.activo).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre_completo}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="label">Observaciones</label>
          <textarea className="input" rows={2} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancelar
          </button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Guardando…' : 'Reportar falla'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
