import { useState, type FormEvent } from 'react'
import Modal from '@/components/Modal'
import { supabase } from '@/lib/supabase'
import type { CentroDistribucion, Equipo, EstadoEquipo, TipoEquipo, UsuarioResumen } from '@/types/database'

interface EquipoFormProps {
  equipo: Equipo | null // null = modo NUEVO
  tipos: TipoEquipo[]
  usuarios: UsuarioResumen[]
  centros: CentroDistribucion[]
  onClose: () => void
  onSaved: () => void
}

const ESTADOS: EstadoEquipo[] = [
  'Operativo',
  'En reparación',
  'Fuera de servicio',
  'En bodega',
  'Reportado con falla',
]

export default function EquipoForm({ equipo, tipos, usuarios, centros, onClose, onSaved }: EquipoFormProps) {
  const [tipoEquipoId, setTipoEquipoId] = useState(equipo?.tipo_equipo_id ?? tipos[0]?.id ?? '')
  const [serie, setSerie] = useState(equipo?.serie ?? '')
  const [pn, setPn] = useState(equipo?.pn ?? '')
  const [usuarioId, setUsuarioId] = useState(equipo?.usuario_id ?? '')
  const [cdId, setCdId] = useState(equipo?.cd_id ?? centros[0]?.id ?? '')
  const [estado, setEstado] = useState<EstadoEquipo>(equipo?.estado ?? 'Operativo')
  const [fechaIngreso, setFechaIngreso] = useState(equipo?.fecha_ingreso ?? new Date().toISOString().slice(0, 10))
  const [observaciones, setObservaciones] = useState(equipo?.observaciones ?? '')
  const [mantenerParaSiguiente, setMantenerParaSiguiente] = useState(false)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [duplicado, setDuplicado] = useState(false)

  const tipoSeleccionado = tipos.find((t) => t.id === tipoEquipoId)
  const llevaUsuario = tipoSeleccionado?.lleva_usuario ?? true

  async function checkDuplicado(sn: string) {
    if (!sn.trim() || sn === equipo?.serie) {
      setDuplicado(false)
      return
    }
    const { data } = await supabase.from('equipos').select('id').eq('serie', sn.trim()).maybeSingle()
    setDuplicado(!!data)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!serie.trim()) {
      setError('El S/N es obligatorio.')
      return
    }
    if (duplicado) {
      setError('Ese S/N ya existe en el inventario.')
      return
    }

    setSaving(true)
    const payload = {
      tipo_equipo_id: tipoEquipoId || null,
      marca: tipoSeleccionado?.marca ?? null,
      modelo: tipoSeleccionado?.modelo ?? null,
      serie: serie.trim(),
      pn: pn.trim() || null,
      usuario_id: llevaUsuario && usuarioId ? usuarioId : null,
      cd_id: cdId || null,
      estado,
      fecha_ingreso: fechaIngreso,
      observaciones: observaciones.trim() || null,
    }

    const { error: dbError } = equipo
      ? await supabase.from('equipos').update(payload).eq('id', equipo.id)
      : await supabase.from('equipos').insert(payload)

    setSaving(false)

    if (dbError) {
      setError(dbError.message.includes('duplicate') ? 'Ese S/N ya existe.' : dbError.message)
      return
    }

    onSaved()

    if (!equipo && mantenerParaSiguiente) {
      // Ingreso masivo / escaneo: limpiar solo S/N y P/N, mantener el resto
      setSerie('')
      setPn('')
      setDuplicado(false)
    } else {
      onClose()
    }
  }

  return (
    <Modal title={equipo ? 'Editar equipo' : 'Agregar equipo'} onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Tipo / Modelo *</label>
            <select
              className="input"
              value={tipoEquipoId}
              onChange={(e) => setTipoEquipoId(e.target.value)}
            >
              {tipos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.tipo} — {t.modelo}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Estado</label>
            <select className="input" value={estado} onChange={(e) => setEstado(e.target.value as EstadoEquipo)}>
              {ESTADOS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">S/N (Número de Serie) *</label>
            <input
              className="input font-mono"
              value={serie}
              autoFocus
              onChange={(e) => setSerie(e.target.value)}
              onBlur={(e) => checkDuplicado(e.target.value)}
              placeholder="Escanea o escribe el S/N"
            />
            {duplicado && <p className="mt-1 text-xs text-red-600">⚠️ Ese S/N ya existe en inventario.</p>}
          </div>
          <div>
            <label className="label">P/N (opcional)</label>
            <input className="input font-mono" value={pn} onChange={(e) => setPn(e.target.value)} />
          </div>
        </div>

        {llevaUsuario && (
          <div>
            <label className="label">Usuario asignado</label>
            <select className="input" value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)}>
              <option value="">— Sin asignar —</option>
              {usuarios
                .filter((u) => u.activo)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre_completo} {u.numero_usuario ? `(${u.numero_usuario})` : ''}
                  </option>
                ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">CD / Ubicación</label>
            <select className="input" value={cdId} onChange={(e) => setCdId(e.target.value)}>
              {centros.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Fecha de ingreso</label>
            <input
              type="date"
              className="input"
              value={fechaIngreso}
              onChange={(e) => setFechaIngreso(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="label">Observaciones</label>
          <textarea
            className="input"
            rows={2}
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
          />
        </div>

        {!equipo && (
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={mantenerParaSiguiente}
              onChange={(e) => setMantenerParaSiguiente(e.target.checked)}
            />
            Mantener datos para el siguiente (ingreso masivo / escaneo)
          </label>
        )}

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancelar
          </button>
          <button type="submit" disabled={saving || duplicado} className="btn-primary">
            {saving ? 'Guardando…' : mantenerParaSiguiente && !equipo ? 'Guardar y continuar' : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
