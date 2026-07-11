import { useEffect, useState, type FormEvent } from 'react'
import { Plus, Pencil, Power, DatabaseBackup, Building2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useUI } from '@/hooks/useUI'
import Modal from '@/components/Modal'
import { exportMultiSheetExcel } from '@/lib/excelExport'
import type { CentroDistribucion, TipoEquipo } from '@/types/database'

// ── Formulario de tipo de equipo ─────────────────────────────────
function TipoForm({
  tipo,
  onClose,
  onSaved,
}: {
  tipo: TipoEquipo | null
  onClose: () => void
  onSaved: () => void
}) {
  const { toast } = useUI()
  const [nombre, setNombre] = useState(tipo?.tipo ?? '')
  const [modelo, setModelo] = useState(tipo?.modelo ?? '')
  const [marca, setMarca] = useState(tipo?.marca ?? '')
  const [prefijo, setPrefijo] = useState(tipo?.prefijo_id ?? '')
  const [llevaUsuario, setLlevaUsuario] = useState(tipo?.lleva_usuario ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!nombre.trim() || !modelo.trim() || !prefijo.trim()) {
      setError('Tipo, modelo y prefijo son obligatorios.')
      return
    }
    setSaving(true)
    const payload = {
      tipo: nombre.trim(),
      modelo: modelo.trim(),
      marca: marca.trim() || null,
      prefijo_id: prefijo.trim().toUpperCase(),
      lleva_usuario: llevaUsuario,
    }
    const { error: dbError } = tipo
      ? await supabase.from('tipos_equipo').update(payload).eq('id', tipo.id)
      : await supabase.from('tipos_equipo').insert(payload)
    setSaving(false)
    if (dbError) {
      setError(dbError.message.includes('duplicate') ? 'Ya existe ese tipo+modelo.' : dbError.message)
      return
    }
    toast('success', tipo ? 'Tipo actualizado.' : 'Tipo creado.')
    onSaved()
    onClose()
  }

  return (
    <Modal title={tipo ? 'Editar tipo de equipo' : 'Nuevo tipo de equipo'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Tipo *</label>
            <input className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Handheld" autoFocus />
          </div>
          <div>
            <label className="label">Modelo *</label>
            <input className="input" value={modelo} onChange={(e) => setModelo(e.target.value)} placeholder="TC72" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Marca</label>
            <input className="input" value={marca} onChange={(e) => setMarca(e.target.value)} placeholder="Zebra" />
          </div>
          <div>
            <label className="label">Prefijo de ID *</label>
            <input
              className="input font-mono uppercase"
              value={prefijo}
              onChange={(e) => setPrefijo(e.target.value)}
              placeholder="ATLASHF"
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={llevaUsuario} onChange={(e) => setLlevaUsuario(e.target.checked)} />
          Este tipo lleva usuario asignado
        </label>
        {tipo && prefijo.trim().toUpperCase() !== tipo.prefijo_id && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Los equipos existentes conservan su código actual. El nuevo prefijo se usará para
            los próximos equipos de este tipo.
          </p>
        )}
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ── Página ───────────────────────────────────────────────────────
export default function Configuracion() {
  const { toast, confirm } = useUI()
  const [tipos, setTipos] = useState<TipoEquipo[]>([])
  const [centros, setCentros] = useState<CentroDistribucion[]>([])
  const [loading, setLoading] = useState(true)
  const [formTipo, setFormTipo] = useState<TipoEquipo | null | 'nuevo'>(null)
  const [nuevoCD, setNuevoCD] = useState('')
  const [respaldando, setRespaldando] = useState(false)

  async function cargar() {
    const [tRes, cRes] = await Promise.all([
      supabase.from('tipos_equipo').select('*').order('tipo').order('modelo'),
      supabase.from('centros_distribucion').select('*').order('nombre'),
    ])
    if (tRes.data) setTipos(tRes.data as TipoEquipo[])
    if (cRes.data) setCentros(cRes.data as CentroDistribucion[])
    setLoading(false)
  }

  useEffect(() => {
    cargar()
  }, [])

  async function toggleTipo(t: TipoEquipo) {
    const ok = await confirm({
      title: t.activo ? 'Desactivar tipo' : 'Reactivar tipo',
      message: t.activo
        ? `${t.tipo} ${t.modelo} dejará de aparecer al agregar equipos nuevos. Los existentes no se tocan.`
        : `${t.tipo} ${t.modelo} volverá a estar disponible al agregar equipos.`,
      confirmLabel: t.activo ? 'Desactivar' : 'Reactivar',
      danger: t.activo,
    })
    if (!ok) return
    await supabase.from('tipos_equipo').update({ activo: !t.activo }).eq('id', t.id)
    toast('success', t.activo ? 'Tipo desactivado.' : 'Tipo reactivado.')
    cargar()
  }

  async function agregarCD(e: FormEvent) {
    e.preventDefault()
    if (!nuevoCD.trim()) return
    const { error } = await supabase.from('centros_distribucion').insert({ nombre: nuevoCD.trim() })
    if (error) {
      toast('error', error.message.includes('duplicate') ? 'Ese CD ya existe.' : error.message)
      return
    }
    toast('success', `CD "${nuevoCD.trim()}" agregado.`)
    setNuevoCD('')
    cargar()
  }

  async function toggleCD(c: CentroDistribucion) {
    await supabase.from('centros_distribucion').update({ activo: !c.activo }).eq('id', c.id)
    cargar()
  }

  async function respaldoCompleto() {
    setRespaldando(true)
    try {
      const [eq, us, fa, co, mo, tr, hi, ti, cd] = await Promise.all([
        supabase.from('equipos').select('*').order('codigo'),
        supabase.from('usuarios_tecnicos').select('*').order('nombre_completo'),
        supabase.from('fallas').select('*').order('fecha_reporte', { ascending: false }),
        supabase.from('consumibles').select('*').order('nombre'),
        supabase.from('movimientos_consumibles').select('*').order('created_at', { ascending: false }),
        supabase.from('transferencias').select('*').order('fecha_envio', { ascending: false }),
        supabase.from('historial').select('*').order('fecha_hora', { ascending: false }).limit(10000),
        supabase.from('tipos_equipo').select('*'),
        supabase.from('centros_distribucion').select('*'),
      ])
      exportMultiSheetExcel(
        [
          { name: 'INVENTARIO', rows: (eq.data as Record<string, unknown>[]) ?? [] },
          { name: 'USUARIOS', rows: (us.data as Record<string, unknown>[]) ?? [] },
          { name: 'FALLAS', rows: (fa.data as Record<string, unknown>[]) ?? [] },
          { name: 'CONSUMIBLES', rows: (co.data as Record<string, unknown>[]) ?? [] },
          { name: 'MOVIMIENTOS', rows: (mo.data as Record<string, unknown>[]) ?? [] },
          { name: 'TRANSFERENCIAS', rows: (tr.data as Record<string, unknown>[]) ?? [] },
          { name: 'HISTORIAL', rows: (hi.data as Record<string, unknown>[]) ?? [] },
          { name: 'TIPOS', rows: (ti.data as Record<string, unknown>[]) ?? [] },
          { name: 'CENTROS', rows: (cd.data as Record<string, unknown>[]) ?? [] },
        ],
        'RESPALDO_WMS-IT'
      )
      toast('success', 'Respaldo completo descargado.')
    } catch {
      toast('error', 'No se pudo generar el respaldo. Intenta de nuevo.')
    } finally {
      setRespaldando(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Configuración</h1>
          <p className="page-sub">Catálogo de tipos, centros de distribución y respaldos</p>
        </div>
        <button onClick={respaldoCompleto} disabled={respaldando} className="btn-secondary">
          <DatabaseBackup size={15} />
          {respaldando ? 'Generando…' : 'Respaldo completo (Excel)'}
        </button>
      </div>

      {/* ── Tipos de equipo ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Tipos de equipo · prefijos de ID
          </h2>
          <button onClick={() => setFormTipo('nuevo')} className="btn-primary">
            <Plus size={15} /> Nuevo tipo
          </button>
        </div>

        <div className="card overflow-x-auto p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              <div className="skeleton h-9" />
              <div className="skeleton h-9" />
            </div>
          ) : (
            <table className="tabla">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Modelo</th>
                  <th>Marca</th>
                  <th>Prefijo ID</th>
                  <th className="text-center">Lleva usuario</th>
                  <th className="text-center">Activo</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {tipos.map((t) => (
                  <tr key={t.id} className={!t.activo ? 'opacity-50' : ''}>
                    <td className="font-medium text-slate-800">{t.tipo}</td>
                    <td className="text-slate-600">{t.modelo}</td>
                    <td className="text-slate-500">{t.marca ?? '—'}</td>
                    <td><span className="tag-id">{t.prefijo_id}</span></td>
                    <td className="text-center text-slate-500">{t.lleva_usuario ? 'Sí' : 'No'}</td>
                    <td className="text-center">
                      <span className={`badge ${t.activo ? 'bg-green-50 text-estado-operativo' : 'bg-slate-100 text-slate-500'}`}>
                        {t.activo ? 'Sí' : 'No'}
                      </span>
                    </td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => setFormTipo(t)}
                          className="btn-secondary btn-icon"
                          title="Editar"
                          aria-label="Editar tipo"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => toggleTipo(t)}
                          className={`btn-icon ${t.activo ? 'btn-danger' : 'btn-secondary'}`}
                          title={t.activo ? 'Desactivar' : 'Reactivar'}
                          aria-label={t.activo ? 'Desactivar tipo' : 'Reactivar tipo'}
                        >
                          <Power size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* ── Centros de distribución ── */}
      <section className="space-y-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Centros de distribución
        </h2>
        <div className="card">
          <form onSubmit={agregarCD} className="mb-3 flex gap-2">
            <div className="relative max-w-sm flex-1">
              <Building2 size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="input !pl-9"
                placeholder="Nombre del nuevo CD…"
                value={nuevoCD}
                onChange={(e) => setNuevoCD(e.target.value)}
              />
            </div>
            <button type="submit" className="btn-primary">
              <Plus size={15} /> Agregar
            </button>
          </form>
          <ul className="divide-y divide-slate-100">
            {centros.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2">
                <span className={`text-sm ${c.activo ? 'text-slate-700' : 'text-slate-400 line-through'}`}>
                  {c.nombre}
                </span>
                <button
                  onClick={() => toggleCD(c)}
                  className={`btn-icon ${c.activo ? 'btn-danger' : 'btn-secondary'}`}
                  title={c.activo ? 'Desactivar' : 'Reactivar'}
                  aria-label={c.activo ? 'Desactivar CD' : 'Reactivar CD'}
                >
                  <Power size={14} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {formTipo && (
        <TipoForm
          tipo={formTipo === 'nuevo' ? null : formTipo}
          onClose={() => setFormTipo(null)}
          onSaved={cargar}
        />
      )}
    </div>
  )
}
