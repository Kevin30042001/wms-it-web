import { useState, type FormEvent } from 'react'
import Modal from '@/components/Modal'
import { supabase } from '@/lib/supabase'
import type { CentroDistribucion, UsuarioTecnico } from '@/types/database'

interface UsuarioFormProps {
  usuario: UsuarioTecnico | null // null = modo NUEVO
  centros: CentroDistribucion[]
  onClose: () => void
  onSaved: () => void
}

export default function UsuarioForm({ usuario, centros, onClose, onSaved }: UsuarioFormProps) {
  const [nombre, setNombre] = useState(usuario?.nombre_completo ?? '')
  const [numeroUsuario, setNumeroUsuario] = useState(usuario?.numero_usuario ?? '')
  const [cargo, setCargo] = useState(usuario?.cargo ?? '')
  const [cdId, setCdId] = useState(usuario?.cd_id ?? centros[0]?.id ?? '')
  const [activo, setActivo] = useState(usuario?.activo ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!nombre.trim()) {
      setError('El nombre completo es obligatorio.')
      return
    }

    setSaving(true)
    const payload = {
      nombre_completo: nombre.trim(),
      numero_usuario: numeroUsuario.trim() || null,
      cargo: cargo.trim() || null,
      cd_id: cdId || null,
      activo,
    }

    const { error: dbError } = usuario
      ? await supabase.from('usuarios_tecnicos').update(payload).eq('id', usuario.id)
      : await supabase.from('usuarios_tecnicos').insert(payload)

    setSaving(false)

    if (dbError) {
      setError(
        dbError.message.includes('duplicate')
          ? 'Ya existe un usuario con ese N° de usuario.'
          : dbError.message
      )
      return
    }

    onSaved()
    onClose()
  }

  return (
    <Modal title={usuario ? 'Editar usuario' : 'Agregar usuario'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Nombre completo *</label>
          <input className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">N° Usuario</label>
            <input
              className="input font-mono"
              value={numeroUsuario}
              onChange={(e) => setNumeroUsuario(e.target.value)}
              placeholder="k0c0ug0"
            />
          </div>
          <div>
            <label className="label">Cargo</label>
            <input className="input" value={cargo} onChange={(e) => setCargo(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="label">CD Asignado</label>
          <select className="input" value={cdId} onChange={(e) => setCdId(e.target.value)}>
            {centros.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>

        {usuario && (
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
            Usuario activo
          </label>
        )}

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancelar
          </button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
