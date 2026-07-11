import { useEffect, useMemo, useRef, useState } from 'react'
import { ScanLine, ClipboardCheck, Zap, UserCheck, Warehouse, CircleCheck, Download } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useUI } from '@/hooks/useUI'
import { exportToExcel } from '@/lib/excelExport'
import type { Equipo, EstadoEquipo, TipoEquipo, UsuarioResumen } from '@/types/database'

const ESTADO_ESTILO: Record<EstadoEquipo, string> = {
  Operativo: 'bg-green-50 text-estado-operativo',
  'En reparación': 'bg-orange-50 text-estado-reparacion',
  'Fuera de servicio': 'bg-red-50 text-estado-fuera',
  'En bodega': 'bg-blue-50 text-estado-bodega',
  'Reportado con falla': 'bg-amber-50 text-estado-falla',
  Transferido: 'bg-slate-100 text-estado-transferido',
}

type Modo = 'rapido' | 'auditoria'

export default function Escaneo() {
  const { toast } = useUI()
  const [modo, setModo] = useState<Modo>('rapido')
  const [equipos, setEquipos] = useState<Equipo[]>([])
  const [tipos, setTipos] = useState<TipoEquipo[]>([])
  const [usuarios, setUsuarios] = useState<UsuarioResumen[]>([])
  const [sn, setSn] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Modo rápido
  const [actual, setActual] = useState<Equipo | null>(null)
  const [noEncontrado, setNoEncontrado] = useState<string | null>(null)

  // Modo auditoría
  const [auditando, setAuditando] = useState(false)
  const [escaneados, setEscaneados] = useState<Set<string>>(new Set())
  const [desconocidos, setDesconocidos] = useState<string[]>([])

  async function cargar() {
    const [eRes, tRes, uRes] = await Promise.all([
      supabase.from('equipos').select('*'),
      supabase.from('tipos_equipo').select('*'),
      supabase.from('v_usuarios_resumen').select('*').order('nombre_completo'),
    ])
    if (eRes.data) setEquipos(eRes.data as Equipo[])
    if (tRes.data) setTipos(tRes.data as TipoEquipo[])
    if (uRes.data) setUsuarios(uRes.data as UsuarioResumen[])
  }

  useEffect(() => {
    cargar()
  }, [])

  // El input SIEMPRE recupera el foco: la pistola escribe sin tocar nada
  useEffect(() => {
    const int = setInterval(() => {
      const activo = document.activeElement
      const enOtroCampo =
        activo && activo !== inputRef.current && ['INPUT', 'TEXTAREA', 'SELECT'].includes(activo.tagName)
      if (!enOtroCampo) inputRef.current?.focus()
    }, 800)
    return () => clearInterval(int)
  }, [])

  const equipoPorSerie = useMemo(
    () => new Map(equipos.map((e) => [e.serie.toLowerCase(), e])),
    [equipos]
  )
  const tipoPorId = useMemo(() => new Map(tipos.map((t) => [t.id, t])), [tipos])
  const usuarioPorId = useMemo(() => new Map(usuarios.map((u) => [u.id, u])), [usuarios])

  function procesarScan() {
    const serie = sn.trim()
    setSn('')
    if (!serie) return
    const eq = equipoPorSerie.get(serie.toLowerCase())

    if (modo === 'rapido') {
      if (eq) {
        setActual(eq)
        setNoEncontrado(null)
      } else {
        setActual(null)
        setNoEncontrado(serie)
      }
      return
    }

    // Auditoría
    if (!auditando) return
    if (eq) {
      setEscaneados((prev) => new Set(prev).add(eq.id))
    } else if (!desconocidos.includes(serie)) {
      setDesconocidos((prev) => [...prev, serie])
    }
  }

  async function accionRapida(cambios: Partial<Pick<Equipo, 'estado' | 'usuario_id'>>, mensaje: string) {
    if (!actual) return
    const { error } = await supabase.from('equipos').update(cambios).eq('id', actual.id)
    if (error) {
      toast('error', error.message)
      return
    }
    toast('success', mensaje)
    setActual({ ...actual, ...cambios })
    cargar()
  }

  // Resultados de auditoría
  const faltantes = useMemo(
    () => equipos.filter((e) => e.estado !== 'Transferido' && !escaneados.has(e.id)),
    [equipos, escaneados]
  )

  function exportarAuditoria() {
    exportToExcel(
      [
        ...faltantes.map((e) => ({
          Resultado: 'FALTANTE (no escaneado)',
          ID: e.codigo,
          'S/N': e.serie,
          Estado: e.estado,
          Usuario: usuarioPorId.get(e.usuario_id ?? '')?.nombre_completo ?? '',
        })),
        ...desconocidos.map((s) => ({
          Resultado: 'DESCONOCIDO (no está en sistema)',
          ID: '',
          'S/N': s,
          Estado: '',
          Usuario: '',
        })),
      ],
      'Auditoria',
      'Auditoria_Fisica_WMS-IT'
    )
  }

  const tipoActual = actual ? tipoPorId.get(actual.tipo_equipo_id ?? '') : null

  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-title">Estación de escaneo</h1>
        <p className="page-sub">Operación continua con la pistola — el cursor siempre está listo</p>
      </div>

      {/* Selector de modo */}
      <div className="flex gap-2">
        <button
          onClick={() => setModo('rapido')}
          className={`btn flex-1 justify-center sm:flex-none ${
            modo === 'rapido' ? 'bg-wmblue text-white' : 'btn-secondary'
          }`}
        >
          <Zap size={15} /> Acción rápida
        </button>
        <button
          onClick={() => setModo('auditoria')}
          className={`btn flex-1 justify-center sm:flex-none ${
            modo === 'auditoria' ? 'bg-wmblue text-white' : 'btn-secondary'
          }`}
        >
          <ClipboardCheck size={15} /> Auditoría física
        </button>
      </div>

      {/* Campo de escaneo permanente */}
      <div className="card flex items-center gap-3 !p-3">
        <ScanLine size={22} className="shrink-0 text-wmyellow" />
        <input
          ref={inputRef}
          className="input !h-11 flex-1 font-mono !text-base"
          placeholder="Escanea aquí… (o escribe el S/N y Enter)"
          value={sn}
          autoFocus
          onChange={(e) => setSn(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') procesarScan()
          }}
        />
      </div>

      {/* ══ MODO ACCIÓN RÁPIDA ══ */}
      {modo === 'rapido' && (
        <>
          {noEncontrado && (
            <div className="card border-red-200 bg-red-50">
              <p className="text-sm text-red-700">
                <strong className="font-mono">{noEncontrado}</strong> no está en el inventario.
                Agrégalo desde Inventario si es un equipo nuevo.
              </p>
            </div>
          )}

          {actual ? (
            <div className="card space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="tag-id !text-base">{actual.codigo ?? '—'}</span>
                <span className="font-mono text-sm text-slate-700">{actual.serie}</span>
                <span className={`badge ${ESTADO_ESTILO[actual.estado]}`}>{actual.estado}</span>
              </div>
              <p className="text-sm text-slate-500">
                {tipoActual?.tipo} {tipoActual?.modelo}
                {' · '}Usuario: {usuarioPorId.get(actual.usuario_id ?? '')?.nombre_completo ?? 'Sin asignar'}
              </p>

              <div className="grid gap-2 sm:grid-cols-3">
                <button
                  onClick={() => accionRapida({ estado: 'Operativo' }, `${actual.serie} marcado Operativo.`)}
                  className="btn-secondary justify-center"
                >
                  <CircleCheck size={15} className="text-estado-operativo" /> Marcar Operativo
                </button>
                <button
                  onClick={() => accionRapida({ estado: 'En bodega', usuario_id: null }, `${actual.serie} devuelto a bodega.`)}
                  className="btn-secondary justify-center"
                >
                  <Warehouse size={15} className="text-estado-bodega" /> Devolver a bodega
                </button>
                <div className="flex items-center gap-1.5">
                  <UserCheck size={15} className="shrink-0 text-slate-400" />
                  <select
                    className="input"
                    value=""
                    onChange={(e) => {
                      if (e.target.value)
                        accionRapida(
                          { usuario_id: e.target.value, estado: 'Operativo' },
                          `${actual.serie} asignado a ${usuarioPorId.get(e.target.value)?.nombre_completo}.`
                        )
                    }}
                  >
                    <option value="">Asignar a…</option>
                    {usuarios.filter((u) => u.activo).map((u) => (
                      <option key={u.id} value={u.id}>{u.nombre_completo}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ) : (
            !noEncontrado && (
              <p className="py-8 text-center text-sm text-slate-400">
                Escanea un equipo para ver su información y aplicarle acciones al instante.
              </p>
            )
          )}
        </>
      )}

      {/* ══ MODO AUDITORÍA ══ */}
      {modo === 'auditoria' && (
        <>
          {!auditando ? (
            <div className="card text-center">
              <p className="mb-3 text-sm text-slate-500">
                Escaneá <strong>todos</strong> los equipos físicos del CD. Al finalizar, el sistema
                te dice qué faltó por escanear (posible pérdida) y qué escaneaste que no está en
                sistema.
              </p>
              <button
                onClick={() => {
                  setEscaneados(new Set())
                  setDesconocidos([])
                  setAuditando(true)
                  inputRef.current?.focus()
                }}
                className="btn-primary mx-auto"
              >
                <ClipboardCheck size={15} /> Iniciar auditoría ({equipos.filter((e) => e.estado !== 'Transferido').length} equipos esperados)
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="card text-center">
                  <p className="font-display text-3xl font-bold text-estado-operativo">{escaneados.size}</p>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Escaneados</p>
                </div>
                <div className="card text-center">
                  <p className="font-display text-3xl font-bold text-estado-fuera">{faltantes.length}</p>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Faltantes</p>
                </div>
                <div className="card text-center">
                  <p className="font-display text-3xl font-bold text-amber-600">{desconocidos.length}</p>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Desconocidos</p>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="card">
                  <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Faltantes por escanear ({faltantes.length})
                  </h2>
                  <ul className="max-h-64 space-y-1 overflow-y-auto">
                    {faltantes.map((e) => (
                      <li key={e.id} className="flex items-center gap-2 text-sm">
                        <span className="tag-id">{e.codigo}</span>
                        <span className="font-mono text-xs text-slate-600">{e.serie}</span>
                      </li>
                    ))}
                    {faltantes.length === 0 && (
                      <li className="text-sm text-estado-operativo">✔ Todo escaneado, inventario completo.</li>
                    )}
                  </ul>
                </div>
                <div className="card">
                  <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Desconocidos — no están en sistema ({desconocidos.length})
                  </h2>
                  <ul className="max-h-64 space-y-1 overflow-y-auto">
                    {desconocidos.map((s) => (
                      <li key={s} className="font-mono text-xs text-amber-700">{s}</li>
                    ))}
                    {desconocidos.length === 0 && (
                      <li className="text-sm text-slate-400">Ninguno por ahora.</li>
                    )}
                  </ul>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button onClick={exportarAuditoria} className="btn-secondary">
                  <Download size={15} /> Exportar resultado
                </button>
                <button onClick={() => setAuditando(false)} className="btn-primary">
                  Finalizar auditoría
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
