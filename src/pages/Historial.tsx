import { useCallback, useEffect, useState } from 'react'
import { Download, Search, ChevronDown, FileText, Undo2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useUI } from '@/hooks/useUI'
import { exportToExcel } from '@/lib/excelExport'
import { generarPDF } from '@/lib/pdf'
import type { HistorialEntry } from '@/types/database'

const PAGE_SIZE = 50

const MODULOS = ['Inventario', 'Fallas', 'Consumibles', 'Transferencias', 'Sistema']

export default function Historial() {
  const { toast, confirm } = useUI()
  const [entradas, setEntradas] = useState<HistorialEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [hayMas, setHayMas] = useState(false)

  const [busqueda, setBusqueda] = useState('')
  const [filtroModulo, setFiltroModulo] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')

  const cargar = useCallback(
    async (append = false) => {
      setLoading(true)
      const offset = append ? entradas.length : 0

      let query = supabase
        .from('historial')
        .select('*')
        .order('fecha_hora', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1)

      if (filtroModulo) query = query.eq('modulo', filtroModulo)
      if (desde) query = query.gte('fecha_hora', `${desde}T00:00:00`)
      if (hasta) query = query.lte('fecha_hora', `${hasta}T23:59:59`)
      if (busqueda.trim()) {
        const q = busqueda.trim()
        query = query.or(
          `referencia.ilike.%${q}%,accion.ilike.%${q}%,realizado_por.ilike.%${q}%`
        )
      }

      const { data } = await query
      const nuevas = (data as HistorialEntry[]) ?? []
      setEntradas(append ? [...entradas, ...nuevas] : nuevas)
      setHayMas(nuevas.length === PAGE_SIZE)
      setLoading(false)
    },
    [entradas, filtroModulo, desde, hasta, busqueda]
  )

  // Recargar al cambiar filtros (con debounce para la búsqueda de texto)
  useEffect(() => {
    const t = setTimeout(() => cargar(false), 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda, filtroModulo, desde, hasta])

  async function restaurar(h: HistorialEntry) {
    // Restaura un equipo eliminado usando los datos del registro de auditoría
    // (código + S/N). Vuelve "En bodega" para revisarlo y completar sus datos.
    const ok = await confirm({
      title: 'Restaurar equipo',
      message: `Se recreará el equipo ${h.valor_anterior ?? ''} (S/N ${h.referencia}) con estado "En bodega". Deberás completar tipo, usuario y demás datos editándolo.`,
      confirmLabel: 'Restaurar',
    })
    if (!ok) return
    const { error } = await supabase.from('equipos').insert({
      codigo: h.valor_anterior || null,
      serie: h.referencia ?? '',
      estado: 'En bodega',
      observaciones: `Restaurado desde historial (registro #${h.id})`,
    })
    if (error) {
      toast(
        'error',
        error.message.includes('duplicate')
          ? 'Ese S/N o código ya existe en el inventario (posiblemente ya fue restaurado).'
          : error.message
      )
      return
    }
    toast('success', `Equipo S/N ${h.referencia} restaurado. Edítalo en Inventario para completar sus datos.`)
    cargar(false)
  }

  async function exportarTodo() {
    // Exporta lo que hay bajo el filtro actual (hasta 5000 filas)
    let query = supabase
      .from('historial')
      .select('*')
      .order('fecha_hora', { ascending: false })
      .limit(5000)
    if (filtroModulo) query = query.eq('modulo', filtroModulo)
    if (desde) query = query.gte('fecha_hora', `${desde}T00:00:00`)
    if (hasta) query = query.lte('fecha_hora', `${hasta}T23:59:59`)
    const { data } = await query
    const filas = ((data as HistorialEntry[]) ?? []).map((h) => ({
      'Fecha/Hora': new Date(h.fecha_hora).toLocaleString('es-SV'),
      Acción: h.accion,
      Referencia: h.referencia,
      Campo: h.campo,
      'Valor anterior': h.valor_anterior,
      'Valor nuevo': h.valor_nuevo,
      Usuario: h.realizado_por,
      Módulo: h.modulo,
    }))
    exportToExcel(filas, 'Historial', 'Historial_WMS-IT')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Historial</h1>
          <p className="page-sub">
            Bitácora completa del sistema — se escribe sola, nadie la puede editar
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() =>
              generarPDF({
                titulo: 'Historial del sistema',
                archivo: 'Historial',
                columnas: ['Fecha/Hora', 'Acción', 'Referencia', 'Campo', 'Anterior', 'Nuevo', 'Usuario', 'Módulo'],
                filas: entradas.map((h) => [
                  new Date(h.fecha_hora).toLocaleString('es-SV'),
                  h.accion,
                  h.referencia,
                  h.campo,
                  h.valor_anterior,
                  h.valor_nuevo,
                  h.realizado_por,
                  h.modulo,
                ]),
              })
            }
            className="btn-secondary"
          >
            <FileText size={15} /> PDF
          </button>
          <button onClick={exportarTodo} className="btn-secondary">
            <Download size={15} /> Exportar (filtro actual)
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative max-w-xs flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input !pl-9"
            placeholder="Buscar por S/N, acción o usuario"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <select className="input max-w-[170px]" value={filtroModulo} onChange={(e) => setFiltroModulo(e.target.value)}>
          <option value="">Todos los módulos</option>
          {MODULOS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-slate-500">Desde</label>
          <input type="date" className="input !w-auto" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-slate-500">Hasta</label>
          <input type="date" className="input !w-auto" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>
      </div>

      <div className="card overflow-x-auto p-0">
        {loading && entradas.length === 0 ? (
          <div className="space-y-2 p-4">
            <div className="skeleton h-9" />
            <div className="skeleton h-9" />
            <div className="skeleton h-9" />
            <div className="skeleton h-9" />
          </div>
        ) : entradas.length === 0 ? (
          <p className="p-4 text-sm text-slate-400">Sin registros para ese filtro.</p>
        ) : (
          <table className="tabla">
            <thead>
              <tr>
                <th>Fecha / Hora</th>
                <th>Acción</th>
                <th>Referencia</th>
                <th>Cambio</th>
                <th>Usuario</th>
                <th>Módulo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {entradas.map((h) => (
                <tr key={h.id}>
                  <td className="whitespace-nowrap text-slate-500">
                    {new Date(h.fecha_hora).toLocaleString('es-SV', {
                      day: '2-digit', month: '2-digit', year: '2-digit',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </td>
                  <td>
                    <span className="badge bg-slate-50 text-slate-600">{h.accion}</span>
                  </td>
                  <td className="font-mono text-xs text-slate-700">{h.referencia ?? '—'}</td>
                  <td className="max-w-[260px] truncate text-slate-500">
                    {h.campo && (
                      <>
                        <span className="text-slate-400">{h.campo}:</span>{' '}
                        {h.valor_anterior && <span className="line-through opacity-60">{h.valor_anterior}</span>}
                        {h.valor_anterior && h.valor_nuevo && ' → '}
                        {h.valor_nuevo}
                      </>
                    )}
                  </td>
                  <td className="text-xs text-slate-500">{h.realizado_por ?? '—'}</td>
                  <td className="text-xs text-slate-400">{h.modulo ?? '—'}</td>
                  <td>
                    {h.accion === 'ELIMINACION' && (
                      <button
                        onClick={() => restaurar(h)}
                        className="btn-secondary btn-icon"
                        title="Restaurar equipo eliminado"
                        aria-label="Restaurar equipo eliminado"
                      >
                        <Undo2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {hayMas && (
        <div className="flex justify-center">
          <button onClick={() => cargar(true)} disabled={loading} className="btn-secondary">
            <ChevronDown size={15} />
            {loading ? 'Cargando…' : 'Cargar más'}
          </button>
        </div>
      )}
    </div>
  )
}
