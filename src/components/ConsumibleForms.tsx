import { useState, type FormEvent } from 'react'
import Modal from '@/components/Modal'
import { supabase } from '@/lib/supabase'
import { useUI } from '@/hooks/useUI'
import type { Consumible, TipoMovimiento, UsuarioResumen } from '@/types/database'

// ── Formulario de consumible (crear/editar el artículo) ─────────
interface ConsumibleFormProps {
  consumible: Consumible | null
  onClose: () => void
  onSaved: () => void
}

export function ConsumibleForm({ consumible, onClose, onSaved }: ConsumibleFormProps) {
  const { toast } = useUI()
  const [nombre, setNombre] = useState(consumible?.nombre ?? '')
  const [categoria, setCategoria] = useState(consumible?.categoria ?? '')
  const [unidad, setUnidad] = useState(consumible?.unidad ?? 'Unidad')
  const [stock, setStock] = useState(consumible?.stock ?? 0)
  const [stockMin, setStockMin] = useState(consumible?.stock_min ?? 0)
  const [stockMax, setStockMax] = useState(consumible?.stock_max ?? 0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!nombre.trim()) {
      setError('El nombre es obligatorio.')
      return
    }
    if (stockMax > 0 && stockMin > stockMax) {
      setError('El stock mínimo no puede ser mayor que el máximo.')
      return
    }
    setSaving(true)
    const payload = {
      nombre: nombre.trim(),
      categoria: categoria.trim() || null,
      unidad: unidad.trim() || 'Unidad',
      stock,
      stock_min: stockMin,
      stock_max: stockMax,
    }
    const { error: dbError } = consumible
      ? await supabase.from('consumibles').update(payload).eq('id', consumible.id)
      : await supabase.from('consumibles').insert(payload)
    setSaving(false)
    if (dbError) {
      setError(dbError.message)
      return
    }
    toast('success', consumible ? 'Consumible actualizado.' : 'Consumible creado.')
    onSaved()
    onClose()
  }

  return (
    <Modal title={consumible ? 'Editar consumible' : 'Nuevo consumible'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Nombre *</label>
          <input className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus placeholder="Etiquetas térmicas 4x6" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Categoría</label>
            <input className="input" value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="Impresión" />
          </div>
          <div>
            <label className="label">Unidad</label>
            <input className="input" value={unidad} onChange={(e) => setUnidad(e.target.value)} placeholder="Rollo, Caja, Unidad…" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">Stock actual</label>
            <input type="number" min={0} className="input" value={stock} onChange={(e) => setStock(Number(e.target.value))} disabled={!!consumible} />
            {consumible && <p className="mt-1 text-[11px] text-slate-400">El stock se cambia con movimientos.</p>}
          </div>
          <div>
            <label className="label">Mínimo</label>
            <input type="number" min={0} className="input" value={stockMin} onChange={(e) => setStockMin(Number(e.target.value))} />
          </div>
          <div>
            <label className="label">Máximo</label>
            <input type="number" min={0} className="input" value={stockMax} onChange={(e) => setStockMax(Number(e.target.value))} />
          </div>
        </div>
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

// ── Formulario de movimiento (entrada/salida de stock) ──────────
const MOTIVOS: Record<TipoMovimiento, string[]> = {
  Entrada: ['Entrada de mercancía', 'Devolución', 'Ajuste de inventario'],
  Salida: ['Uso normal', 'Pérdida', 'Vencimiento', 'Ajuste de inventario'],
}

interface MovimientoFormProps {
  consumible: Consumible
  tipo: TipoMovimiento
  usuarios: UsuarioResumen[]
  onClose: () => void
  onSaved: () => void
}

export function MovimientoForm({ consumible, tipo, usuarios, onClose, onSaved }: MovimientoFormProps) {
  const { toast } = useUI()
  const [cantidad, setCantidad] = useState(1)
  const [motivo, setMotivo] = useState(MOTIVOS[tipo][0])
  const [responsable, setResponsable] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (cantidad <= 0) {
      setError('La cantidad debe ser mayor que cero.')
      return
    }
    if (tipo === 'Salida' && cantidad > consumible.stock) {
      setError(`Solo hay ${consumible.stock} ${consumible.unidad}(s) en stock.`)
      return
    }
    setSaving(true)
    const { error: dbError } = await supabase.from('movimientos_consumibles').insert({
      consumible_id: consumible.id,
      tipo,
      cantidad,
      motivo,
      responsable_id: responsable || null,
      observaciones: observaciones.trim() || null,
    })
    setSaving(false)
    if (dbError) {
      setError(dbError.message)
      return
    }
    toast(
      'success',
      `${tipo === 'Entrada' ? 'Ingresaron' : 'Salieron'} ${cantidad} ${consumible.unidad}(s) de ${consumible.nombre}.`
    )
    onSaved()
    onClose()
  }

  return (
    <Modal
      title={`${tipo === 'Entrada' ? 'Agregar stock' : 'Descontar'} — ${consumible.nombre}`}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
          Stock actual: <strong>{consumible.stock}</strong> {consumible.unidad}(s)
          · Mín: {consumible.stock_min} · Máx: {consumible.stock_max}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Cantidad *</label>
            <input
              type="number"
              min={1}
              className="input"
              value={cantidad}
              onChange={(e) => setCantidad(Number(e.target.value))}
              autoFocus
            />
          </div>
          <div>
            <label className="label">Motivo</label>
            <select className="input" value={motivo} onChange={(e) => setMotivo(e.target.value)}>
              {MOTIVOS[tipo].map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Responsable</label>
          <select className="input" value={responsable} onChange={(e) => setResponsable(e.target.value)}>
            <option value="">— Seleccionar —</option>
            {usuarios.filter((u) => u.activo).map((u) => (
              <option key={u.id} value={u.id}>{u.nombre_completo}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Observaciones</label>
          <textarea className="input" rows={2} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
        </div>
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Guardando…' : tipo === 'Entrada' ? 'Agregar stock' : 'Descontar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
