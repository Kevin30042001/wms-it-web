import { useEffect, useMemo, useState } from 'react'
import { Plus, Download, Pencil, ClipboardList, CircleCheck, Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import Modal from '@/components/Modal'
import FallaForm from '@/components/FallaForm'
import CerrarFallaModal from '@/components/CerrarFallaModal'
import { exportToExcel } from '@/lib/excelExport'
import type { Equipo, EstadoFalla, Falla, PrioridadFalla, TipoEquipo, UsuarioResumen } from '@/types/database'

const PRIORIDAD_ESTILO: Record<PrioridadFalla, string> = {
  CRÍTICA: 'bg-red-50 text-estado-fuera',
  ALTA: 'bg-orange-50 text-estado-reparacion',
  MEDIA: 'bg-amber-50 text-amber-600',
  BAJA: 'bg-green-50 text-estado-operativo',
}

const ESTADO_FALLA_ESTILO: Record<EstadoFalla, string> = {
  Reportada: 'bg-red-50 text-estado-fuera',
  'En diagnóstico': 'bg-amber-50 text-amber-600',
  'En reparación': 'bg-orange-50 text-estado-reparacion',
  Resuelta: 'bg-green-50 text-estado-operativo',
  Cerrada: 'bg-slate-100 text-slate-500',
  Irreparable: 'bg-slate-800 text-white',
}

const ESTADOS_ACTUALIZABLES: EstadoFalla[] = ['Reportada', 'En diagnóstico', 'En reparación']

export default function Fallas() {
  const [fallas, setFallas] = useState<Falla[]>([])
  const [equipos, setEquipos] = useState<Equipo[]>([])
  const [tipos, setTipos] = useState<TipoEquipo[]>([])
  const [usuarios, setUsuarios] = useState<UsuarioResumen[]>([])
  const [loading, setLoading] = useState(true)

  const [filtroEstado, setFiltroEstado] = useState('')
  const [busqueda, setBusqueda] = useState('')

  const [formOpen, setFormOpen] = useState(false)
  const [cerrarFalla, setCerrarFalla] = useState<Falla | null>(null)
  const [detalleFalla, setDetalleFalla] = useState<Falla | null>(null)
  const [actualizarFalla, setActualizarFalla] = useState<Falla | null>(null)

  async function cargar() {
    setLoading(true)
    const [fRes, eRes, tRes, uRes] = await Promise.all([
      supabase.from('fallas').select('*').order('fecha_reporte', { ascending: false }),
      supabase.from('equipos').select('*'),
      supabase.from('tipos_equipo').select('*'),
      supabase.from('v_usuarios_resumen').select('*').order('nombre_completo'),
    ])
    if (fRes.data) setFallas(fRes.data as Falla[])
    if (eRes.data) setEquipos(eRes.data as Equipo[])
    if (tRes.data) setTipos(tRes.data as TipoEquipo[])
    if (uRes.data) setUsuarios(uRes.data as UsuarioResumen[])
    setLoading(false)
  }

  useEffect(() => {
    cargar()
    const channel = supabase
      .channel('fallas-cambios')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fallas' }, cargar)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const equipoPorId = useMemo(() => new Map(equipos.map((e) => [e.id, e])), [equipos])
  const tipoPorId = useMemo(() => new Map(tipos.map((t) => [t.id, t])), [tipos])
  const usuarioPorId = useMemo(() => new Map(usuarios.map((u) => [u.id, u])), [usuarios])

  const filtradas = fallas.filter((f) => {
    const eq = equipoPorId.get(f.equipo_id ?? '')
    const texto = `${f.codigo ?? ''} ${eq?.serie ?? ''} ${f.problema}`.toLowerCase()
    if (busqueda && !texto.includes(busqueda.toLowerCase())) return false
    if (filtroEstado && f.estado !== filtroEstado) return false
    return true
  })

  async function actualizarEstado(falla: Falla, nuevoEstado: EstadoFalla) {
    await supabase.from('fallas').update({ estado: nuevoEstado }).eq('id', falla.id)
    setActualizarFalla(null)
    cargar()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Reporte de fallas</h1>
          <p className="page-sub">Registro y seguimiento de equipos dañados</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() =>
              exportToExcel(
                fallas.map((f) => {
                  const eq = equipoPorId.get(f.equipo_id ?? '')
                  const tipo = tipoPorId.get(eq?.tipo_equipo_id ?? '')
                  return {
                    ID: f.codigo,
                    Fecha: f.fecha_reporte,
                    'S/N': eq?.serie,
                    Modelo: tipo?.modelo,
                    Problema: f.problema,
                    Prioridad: f.prioridad,
                    Estado: f.estado,
                    'Fecha Resolución': f.fecha_resolucion,
                    Solución: f.solucion,
                  }
                }),
                'Fallas',
                'Reporte_Fallas_WMS-IT'
              )
            }
            className="btn-secondary"
          >
            <Download size={15} /> Exportar
          </button>
          <button onClick={() => setFormOpen(true)} className="btn-primary">
            <Plus size={15} /> Nueva falla
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative max-w-xs flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input !pl-9"
            placeholder="Buscar por S/N, ID o problema"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <select className="input max-w-[200px]" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          {Object.keys(ESTADO_FALLA_ESTILO).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="card overflow-x-auto p-0">
        {loading ? (
          <p className="p-4 text-sm text-slate-400">Cargando…</p>
        ) : filtradas.length === 0 ? (
          <p className="p-4 text-sm text-slate-400">No hay fallas registradas con ese filtro.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-3 text-left">ID</th>
                <th className="px-3 py-3 text-left">Fecha</th>
                <th className="px-3 py-3 text-left">S/N</th>
                <th className="px-3 py-3 text-left">Problema</th>
                <th className="px-3 py-3 text-left">Prioridad</th>
                <th className="px-3 py-3 text-left">Estado</th>
                <th className="px-3 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtradas.map((f) => {
                const eq = equipoPorId.get(f.equipo_id ?? '')
                const cerrada = ['Resuelta', 'Cerrada', 'Irreparable'].includes(f.estado)
                return (
                  <tr key={f.id}>
                    <td className="px-3 py-2.5">
                      <span className="tag-id">{f.codigo ?? '—'}</span>
                    </td>
                    <td className="px-3 py-2.5 text-slate-500">
                      {new Date(f.fecha_reporte).toLocaleDateString('es-SV')}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-slate-700">{eq?.serie ?? '—'}</td>
                    <td className="max-w-xs truncate px-3 py-2.5 text-slate-600" title={f.problema}>
                      {f.problema}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`badge ${PRIORIDAD_ESTILO[f.prioridad]}`}>{f.prioridad}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`badge ${ESTADO_FALLA_ESTILO[f.estado]}`}>{f.estado}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => setDetalleFalla(f)}
                          className="btn-secondary btn-icon"
                          title="Ver detalle"
                          aria-label="Ver detalle"
                        >
                          <ClipboardList size={14} />
                        </button>
                        {!cerrada && (
                          <>
                            <button
                              onClick={() => setActualizarFalla(f)}
                              className="btn-secondary btn-icon"
                              title="Actualizar estado"
                              aria-label="Actualizar estado"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => setCerrarFalla(f)}
                              className="btn-primary btn-icon"
                              title="Cerrar falla"
                              aria-label="Cerrar falla"
                            >
                              <CircleCheck size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {formOpen && (
        <FallaForm
          equipoPreseleccionado={null}
          equipos={equipos}
          tipos={tipos}
          usuarios={usuarios}
          onClose={() => setFormOpen(false)}
          onSaved={cargar}
        />
      )}

      {cerrarFalla && (
        <CerrarFallaModal falla={cerrarFalla} onClose={() => setCerrarFalla(null)} onSaved={cargar} />
      )}

      {detalleFalla && (
        <Modal title={`Detalle — ${detalleFalla.codigo}`} onClose={() => setDetalleFalla(null)}>
          {(() => {
            const eq = equipoPorId.get(detalleFalla.equipo_id ?? '')
            const tipo = tipoPorId.get(eq?.tipo_equipo_id ?? '')
            const reportante = usuarioPorId.get(detalleFalla.reportado_por ?? '')
            const tecnico = usuarioPorId.get(detalleFalla.tecnico_asignado ?? '')
            return (
              <div className="space-y-2 text-sm">
                <p>
                  <span className="text-slate-500">Fecha:</span>{' '}
                  {new Date(detalleFalla.fecha_reporte).toLocaleString('es-SV')}
                </p>
                <p>
                  <span className="text-slate-500">S/N:</span> {eq?.serie ?? '—'}
                </p>
                <p>
                  <span className="text-slate-500">Modelo:</span> {tipo?.tipo} {tipo?.modelo}
                </p>
                <p>
                  <span className="text-slate-500">Problema:</span> {detalleFalla.problema}
                </p>
                <p>
                  <span className="text-slate-500">Reportó:</span> {reportante?.nombre_completo ?? '—'}
                </p>
                <p>
                  <span className="text-slate-500">Técnico asignado:</span> {tecnico?.nombre_completo ?? '—'}
                </p>
                <p>
                  <span className="text-slate-500">Prioridad:</span>{' '}
                  <span className={`badge ${PRIORIDAD_ESTILO[detalleFalla.prioridad]}`}>
                    {detalleFalla.prioridad}
                  </span>
                </p>
                <p>
                  <span className="text-slate-500">Estado:</span>{' '}
                  <span className={`badge ${ESTADO_FALLA_ESTILO[detalleFalla.estado]}`}>
                    {detalleFalla.estado}
                  </span>
                </p>
                {detalleFalla.solucion && (
                  <p>
                    <span className="text-slate-500">Solución:</span> {detalleFalla.solucion}
                  </p>
                )}
              </div>
            )
          })()}
        </Modal>
      )}

      {actualizarFalla && (
        <Modal title="Actualizar estado" onClose={() => setActualizarFalla(null)}>
          <div className="space-y-2">
            {ESTADOS_ACTUALIZABLES.map((estado) => (
              <button
                key={estado}
                onClick={() => actualizarEstado(actualizarFalla, estado)}
                className={`btn w-full justify-start ${
                  actualizarFalla.estado === estado ? 'bg-wmblue text-white' : 'btn-secondary'
                }`}
              >
                {estado}
              </button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  )
}
