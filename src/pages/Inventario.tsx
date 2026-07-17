import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Download, Pencil, Trash2, TriangleAlert, Search, FileText, Barcode, FileDown, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useUI } from '@/hooks/useUI'
import EquipoForm from '@/components/EquipoForm'
import FallaForm from '@/components/FallaForm'
import EtiquetaModal from '@/components/EtiquetaModal'
import ExcelImportButton from '@/components/ExcelImportButton'
import ImportPreviewModal from '@/components/ImportPreviewModal'
import MemoModal from '@/components/MemoModal'
import { exportToExcel } from '@/lib/excelExport'
import { generarPDF } from '@/lib/pdf'
import type {
  CentroDistribucion,
  Equipo,
  EstadoEquipo,
  TipoEquipo,
  UsuarioResumen,
} from '@/types/database'

const ESTADO_ESTILO: Record<EstadoEquipo, string> = {
  Operativo: 'bg-green-50 text-estado-operativo',
  'En reparación': 'bg-orange-50 text-estado-reparacion',
  'Fuera de servicio': 'bg-red-50 text-estado-fuera',
  'En bodega': 'bg-blue-50 text-estado-bodega',
  'Reportado con falla': 'bg-amber-50 text-amber-600',
  Transferido: 'bg-slate-100 text-slate-500',
}

