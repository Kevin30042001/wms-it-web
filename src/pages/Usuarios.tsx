import { useEffect, useState } from 'react'
import { Plus, Download, Pencil, UserX, ClipboardList, Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useUI } from '@/hooks/useUI'
import UsuarioForm from '@/components/UsuarioForm'
import Modal from '@/components/Modal'
import ExcelImportButton from '@/components/ExcelImportButton'
import ImportPreviewModal from '@/components/ImportPreviewModal'
import { exportToExcel } from '@/lib/excelExport'
import type { CentroDistribucion, Equipo, UsuarioResumen, UsuarioTecnico } from '@/types/database'

export default function Usuarios() {
  const { toast, confirm } = useUI()
  const [usuarios, setUsuarios] = useState<UsuarioResumen[]>([])
  const [centros, setCentros] = useState<CentroDistribucion[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')

  const [formOpen, setFormOpen] = useState(false)
  const [editando, setEditando] = useState<UsuarioTecnico | null>(null)
  const [perfilAbierto, setPerfilAbierto] = useState<UsuarioResumen | null>(null)
  const [equiposPerfil, setEquiposPerfil] = useState<Equipo[]>([])

  const [importRows, setImportRows] = useState<Record<string, unknown>[] | null>(null)

  async function cargar() {
    setLoading(true)
    const [uRes, cRes] = await Promise.all([
      supabase.from('v_usuarios_resumen').select('*').order('nombre_completo'),
      supabase.from('centros_distribucion').select('*').eq('activo', true).order('nombre'),
    ])
    if (uRes.data) setUsuarios(uRes.data as UsuarioResumen[])
    if (cRes.data) setCentros(cRes.data as CentroDistribucion[])
    setLoading(false)
  }

  useEffect(() => {
    cargar()
    const channel = supabase
      .channel('usuarios-cambios')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'usuarios_tecnicos' }, cargar)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  async function abrirPerfil(u: UsuarioResumen) {
    setPerfilAbierto(u)
    const { data } = await supabase.from('equipos').select('*').eq('usuario_id', u.id)
    setEquiposPerfil((data as Equipo[]) ?? [])
  }

  async function desactivar(u: UsuarioResumen) {
    const ok = await confirm({
      title: 'Desactivar usuario',
      message: `${u.nombre_completo} dejará de aparecer en las listas de asignación. Sus equipos actuales no se tocan.`,
      confirmLabel: 'Desactivar',
      danger: true,
    })
    if (!ok) return
    await supabase.from('usuarios_tecnicos').update({ activo: false }).eq('id', u.id)
    toast('success', `${u.nombre_completo} desactivado.`)
    cargar()
  }

  const filtrados = usuarios.filter((u) =>
    `${u.nombre_completo} ${u.numero_usuario ?? ''} ${u.cargo ?? ''}`
      .toLowerCase()
      .includes(busqueda.toLowerCase())
  )

  async function handleImportConfirm(rows: Record<string, unknown>[]) {
    const cdDefault = centros[0]?.id ?? null
    const payload = rows.map((r) => ({
      nombre_completo: String(r.nombre ?? ''),
      numero_usuario: r.numero_usuario ? String(r.numero_usuario) : null,
      cargo: r.cargo ? String(r.cargo) : null,
      cd_id: cdDefault,
      activo: true,
    }))

    // Separamos: filas CON número de usuario (pueden chocar en el upsert si
    // se repiten dentro del mismo Excel) de las que no tienen (esas nunca
    // generan conflicto, se insertan todas tal cual).
    const conNumero = new Map<string, Record<string, unknown>>()
    const sinNumero: Record<string, unknown>[] = []
    for (const row of payload) {
      if (row.numero_usuario) conNumero.set(row.numero_usuario as string, row)
      else sinNumero.push(row)
    }
    const payloadFinal = [...conNumero.values(), ...sinNumero]

    const { error } = await supabase
      .from('usuarios_tecnicos')
      .upsert(payloadFinal, { onConflict: 'numero_usuario', ignoreDuplicates: false })
    if (error) throw error
    cargar()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Usuarios</h1>
          <p className="page-sub">Personal técnico y equipos asignados</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExcelImportButton
            sheetNames={['USUARIOS']}
            startRow={6}
            mapRow={(row) => {
              const nombre = String(row['B'] ?? '').trim()
              if (!nombre) return null
              return {
                nombre: nombre,
                numero_usuario: row['C'],
                cargo: row['D'],
              }
            }}
            onParsed={setImportRows}
          />
          <button
            onClick={() =>
              exportToExcel(
                usuarios.map((u) => ({
                  Nombre: u.nombre_completo,
                  'N° Usuario': u.numero_usuario,
                  Cargo: u.cargo,
                  'Equipos Asignados': u.equipos_asignados,
                  'Fallas Reportadas': u.fallas_reportadas,
                  Activo: u.activo ? 'Sí' : 'No',
                })),
                'Usuarios',
                'Usuarios_WMS-IT'
              )
            }
            className="btn-secondary"
          >
            <Download size={15} /> Exportar
          </button>
          <button
            onClick={() => {
              setEditando(null)
              setFormOpen(true)
            }}
            className="btn-primary"
          >
            <Plus size={15} /> Agregar usuario
          </button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          className="input !pl-9"
          placeholder="Buscar por nombre, N° usuario o cargo"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      <div className="card overflow-x-auto p-0">
        {loading ? (
          <p className="p-4 text-sm text-slate-400">Cargando…</p>
        ) : filtrados.length === 0 ? (
          <p className="p-4 text-sm text-slate-400">
            No hay usuarios todavía. Agrega uno o impórtalos desde tu Excel.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">Nombre</th>
                <th className="px-4 py-3 text-left">N° Usuario</th>
                <th className="px-4 py-3 text-left">Cargo</th>
                <th className="px-4 py-3 text-center">Equipos</th>
                <th className="px-4 py-3 text-center">Fallas</th>
                <th className="px-4 py-3 text-center">Activo</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtrados.map((u) => (
                <tr key={u.id} className={!u.activo ? 'opacity-50' : ''}>
                  <td className="px-4 py-3 font-medium text-slate-800">{u.nombre_completo}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{u.numero_usuario ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{u.cargo ?? '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="badge bg-blue-50 text-wmblue">{u.equipos_asignados}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="badge bg-orange-50 text-orange-600">{u.fallas_reportadas}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {u.activo ? (
                      <span className="badge bg-green-50 text-estado-operativo">Sí</span>
                    ) : (
                      <span className="badge bg-slate-100 text-slate-500">No</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => abrirPerfil(u)}
                        className="btn-secondary btn-icon"
                        title="Ver perfil"
                        aria-label="Ver perfil"
                      >
                        <ClipboardList size={14} />
                      </button>
                      <button
                        onClick={() => {
                          setEditando(u)
                          setFormOpen(true)
                        }}
                        className="btn-secondary btn-icon"
                        title="Editar"
                        aria-label="Editar usuario"
                      >
                        <Pencil size={14} />
                      </button>
                      {u.activo && (
                        <button
                          onClick={() => desactivar(u)}
                          className="btn-danger btn-icon"
                          title="Desactivar"
                          aria-label="Desactivar usuario"
                        >
                          <UserX size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {formOpen && (
        <UsuarioForm
          usuario={editando}
          centros={centros}
          onClose={() => setFormOpen(false)}
          onSaved={cargar}
        />
      )}

      {perfilAbierto && (
        <Modal title={`Perfil — ${perfilAbierto.nombre_completo}`} onClose={() => setPerfilAbierto(null)}>
          <div className="space-y-1 text-sm">
            <p>
              <span className="text-slate-500">Cargo:</span> {perfilAbierto.cargo ?? '—'}
            </p>
            <p>
              <span className="text-slate-500">N° Usuario:</span> {perfilAbierto.numero_usuario ?? '—'}
            </p>
          </div>
          <hr className="my-3" />
          <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">
            Equipos asignados ({equiposPerfil.length})
          </h3>
          {equiposPerfil.length === 0 ? (
            <p className="text-sm text-slate-400">Sin equipos asignados.</p>
          ) : (
            <ul className="space-y-1">
              {equiposPerfil.map((eq) => (
                <li key={eq.id} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                  <span className="font-mono text-xs">{eq.codigo}</span>
                  <span>{eq.serie}</span>
                  <span className="text-slate-500">{eq.estado}</span>
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}

      {importRows && (
        <ImportPreviewModal
          title="Importar usuarios desde Excel"
          rows={importRows}
          columns={[
            { key: 'nombre', label: 'Nombre' },
            { key: 'numero_usuario', label: 'N° Usuario' },
            { key: 'cargo', label: 'Cargo' },
          ]}
          onClose={() => setImportRows(null)}
          onConfirm={handleImportConfirm}
        />
      )}
    </div>
  )
}
