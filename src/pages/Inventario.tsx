import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import EquipoForm from '@/components/EquipoForm'
import ExcelImportButton from '@/components/ExcelImportButton'
import ImportPreviewModal from '@/components/ImportPreviewModal'
import { exportToExcel } from '@/lib/excelExport'
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
  const [equipos, setEquipos] = useState<Equipo[]>([])
  const [tipos, setTipos] = useState<TipoEquipo[]>([])
  const [usuarios, setUsuarios] = useState<UsuarioResumen[]>([])
  const [centros, setCentros] = useState<CentroDistribucion[]>([])
  const [loading, setLoading] = useState(true)

  const [busqueda, setBusqueda] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')

  const [formOpen, setFormOpen] = useState(false)
  const [editando, setEditando] = useState<Equipo | null>(null)
  const [importRows, setImportRows] = useState<Record<string, unknown>[] | null>(null)

  async function cargar() {
    setLoading(true)
    const [eqRes, tRes, uRes, cRes] = await Promise.all([
      supabase.from('equipos').select('*').order('codigo'),
      supabase.from('tipos_equipo').select('*').eq('activo', true).order('tipo'),
      supabase.from('v_usuarios_resumen').select('*').order('nombre_completo'),
      supabase.from('centros_distribucion').select('*').eq('activo', true).order('nombre'),
    ])
    if (eqRes.data) setEquipos(eqRes.data as Equipo[])
    if (tRes.data) setTipos(tRes.data as TipoEquipo[])
    if (uRes.data) setUsuarios(uRes.data as UsuarioResumen[])
    if (cRes.data) setCentros(cRes.data as CentroDistribucion[])
    setLoading(false)
  }

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

  async function eliminar(eq: Equipo) {
    if (!confirm(`¿Eliminar el equipo S/N: ${eq.serie}? Esta acción queda registrada en el historial.`)) return
    await supabase.from('equipos').delete().eq('id', eq.id)
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

      return {
        codigo: r.codigo || null, // si viene ID del Excel, se respeta; si no, el trigger lo genera
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
    })

    const { error } = await supabase.from('equipos').insert(payload)
    if (error) throw error
    cargar()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">📦 Inventario de Equipos</h1>
          <p className="text-sm text-slate-500">{equipos.length} equipo(s) registrados</p>
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
            💾 Exportar
          </button>
          <button
            onClick={() => {
              setEditando(null)
              setFormOpen(true)
            }}
            className="btn-primary"
          >
            ➕ Agregar
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          className="input max-w-xs"
          placeholder="🔍 Buscar por S/N, tipo, usuario…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
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
                  <tr key={eq.id}>
                    <td className="px-3 py-2.5 font-mono text-xs font-semibold text-slate-700">{eq.codigo}</td>
                    <td className="px-3 py-2.5 text-slate-600">{tipo?.tipo ?? '—'}</td>
                    <td className="px-3 py-2.5 text-slate-600">{eq.modelo ?? tipo?.modelo ?? '—'}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-slate-700">{eq.serie}</td>
                    <td className="px-3 py-2.5 text-slate-600">{usuario?.nombre_completo ?? '—'}</td>
                    <td className="px-3 py-2.5 text-slate-500">{centro?.nombre ?? '—'}</td>
                    <td className="px-3 py-2.5">
                      <span className={`badge ${ESTADO_ESTILO[eq.estado]}`}>{eq.estado}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-end gap-1 text-xs">
                        <button
                          onClick={() => {
                            setEditando(eq)
                            setFormOpen(true)
                          }}
                          className="btn-secondary !px-2 !py-1"
                        >
                          ✏️
                        </button>
                        <button onClick={() => eliminar(eq)} className="btn-danger !px-2 !py-1">
                          🗑️
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