export default function Inventario() {
  const [searchParams] = useSearchParams()
  const { toast, confirm } = useUI()
  const [equipos, setEquipos] = useState<Equipo[]>([])
  const [tipos, setTipos] = useState<TipoEquipo[]>([])
  const [usuarios, setUsuarios] = useState<UsuarioResumen[]>([])
  const [centros, setCentros] = useState<CentroDistribucion[]>([])
  const [loading, setLoading] = useState(true)

  const [busqueda, setBusqueda] = useState(searchParams.get('q') ?? '')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')

  const [formOpen, setFormOpen] = useState(false)
  const [editando, setEditando] = useState<Equipo | null>(null)
  const [equipoParaFalla, setEquipoParaFalla] = useState<Equipo | null>(null)
  const [equipoParaEtiqueta, setEquipoParaEtiqueta] = useState<Equipo | null>(null)
  const [importRows, setImportRows] = useState<Record<string, unknown>[] | null>(null)
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set())
  const [memoOpen, setMemoOpen] = useState(false)

  async function cargar() {
    setLoading(true)
    const [eqRes, tRes, uRes, cRes] = await Promise.all([
      supabase.from('equipos').select('*').order('codigo'),
      supabase.from('tipos_equipo').select('*').eq('activo', true).order('tipo'),
      supabase.from('v_usuarios_resumen').select('*').order('nombre_completo'),
      supabase.from('centros_distribucion').select('*').eq('activo', true).order('nombre'),
    ])
    const fallo = eqRes.error ?? tRes.error ?? uRes.error ?? cRes.error
    if (fallo) {
      toast('error', `No se pudo cargar el inventario: ${fallo.message}`)
    }
    if (eqRes.data) setEquipos(eqRes.data as Equipo[])
    if (tRes.data) setTipos(tRes.data as TipoEquipo[])
    if (uRes.data) setUsuarios(uRes.data as UsuarioResumen[])
    if (cRes.data) setCentros(cRes.data as CentroDistribucion[])
    setLoading(false)
  }

  useEffect(() => {
    const q = searchParams.get('q')
    if (q) setBusqueda(q)
    if (searchParams.get('nuevo')) {
      setEditando(null)
      setFormOpen(true)
    }
  }, [searchParams])

  useEffect(() => {
    cargar()
    const channel = supabase
      .channel('inventario-cambios')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'equipos' }, cargar)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const tipoPorId = useMemo(() => new Map(tipos.map((t) => [t.id, t])), [tipos])
  const usuarioPorId = useMemo(() => new Map(usuarios.map((u) => [u.id, u])), [usuarios])
  const centroPorId = useMemo(() => new Map(centros.map((c) => [c.id, c])), [centros])

  const filtrados = equipos.filter((eq) => {
    const tipo = tipoPorId.get(eq.tipo_equipo_id ?? '')
    const usuario = usuarioPorId.get(eq.usuario_id ?? '')
    const texto = `${eq.codigo ?? ''} ${eq.serie} ${tipo?.tipo ?? ''} ${tipo?.modelo ?? ''} ${usuario?.nombre_completo ?? ''}`.toLowerCase()
    if (busqueda && !texto.includes(busqueda.toLowerCase())) return false
    if (filtroTipo && eq.tipo_equipo_id !== filtroTipo) return false
    if (filtroEstado && eq.estado !== filtroEstado) return false
    return true
  })

  // ── Selección de filas (para memorandos y acciones en lote) ──────
  const idsFiltrados = filtrados.map((eq) => eq.id)
  const todosSeleccionados =
    idsFiltrados.length > 0 && idsFiltrados.every((id) => seleccion.has(id))

  function toggleSeleccion(id: string) {
    setSeleccion((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleTodos() {
    setSeleccion((prev) => {
      if (todosSeleccionados) {
        const next = new Set(prev)
        idsFiltrados.forEach((id) => next.delete(id))
        return next
      }
      return new Set([...prev, ...idsFiltrados])
    })
  }

  const equiposSeleccionados = equipos.filter((eq) => seleccion.has(eq.id))

  const filasMemo = equiposSeleccionados.map((eq) => {
    const tipo = tipoPorId.get(eq.tipo_equipo_id ?? '')
    return {
      caracteristica: eq.codigo ?? tipo?.tipo ?? 'Equipo',
      modelo: eq.modelo ?? tipo?.modelo ?? 'N/A',
      marca: eq.marca ?? tipo?.marca ?? 'N/A',
      serie: eq.serie,
    }
  })

  async function eliminar(eq: Equipo) {
    const ok = await confirm({
      title: 'Eliminar equipo',
      message: `Se eliminará el equipo S/N ${eq.serie}. Esta acción queda registrada en el historial.`,
      confirmLabel: 'Eliminar',
      danger: true,
    })
    if (!ok) return
    const { error } = await supabase.from('equipos').delete().eq('id', eq.id)
    if (error) toast('error', `No se pudo eliminar: ${error.message}`)
    else toast('success', `Equipo ${eq.serie} eliminado.`)
    cargar()
  }

  async function handleImportConfirm(rows: Record<string, unknown>[]) {
    // Mapear Tipo+Modelo de texto -> tipo_equipo_id, y Usuario de texto -> usuario_id
    const payload = rows.map((r) => {
      const tipoTexto = String(r.tipo ?? '').trim().toLowerCase()
      const tipoMatch = tipos.find((t) => t.tipo.toLowerCase() === tipoTexto)
      const usuarioTexto = String(r.usuario ?? '').trim().toLowerCase()
      const usuarioMatch = usuarios.find((u) => u.nombre_completo.toLowerCase() === usuarioTexto)
      const cdTexto = String(r.cd ?? '').trim().toLowerCase()
      const cdMatch = centros.find((c) => c.nombre.toLowerCase() === cdTexto) ?? centros[0]

      const payloadRow: Record<string, unknown> = {
        tipo_equipo_id: tipoMatch?.id ?? null,
        marca: r.marca || tipoMatch?.marca || null,
        modelo: r.modelo || tipoMatch?.modelo || null,
        serie: String(r.serie ?? '').trim(),
        usuario_id: usuarioMatch?.id ?? null,
        cd_id: cdMatch?.id ?? null,
        estado: (r.estado as string) || 'Operativo',
        fecha_ingreso: r.fecha_ingreso || new Date().toISOString().slice(0, 10),
        observaciones: r.observaciones || null,
      }
      // Solo incluir "codigo" si el Excel lo trae; así un re-import no borra
      // el código ya asignado a un equipo existente que coincide por S/N.
      if (r.codigo) payloadRow.codigo = r.codigo
      return payloadRow
    })

    // Postgres rechaza un upsert si el MISMO lote trae el mismo S/N repetido
    // más de una vez (ON CONFLICT no sabe a cuál fila darle prioridad).
    // Nos quedamos con la última ocurrencia de cada S/N dentro del archivo.
    const porSerie = new Map<string, Record<string, unknown>>()
    for (const row of payload) {
      const serie = String(row.serie ?? '').trim()
      if (serie) porSerie.set(serie, row)
    }
    const payloadSinDuplicados = Array.from(porSerie.values())

    const { error } = await supabase
      .from('equipos')
      .upsert(payloadSinDuplicados, { onConflict: 'serie', ignoreDuplicates: false })
    if (error) throw error

    const descartados = payload.length - payloadSinDuplicados.length
    if (descartados > 0) {
      toast(
        'info',
        `Se importaron ${payloadSinDuplicados.length} equipos. ${descartados} fila(s) con S/N repetido en el Excel se combinaron en un solo registro.`
      )
    } else {
      toast('success', `${payloadSinDuplicados.length} equipos importados correctamente.`)
    }
    cargar()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Inventario de equipos</h1>
          <p className="page-sub">{equipos.length} equipo(s) registrados</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExcelImportButton
            sheetNames={['INVENTARIO']}
            startRow={6}
            mapRow={(row) => {
              const serie = String(row['E'] ?? '').trim()
              if (!serie) return null
              const fecha = row['I']
              return {
                codigo: row['A'] || null,
                tipo: row['B'],
                marca: row['C'],
                modelo: row['D'],
                serie,
                usuario: row['F'],
                cd: row['G'],
                estado: row['H'] || 'Operativo',
                fecha_ingreso:
                  fecha instanceof Date ? fecha.toISOString().slice(0, 10) : undefined,
                observaciones: row['J'],
              }
            }}
            onParsed={setImportRows}
          />
          <button
            onClick={() =>
              exportToExcel(
                equipos.map((eq) => {
                  const tipo = tipoPorId.get(eq.tipo_equipo_id ?? '')
                  const usuario = usuarioPorId.get(eq.usuario_id ?? '')
                  const centro = centroPorId.get(eq.cd_id ?? '')
                  return {
                    ID: eq.codigo,
                    Tipo: tipo?.tipo,
                    Marca: eq.marca,
                    Modelo: eq.modelo,
                    'S/N': eq.serie,
                    'Usuario Asignado': usuario?.nombre_completo,
                    'CD / Ubicación': centro?.nombre,
                    Estado: eq.estado,
                    'Fecha Ingreso': eq.fecha_ingreso,
                    Observaciones: eq.observaciones,
                  }
                }),
                'Inventario',
                'Inventario_WMS-IT'
              )
            }
            className="btn-secondary"
          >
            <Download size={15} /> Exportar
          </button>
          <button
            onClick={() =>
              generarPDF({
                titulo: 'Inventario general',
                archivo: 'Inventario_General',
                columnas: ['ID', 'Tipo', 'Modelo', 'S/N', 'Usuario', 'CD', 'Estado', 'Ingreso'],
                filas: filtrados.map((eq) => {
                  const tipo = tipoPorId.get(eq.tipo_equipo_id ?? '')
                  const usuario = usuarioPorId.get(eq.usuario_id ?? '')
                  const centro = centroPorId.get(eq.cd_id ?? '')
                  return [
                    eq.codigo,
                    tipo?.tipo,
                    eq.modelo ?? tipo?.modelo,
                    eq.serie,
                    usuario?.nombre_completo,
                    centro?.nombre,
                    eq.estado,
                    eq.fecha_ingreso,
                  ]
                }),
              })
            }
            className="btn-secondary"
          >
            <FileText size={15} /> PDF
          </button>
          <button
            onClick={() => {
              setEditando(null)
              setFormOpen(true)
            }}
            className="btn-primary"
          >
            <Plus size={15} /> Agregar equipo
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative max-w-xs flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input !pl-9"
            placeholder="Buscar por S/N, tipo o usuario"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <select className="input max-w-[200px]" value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
          <option value="">Todos los tipos</option>
          {tipos.map((t) => (
            <option key={t.id} value={t.id}>
              {t.tipo} — {t.modelo}
            </option>
          ))}
        </select>
        <select
          className="input max-w-[200px]"
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
        >
          <option value="">Todos los estados</option>
          {Object.keys(ESTADO_ESTILO).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {seleccion.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
          <span className="font-medium">{seleccion.size} equipo(s) seleccionado(s)</span>
          <button onClick={() => setMemoOpen(true)} className="btn-primary">
            <FileDown size={15} /> Generar memorando
          </button>
          <button onClick={() => setSeleccion(new Set())} className="btn-secondary">
            <X size={15} /> Limpiar selección
          </button>
        </div>
      )}

      <div className="card overflow-x-auto p-0">
        {loading ? (
          <p className="p-4 text-sm text-slate-400">Cargando…</p>
        ) : filtrados.length === 0 ? (
          <p className="p-4 text-sm text-slate-400">
            No hay equipos que coincidan. Agrega uno o impórtalos desde tu Excel.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="w-8 px-3 py-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 cursor-pointer accent-blue-600"
                    checked={todosSeleccionados}
                    onChange={toggleTodos}
                    title="Seleccionar todos los visibles"
                    aria-label="Seleccionar todos"
                  />
                </th>
                <th className="px-3 py-3 text-left">ID</th>
                <th className="px-3 py-3 text-left">Tipo</th>
                <th className="px-3 py-3 text-left">Modelo</th>
                <th className="px-3 py-3 text-left">S/N</th>
                <th className="px-3 py-3 text-left">Usuario</th>
                <th className="px-3 py-3 text-left">CD</th>
                <th className="px-3 py-3 text-left">Estado</th>
                <th className="px-3 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtrados.map((eq) => {
                const tipo = tipoPorId.get(eq.tipo_equipo_id ?? '')
                const usuario = usuarioPorId.get(eq.usuario_id ?? '')
                const centro = centroPorId.get(eq.cd_id ?? '')
                return (
                  <tr key={eq.id} className={seleccion.has(eq.id) ? 'bg-blue-50/60' : undefined}>
                    <td className="px-3 py-2.5">
                      <input
                        type="checkbox"
                        className="h-4 w-4 cursor-pointer accent-blue-600"
                        checked={seleccion.has(eq.id)}
                        onChange={() => toggleSeleccion(eq.id)}
                        aria-label={`Seleccionar ${eq.serie}`}
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="tag-id">{eq.codigo ?? '—'}</span>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">{tipo?.tipo ?? '—'}</td>
                    <td className="px-3 py-2.5 text-slate-600">{eq.modelo ?? tipo?.modelo ?? '—'}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-slate-700">{eq.serie}</td>
                    <td className="px-3 py-2.5 text-slate-600">{usuario?.nombre_completo ?? '—'}</td>
                    <td className="px-3 py-2.5 text-slate-500">{centro?.nombre ?? '—'}</td>
                    <td className="px-3 py-2.5">
                      <span className={`badge ${ESTADO_ESTILO[eq.estado]}`}>{eq.estado}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => setEquipoParaEtiqueta(eq)}
                          className="btn-secondary btn-icon"
                          title="Etiqueta imprimible"
                          aria-label="Etiqueta imprimible"
                        >
                          <Barcode size={14} />
                        </button>
                        <button
                          onClick={() => setEquipoParaFalla(eq)}
                          className="btn-secondary btn-icon"
                          title="Reportar falla"
                          aria-label="Reportar falla"
                        >
                          <TriangleAlert size={14} className="text-estado-reparacion" />
                        </button>
                        <button
                          onClick={() => {
                            setEditando(eq)
                            setFormOpen(true)
                          }}
                          className="btn-secondary btn-icon"
                          title="Editar"
                          aria-label="Editar equipo"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => eliminar(eq)}
                          className="btn-danger btn-icon"
                          title="Eliminar"
                          aria-label="Eliminar equipo"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {memoOpen && (
        <MemoModal filas={filasMemo} centros={centros} onClose={() => setMemoOpen(false)} />
      )}

      {formOpen && (
        <EquipoForm
          equipo={editando}
          tipos={tipos}
          usuarios={usuarios}
          centros={centros}
          onClose={() => setFormOpen(false)}
          onSaved={cargar}
        />
      )}

      {equipoParaEtiqueta && (
        <EtiquetaModal equipo={equipoParaEtiqueta} onClose={() => setEquipoParaEtiqueta(null)} />
      )}

      {equipoParaFalla && (
        <FallaForm
          equipoPreseleccionado={equipoParaFalla}
          equipos={equipos}
          tipos={tipos}
          usuarios={usuarios}
          onClose={() => setEquipoParaFalla(null)}
          onSaved={cargar}
        />
      )}

      {importRows && (
        <ImportPreviewModal
          title="Importar inventario desde Excel"
          rows={importRows}
          columns={[
            { key: 'codigo', label: 'ID' },
            { key: 'tipo', label: 'Tipo' },
            { key: 'modelo', label: 'Modelo' },
            { key: 'serie', label: 'S/N' },
            { key: 'usuario', label: 'Usuario' },
            { key: 'estado', label: 'Estado' },
          ]}
          onClose={() => setImportRows(null)}
          onConfirm={handleImportConfirm}
        />
      )}
    </div>
  )
}
