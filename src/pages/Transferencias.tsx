import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Plus, Download, CircleCheck, CircleX, Search, FileText } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { generarPDF } from '@/lib/pdf'
import { useUI } from '@/hooks/useUI'
import Modal from '@/components/Modal'
import { exportToExcel } from '@/lib/excelExport'
import type {
  CentroDistribucion,
  Equipo,
  EstadoTransferencia,
  Transferencia,
  UsuarioResumen,
} from '@/types/database'

const ESTADO_ESTILO: Record<EstadoTransferencia, string> = {
  'En tránsito': 'bg-amber-50 text-amber-700',
  Recibido: 'bg-blue-50 text-estado-bodega',
  Confirmado: 'bg-green-50 text-estado-operativo',
  Rechazado: 'bg-red-50 text-estado-fuera',
}

// ── Formulario de nueva transferencia ────────────────────────────
function TransferForm({
  equipos,
  centros,
  usuarios,
  onClose,
  onSaved,
}: {
  equipos: Equipo[]
  centros: CentroDistribucion[]
  usuarios: UsuarioResumen[]
  onClose: () => void
  onSaved: () => void
}) {
  const { toast } = useUI()
  const [busquedaSN, setBusquedaSN] = useState('')
  const [equipoId, setEquipoId] = useState('')
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
    <Modal title="Nueva transferencia" onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <label className="label">S/N del equipo *</label>
          <input
            className="input font-mono"
            value={busquedaSN}
            autoFocus
            onChange={(e) => {
              setBusquedaSN(e.target.value)
              setEquipoId('')
            }}
            placeholder="Escribe o escanea el S/N…"
          />
          {sugerencias.length > 0 && (
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

// ── Página ───────────────────────────────────────────────────────
export default function Transferencias() {
  const { toast, confirm } = useUI()
  const [transferencias, setTransferencias] = useState<Transferencia[]>([])
  const [equipos, setEquipos] = useState<Equipo[]>([])
  const [centros, setCentros] = useState<CentroDistribucion[]>([])
  const [usuarios, setUsuarios] = useState<UsuarioResumen[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [formOpen, setFormOpen] = useState(false)

  async function cargar() {
    const [tRes, eRes, cRes, uRes] = await Promise.all([
      supabase.from('transferencias').select('*').order('fecha_envio', { ascending: false }),
      supabase.from('equipos').select('*'),
      supabase.from('centros_distribucion').select('*').eq('activo', true).order('nombre'),
      supabase.from('v_usuarios_resumen').select('*').order('nombre_completo'),
    ])
    if (tRes.data) setTransferencias(tRes.data as Transferencia[])
    if (eRes.data) setEquipos(eRes.data as Equipo[])
    if (cRes.data) setCentros(cRes.data as CentroDistribucion[])
    if (uRes.data) setUsuarios(uRes.data as UsuarioResumen[])
    setLoading(false)
  }

  useEffect(() => {
    cargar()
    const channel = supabase
      .channel('transferencias-cambios')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transferencias' }, cargar)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const equipoPorId = useMemo(() => new Map(equipos.map((e) => [e.id, e])), [equipos])
  const centroPorId = useMemo(() => new Map(centros.map((c) => [c.id, c])), [centros])

  // Resumen: equipos por CD
  const resumenCD = useMemo(() => {
    const conteo = new Map<string, number>()
    for (const eq of equipos) {
      if (eq.cd_id) conteo.set(eq.cd_id, (conteo.get(eq.cd_id) ?? 0) + 1)
    }
    return centros.map((c) => ({ nombre: c.nombre, cantidad: conteo.get(c.id) ?? 0 }))
  }, [equipos, centros])

  const enTransito = transferencias.filter((t) => t.estado === 'En tránsito').length

  const filtradas = transferencias.filter((t) => {
    const eq = equipoPorId.get(t.equipo_id ?? '')
    const texto = `${t.codigo ?? ''} ${eq?.serie ?? ''} ${t.motivo ?? ''}`.toLowerCase()
    if (busqueda && !texto.includes(busqueda.toLowerCase())) return false
    if (filtroEstado && t.estado !== filtroEstado) return false
    return true
  })

  async function confirmar(t: Transferencia) {
    const eq = equipoPorId.get(t.equipo_id ?? '')
    const ok = await confirm({
      title: 'Confirmar recepción',
      message: `El equipo ${eq?.serie ?? ''} pasará al CD destino (${centroPorId.get(t.cd_destino_id ?? '')?.nombre}) y quedará Operativo.`,
      confirmLabel: 'Confirmar recepción',
    })
    if (!ok) return
    const { error } = await supabase
      .from('transferencias')
      .update({ estado: 'Confirmado', fecha_recepcion: new Date().toISOString() })
      .eq('id', t.id)
    if (error) toast('error', error.message)
    else toast('success', 'Recepción confirmada. El equipo ya está en el CD destino.')
    cargar()
  }

  async function rechazar(t: Transferencia) {
    const eq = equipoPorId.get(t.equipo_id ?? '')
    const ok = await confirm({
      title: 'Rechazar transferencia',
      message: `Se marcará como rechazada la transferencia del equipo ${eq?.serie ?? ''}. El equipo permanece en su CD de origen.`,
      confirmLabel: 'Rechazar',
      danger: true,
    })
    if (!ok) return
    // Devolver el equipo a Operativo en su CD de origen
    await supabase.from('transferencias').update({ estado: 'Rechazado' }).eq('id', t.id)
    if (t.equipo_id) {
      await supabase.from('equipos').update({ estado: 'Operativo' }).eq('id', t.equipo_id)
    }
    toast('info', 'Transferencia rechazada. El equipo volvió a Operativo en su CD de origen.')
    cargar()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Transferencias</h1>
          <p className="page-sub">
            Movimientos entre centros de distribución
            {enTransito > 0 && <> · <strong>{enTransito} en tránsito</strong></>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() =>
              exportToExcel(
                transferencias.map((t) => {
                  const eq = equipoPorId.get(t.equipo_id ?? '')
                  return {
                    ID: t.codigo,
                    'S/N': eq?.serie,
                    Origen: centroPorId.get(t.cd_origen_id ?? '')?.nombre,
                    Destino: centroPorId.get(t.cd_destino_id ?? '')?.nombre,
                    Motivo: t.motivo,
                    Estado: t.estado,
                    'Fecha envío': t.fecha_envio,
                    'Fecha recepción': t.fecha_recepcion,
                  }
                }),
                'Transferencias',
                'Transferencias_WMS-IT'
              )
            }
            className="btn-secondary"
          >
            <Download size={15} /> Exportar
          </button>
          <button
            onClick={() =>
              generarPDF({
                titulo: 'Transferencias entre CD',
                archivo: 'Transferencias',
                columnas: ['ID', 'S/N', 'Origen', 'Destino', 'Motivo', 'Estado', 'Envío', 'Recepción'],
                filas: filtradas.map((t) => {
                  const eq = equipoPorId.get(t.equipo_id ?? '')
                  return [
                    t.codigo,
                    eq?.serie,
                    centroPorId.get(t.cd_origen_id ?? '')?.nombre,
                    centroPorId.get(t.cd_destino_id ?? '')?.nombre,
                    t.motivo,
                    t.estado,
                    new Date(t.fecha_envio).toLocaleDateString('es-SV'),
                    t.fecha_recepcion ? new Date(t.fecha_recepcion).toLocaleDateString('es-SV') : null,
                  ]
                }),
              })
            }
            className="btn-secondary"
          >
            <FileText size={15} /> PDF
          </button>
          <button onClick={() => setFormOpen(true)} className="btn-primary">
            <Plus size={15} /> Nueva transferencia
          </button>
        </div>
      </div>

      {/* Resumen por CD */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {resumenCD.map((r) => (
          <div key={r.nombre} className="card">
            <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {r.nombre}
            </p>
            <p className="font-display text-2xl font-bold text-slate-900">{r.cantidad}</p>
            <p className="text-[11px] text-slate-400">equipos</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative max-w-xs flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input !pl-9"
            placeholder="Buscar por S/N, ID o motivo"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <select className="input max-w-[180px]" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          {Object.keys(ESTADO_ESTILO).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="card overflow-x-auto p-0">
        {loading ? (
          <div className="space-y-2 p-4">
            <div className="skeleton h-10" />
            <div className="skeleton h-10" />
          </div>
        ) : filtradas.length === 0 ? (
          <p className="p-4 text-sm text-slate-400">Sin transferencias registradas con ese filtro.</p>
        ) : (
          <table className="tabla">
            <thead>
              <tr>
                <th>ID</th>
                <th>S/N</th>
                <th>Origen → Destino</th>
                <th>Motivo</th>
                <th>Fecha envío</th>
                <th>Estado</th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((t) => {
                const eq = equipoPorId.get(t.equipo_id ?? '')
                const pendiente = t.estado === 'En tránsito' || t.estado === 'Recibido'
                return (
                  <tr key={t.id}>
                    <td><span className="tag-id">{t.codigo ?? '—'}</span></td>
                    <td className="font-mono text-xs text-slate-700">{eq?.serie ?? '—'}</td>
                    <td className="text-slate-600">
                      {centroPorId.get(t.cd_origen_id ?? '')?.nombre ?? '—'}
                      <span className="mx-1 text-slate-300">→</span>
                      {centroPorId.get(t.cd_destino_id ?? '')?.nombre ?? '—'}
                    </td>
                    <td className="max-w-[220px] truncate text-slate-500" title={t.motivo ?? ''}>
                      {t.motivo ?? '—'}
                    </td>
                    <td className="text-slate-500">
                      {new Date(t.fecha_envio).toLocaleDateString('es-SV')}
                    </td>
                    <td>
                      <span className={`badge ${ESTADO_ESTILO[t.estado]}`}>{t.estado}</span>
                    </td>
                    <td>
                      {pendiente && (
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => confirmar(t)}
                            className="btn-primary btn-icon"
                            title="Confirmar recepción"
                            aria-label="Confirmar recepción"
                          >
                            <CircleCheck size={14} />
                          </button>
                          <button
                            onClick={() => rechazar(t)}
                            className="btn-danger btn-icon"
                            title="Rechazar"
                            aria-label="Rechazar transferencia"
                          >
                            <CircleX size={14} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {formOpen && (
        <TransferForm
          equipos={equipos}
          centros={centros}
          usuarios={usuarios}
          onClose={() => setFormOpen(false)}
          onSaved={cargar}
        />
      )}
    </div>
  )
}
