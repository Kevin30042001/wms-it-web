import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Download, Pencil, PackagePlus, PackageMinus, History, Search, FileText } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { generarPDF } from '@/lib/pdf'
import { useUI } from '@/hooks/useUI'
import Modal from '@/components/Modal'
import { ConsumibleForm, MovimientoForm } from '@/components/ConsumibleForms'
import ExcelImportButton from '@/components/ExcelImportButton'
import ImportPreviewModal from '@/components/ImportPreviewModal'
import { exportToExcel } from '@/lib/excelExport'
import type {
  ConsumibleConEstado,
  EstadoSemaforo,
  MovimientoConsumible,
  TipoMovimiento,
  UsuarioResumen,
} from '@/types/database'

const SEMAFORO_ESTILO: Record<EstadoSemaforo, string> = {
  AGOTADO: 'bg-red-900 text-white',
  CRÍTICO: 'bg-red-50 text-estado-fuera',
  BAJO: 'bg-amber-50 text-amber-700',
  ÓPTIMO: 'bg-green-50 text-estado-operativo',
  EXCESO: 'bg-blue-50 text-estado-bodega',
}

export default function Consumibles() {
  const { toast } = useUI()
  const [items, setItems] = useState<ConsumibleConEstado[]>([])
  const [usuarios, setUsuarios] = useState<UsuarioResumen[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')

  const [formItem, setFormItem] = useState<ConsumibleConEstado | null | 'nuevo'>(null)
  const [movimiento, setMovimiento] = useState<{ item: ConsumibleConEstado; tipo: TipoMovimiento } | null>(null)
  const [historialDe, setHistorialDe] = useState<ConsumibleConEstado | null>(null)
  const [movimientos, setMovimientos] = useState<MovimientoConsumible[]>([])
  const [importRows, setImportRows] = useState<Record<string, unknown>[] | null>(null)

  const alertado = useRef(false)

  async function cargar() {
    const [cRes, uRes] = await Promise.all([
      supabase.from('v_consumibles_estado').select('*').order('nombre'),
      supabase.from('v_usuarios_resumen').select('*').order('nombre_completo'),
    ])
    if (cRes.data) {
      const lista = cRes.data as ConsumibleConEstado[]
      setItems(lista)
      // Alerta al entrar (una vez por visita), igual que VerificarAlertasInicio
      if (!alertado.current) {
        const criticos = lista.filter((c) => c.estado_semaforo === 'CRÍTICO' || c.estado_semaforo === 'AGOTADO')
        if (criticos.length > 0) {
          toast('error', `${criticos.length} consumible(s) en alerta: ${criticos.map((c) => c.nombre).join(', ')}. Solicitar reposición.`)
        }
        alertado.current = true
      }
    }
    if (uRes.data) setUsuarios(uRes.data as UsuarioResumen[])
    setLoading(false)
  }

  useEffect(() => {
    cargar()
    const channel = supabase
      .channel('consumibles-cambios')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'consumibles' }, cargar)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  async function abrirHistorial(item: ConsumibleConEstado) {
    setHistorialDe(item)
    const { data } = await supabase
      .from('movimientos_consumibles')
      .select('*')
      .eq('consumible_id', item.id)
      .order('created_at', { ascending: false })
      .limit(30)
    setMovimientos((data as MovimientoConsumible[]) ?? [])
  }

  const usuarioPorId = useMemo(() => new Map(usuarios.map((u) => [u.id, u])), [usuarios])

  const filtrados = items.filter((c) =>
    `${c.nombre} ${c.categoria ?? ''}`.toLowerCase().includes(busqueda.toLowerCase())
  )

  async function handleImportConfirm(rows: Record<string, unknown>[]) {
    // Deduplicar por nombre dentro del archivo
    const porNombre = new Map<string, Record<string, unknown>>()
    for (const r of rows) {
      const nombre = String(r.nombre ?? '').trim()
      if (nombre) porNombre.set(nombre.toLowerCase(), r)
    }
    const payload = Array.from(porNombre.values()).map((r) => ({
      codigo: r.codigo ? String(r.codigo) : null,
      nombre: String(r.nombre ?? '').trim(),
      categoria: r.categoria ? String(r.categoria) : null,
      unidad: r.unidad ? String(r.unidad) : 'Unidad',
      stock: Number(r.stock) || 0,
      stock_min: Number(r.stock_min) || 0,
      stock_max: Number(r.stock_max) || 0,
    }))
    const { error } = await supabase.from('consumibles').insert(payload)
    if (error) throw error
    toast('success', `${payload.length} consumible(s) importados.`)
    cargar()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Consumibles</h1>
          <p className="page-sub">Control de stock con semáforo automático</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExcelImportButton
            sheetNames={['CONSUMIBLES']}
            startRow={6}
            mapRow={(row) => {
              const nombre = String(row['B'] ?? '').trim()
              if (!nombre) return null
              return {
                codigo: row['A'],
                nombre,
                categoria: row['C'],
                unidad: row['D'],
                stock: row['E'],
                stock_min: row['F'],
                stock_max: row['G'],
              }
            }}
            onParsed={setImportRows}
          />
          <button
            onClick={() =>
              exportToExcel(
                items.map((c) => ({
                  ID: c.codigo,
                  Nombre: c.nombre,
                  Categoría: c.categoria,
                  Unidad: c.unidad,
                  Stock: c.stock,
                  Mínimo: c.stock_min,
                  Máximo: c.stock_max,
                  Estado: c.estado_semaforo,
                })),
                'Consumibles',
                'Consumibles_WMS-IT'
              )
            }
            className="btn-secondary"
          >
            <Download size={15} /> Exportar
          </button>
          <button
            onClick={() =>
              generarPDF({
                titulo: 'Control de consumibles',
                archivo: 'Consumibles_Stock',
                orientacion: 'portrait',
                columnas: ['Nombre', 'Categoría', 'Stock', 'Mín', 'Máx', 'Estado'],
                filas: filtrados.map((c) => [
                  c.nombre,
                  c.categoria,
                  `${c.stock} ${c.unidad}`,
                  c.stock_min,
                  c.stock_max,
                  c.estado_semaforo,
                ]),
              })
            }
            className="btn-secondary"
          >
            <FileText size={15} /> PDF
          </button>
          <button onClick={() => setFormItem('nuevo')} className="btn-primary">
            <Plus size={15} /> Nuevo consumible
          </button>
        </div>
      </div>

      <div className="relative max-w-xs">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          className="input !pl-9"
          placeholder="Buscar por nombre o categoría"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      <div className="card overflow-x-auto p-0">
        {loading ? (
          <div className="space-y-2 p-4">
            <div className="skeleton h-10" />
            <div className="skeleton h-10" />
            <div className="skeleton h-10" />
          </div>
        ) : filtrados.length === 0 ? (
          <p className="p-4 text-sm text-slate-400">
            No hay consumibles registrados. Crea uno o impórtalos desde tu Excel.
          </p>
        ) : (
          <table className="tabla">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Categoría</th>
                <th className="text-center">Stock</th>
                <th className="text-center">Mín / Máx</th>
                <th>Estado</th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((c) => (
                <tr key={c.id}>
                  <td className="font-medium text-slate-800">{c.nombre}</td>
                  <td className="text-slate-500">{c.categoria ?? '—'}</td>
                  <td className="text-center">
                    <span className="font-mono text-sm font-semibold">{c.stock}</span>{' '}
                    <span className="text-xs text-slate-400">{c.unidad}</span>
                  </td>
                  <td className="text-center font-mono text-xs text-slate-500">
                    {c.stock_min} / {c.stock_max}
                  </td>
                  <td>
                    <span className={`badge ${SEMAFORO_ESTILO[c.estado_semaforo]}`}>
                      {c.estado_semaforo}
                    </span>
                  </td>
                  <td>
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => setMovimiento({ item: c, tipo: 'Entrada' })}
                        className="btn-secondary btn-icon"
                        title="Agregar stock"
                        aria-label="Agregar stock"
                      >
                        <PackagePlus size={14} className="text-estado-operativo" />
                      </button>
                      <button
                        onClick={() => setMovimiento({ item: c, tipo: 'Salida' })}
                        className="btn-secondary btn-icon"
                        title="Descontar"
                        aria-label="Descontar"
                      >
                        <PackageMinus size={14} className="text-estado-reparacion" />
                      </button>
                      <button
                        onClick={() => abrirHistorial(c)}
                        className="btn-secondary btn-icon"
                        title="Movimientos"
                        aria-label="Ver movimientos"
                      >
                        <History size={14} />
                      </button>
                      <button
                        onClick={() => setFormItem(c)}
                        className="btn-secondary btn-icon"
                        title="Editar"
                        aria-label="Editar consumible"
                      >
                        <Pencil size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {formItem && (
        <ConsumibleForm
          consumible={formItem === 'nuevo' ? null : formItem}
          onClose={() => setFormItem(null)}
          onSaved={cargar}
        />
      )}

      {movimiento && (
        <MovimientoForm
          consumible={movimiento.item}
          tipo={movimiento.tipo}
          usuarios={usuarios}
          onClose={() => setMovimiento(null)}
          onSaved={cargar}
        />
      )}

      {historialDe && (
        <Modal title={`Movimientos — ${historialDe.nombre}`} onClose={() => setHistorialDe(null)} wide>
          {movimientos.length === 0 ? (
            <p className="text-sm text-slate-400">Sin movimientos registrados todavía.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {movimientos.map((m) => (
                <li key={m.id} className="flex items-center gap-3 py-2 text-sm">
                  <span
                    className={`badge ${
                      m.tipo === 'Entrada' ? 'bg-green-50 text-estado-operativo' : 'bg-orange-50 text-estado-reparacion'
                    }`}
                  >
                    {m.tipo === 'Entrada' ? '+' : '−'}{m.cantidad}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-slate-600">
                    {m.motivo}
                    {m.responsable_id && (
                      <span className="text-slate-400">
                        {' '}· {usuarioPorId.get(m.responsable_id)?.nombre_completo}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-xs text-slate-400">
                    {new Date(m.created_at).toLocaleString('es-SV', {
                      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}

      {importRows && (
        <ImportPreviewModal
          title="Importar consumibles desde Excel"
          rows={importRows}
          columns={[
            { key: 'nombre', label: 'Nombre' },
            { key: 'categoria', label: 'Categoría' },
            { key: 'stock', label: 'Stock' },
            { key: 'stock_min', label: 'Mín' },
            { key: 'stock_max', label: 'Máx' },
          ]}
          onClose={() => setImportRows(null)}
          onConfirm={handleImportConfirm}
        />
      )}
    </div>
  )
}
