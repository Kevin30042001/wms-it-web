import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  FileDown,
  FileUp,
  Camera,
  Search,
  Eye,
  Trash2,
  ScrollText,
  Inbox,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useUI } from '@/hooks/useUI'
import { generarMemoBlob, descargarBlob, type MemoDatos } from '@/lib/memoDocx'

interface MemorandoRow {
  id: string
  fecha_generado: string
  cd_destino: string
  asunto: string | null
  num_equipos: number
  series_texto: string | null
  datos: MemoDatos
  archivo_path: string | null
}

interface EntradaRow {
  id: string
  fecha: string
  origen: string | null
  notas: string | null
  archivo_path: string
}

function fechaCorta(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('es-SV', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/**
 * Procesa la foto como "documento escaneado": reduce el tamaño y aplica
 * filtro de escaneo (escala de grises + contraste). Los PDF pasan directo.
 */
async function procesarComoDocumento(file: File, modoEscaneo: boolean): Promise<Blob> {
  if (!file.type.startsWith('image/')) return file
  const bitmap = await createImageBitmap(file)
  const MAX = 1600
  const escala = Math.min(1, MAX / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * escala)
  canvas.height = Math.round(bitmap.height * escala)
  const ctx = canvas.getContext('2d')!
  if (modoEscaneo) ctx.filter = 'grayscale(1) contrast(1.4) brightness(1.08)'
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b ?? file), 'image/jpeg', 0.82)
  )
}

// ── Pestaña: memorandos de salida ────────────────────────────────
function TabSalidas() {
  const { toast, confirm } = useUI()
  const [memos, setMemos] = useState<MemorandoRow[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [loading, setLoading] = useState(true)

  async function cargar() {
    setLoading(true)
    const { data, error } = await supabase
      .from('memorandos')
      .select('*')
      .order('fecha_generado', { ascending: false })
      .limit(500)
    if (error) toast('error', `No se pudieron cargar los memorandos: ${error.message}`)
    setMemos((data as MemorandoRow[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtrados = memos.filter((m) => {
    if (!busqueda.trim()) return true
    const q = busqueda.toLowerCase()
    const texto = `${m.cd_destino} ${m.asunto ?? ''} ${m.series_texto ?? ''} ${fechaCorta(m.fecha_generado)}`.toLowerCase()
    return texto.includes(q)
  })

  async function descargar(m: MemorandoRow) {
    // Primero intenta el archivo original de Storage; si no existe, lo
    // regenera idéntico a partir de los datos guardados.
    if (m.archivo_path) {
      const { data } = await supabase.storage
        .from('documentos')
        .createSignedUrl(m.archivo_path, 3600, { download: true })
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank')
        return
      }
    }
    const blob = await generarMemoBlob(m.datos)
    descargarBlob(blob, m.archivo_path?.split('/').pop() ?? 'Memorando.docx')
  }

  async function eliminar(m: MemorandoRow) {
    const ok = await confirm({
      title: 'Eliminar memorando',
      message: `Se eliminará del historial el memorando a ${m.cd_destino} del ${fechaCorta(m.fecha_generado)}.`,
      confirmLabel: 'Eliminar',
      danger: true,
    })
    if (!ok) return
    if (m.archivo_path) await supabase.storage.from('documentos').remove([m.archivo_path])
    const { error } = await supabase.from('memorandos').delete().eq('id', m.id)
    if (error) toast('error', error.message)
    else toast('success', 'Memorando eliminado del historial.')
    cargar()
  }

  return (
    <div className="space-y-3">
      <div className="relative max-w-md">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          className="input !pl-9"
          placeholder="Buscar por serie, CD destino, asunto o fecha…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      <div className="card overflow-x-auto p-0">
        {loading ? (
          <p className="p-4 text-sm text-slate-400">Cargando…</p>
        ) : filtrados.length === 0 ? (
          <p className="p-4 text-sm text-slate-400">
            No hay memorandos archivados. Genera uno desde Inventario seleccionando equipos.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-3 text-left">Fecha</th>
                <th className="px-3 py-3 text-left">PARA</th>
                <th className="px-3 py-3 text-left">Asunto</th>
                <th className="px-3 py-3 text-left">Equipos</th>
                <th className="px-3 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtrados.map((m) => (
                <tr key={m.id}>
                  <td className="px-3 py-2.5 text-slate-600">{fechaCorta(m.fecha_generado)}</td>
                  <td className="px-3 py-2.5 font-medium text-slate-700">{m.cd_destino}</td>
                  <td className="px-3 py-2.5 text-slate-600">{m.asunto ?? '—'}</td>
                  <td className="px-3 py-2.5 text-slate-600">{m.num_equipos}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => descargar(m)}
                        className="btn-secondary btn-icon"
                        title="Descargar .docx"
                        aria-label="Descargar memorando"
                      >
                        <FileDown size={14} />
                      </button>
                      <button
                        onClick={() => eliminar(m)}
                        className="btn-danger btn-icon"
                        title="Eliminar"
                        aria-label="Eliminar memorando"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ── Pestaña: hojas de entrada ────────────────────────────────────
function TabEntradas() {
  const { toast, confirm } = useUI()
  const [entradas, setEntradas] = useState<EntradaRow[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [loading, setLoading] = useState(true)
  const [origen, setOrigen] = useState('')
  const [notas, setNotas] = useState('')
  const [modoEscaneo, setModoEscaneo] = useState(true)
  const [subiendo, setSubiendo] = useState(false)
  const inputCamara = useRef<HTMLInputElement>(null)
  const inputArchivo = useRef<HTMLInputElement>(null)

  async function cargar() {
    setLoading(true)
    const { data, error } = await supabase
      .from('entradas')
      .select('*')
      .order('fecha', { ascending: false })
      .limit(500)
    if (error) toast('error', `No se pudieron cargar las entradas: ${error.message}`)
    setEntradas((data as EntradaRow[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function subir(file: File) {
    setSubiendo(true)
    try {
      const blob = await procesarComoDocumento(file, modoEscaneo)
      const esPdf = file.type === 'application/pdf'
      const ahora = new Date()
      const stamp = ahora.toISOString().replace(/[-:T]/g, '').slice(0, 14)
      const path = `entradas/${ahora.getFullYear()}/Entrada_${stamp}.${esPdf ? 'pdf' : 'jpg'}`
      const { error: upErr } = await supabase.storage.from('documentos').upload(path, blob, {
        contentType: esPdf ? 'application/pdf' : 'image/jpeg',
      })
      if (upErr) throw upErr
      const { error: dbErr } = await supabase.from('entradas').insert({
        origen: origen.trim() || null,
        notas: notas.trim() || null,
        archivo_path: path,
      })
      if (dbErr) throw dbErr
      toast('success', 'Hoja de entrada guardada.')
      setOrigen('')
      setNotas('')
      cargar()
    } catch (e) {
      toast(
        'error',
        `No se pudo subir la hoja: ${e instanceof Error ? e.message : 'error desconocido'}. Revisa que corriste sql/03_documentos.sql.`
      )
    } finally {
      setSubiendo(false)
      if (inputCamara.current) inputCamara.current.value = ''
      if (inputArchivo.current) inputArchivo.current.value = ''
    }
  }

  function onFile(e: FormEvent<HTMLInputElement>) {
    const file = e.currentTarget.files?.[0]
    if (file) subir(file)
  }

  async function ver(en: EntradaRow) {
    const { data } = await supabase.storage
      .from('documentos')
      .createSignedUrl(en.archivo_path, 3600)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
    else toast('error', 'No se pudo abrir el archivo.')
  }

  async function eliminar(en: EntradaRow) {
    const ok = await confirm({
      title: 'Eliminar hoja de entrada',
      message: `Se eliminará la hoja del ${fechaCorta(en.fecha)} (${en.origen ?? 'sin origen'}).`,
      confirmLabel: 'Eliminar',
      danger: true,
    })
    if (!ok) return
    await supabase.storage.from('documentos').remove([en.archivo_path])
    const { error } = await supabase.from('entradas').delete().eq('id', en.id)
    if (error) toast('error', error.message)
    else toast('success', 'Hoja de entrada eliminada.')
    cargar()
  }

  const filtradas = entradas.filter((en) => {
    if (!busqueda.trim()) return true
    const q = busqueda.toLowerCase()
    return `${en.origen ?? ''} ${en.notas ?? ''} ${fechaCorta(en.fecha)}`.toLowerCase().includes(q)
  })

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <p className="text-sm font-medium text-slate-700">Registrar hoja de entrada</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Origen (CD o proveedor)</label>
            <input
              className="input"
              value={origen}
              onChange={(e) => setOrigen(e.target.value)}
              placeholder="Ej. CD Apopa 7417"
            />
          </div>
          <div>
            <label className="label">Notas</label>
            <input
              className="input"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Ej. 5 handhelds TC72 + cargadores"
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            className="h-4 w-4 accent-blue-600"
            checked={modoEscaneo}
            onChange={(e) => setModoEscaneo(e.target.checked)}
          />
          Modo documento (blanco y negro con contraste, estilo escáner)
        </label>
        <div className="flex flex-wrap gap-2">
          {/* capture="environment" abre la cámara trasera directo en el teléfono */}
          <input
            ref={inputCamara}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={onFile}
          />
          <input
            ref={inputArchivo}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={onFile}
          />
          <button
            onClick={() => inputCamara.current?.click()}
            disabled={subiendo}
            className="btn-primary"
          >
            <Camera size={15} /> {subiendo ? 'Subiendo…' : 'Tomar foto'}
          </button>
          <button
            onClick={() => inputArchivo.current?.click()}
            disabled={subiendo}
            className="btn-secondary"
          >
            <FileUp size={15} /> Subir archivo
          </button>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          className="input !pl-9"
          placeholder="Buscar por origen, notas o fecha…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      <div className="card overflow-x-auto p-0">
        {loading ? (
          <p className="p-4 text-sm text-slate-400">Cargando…</p>
        ) : filtradas.length === 0 ? (
          <p className="p-4 text-sm text-slate-400">
            No hay hojas de entrada registradas todavía.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-3 text-left">Fecha</th>
                <th className="px-3 py-3 text-left">Origen</th>
                <th className="px-3 py-3 text-left">Notas</th>
                <th className="px-3 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtradas.map((en) => (
                <tr key={en.id}>
                  <td className="px-3 py-2.5 text-slate-600">{fechaCorta(en.fecha)}</td>
                  <td className="px-3 py-2.5 font-medium text-slate-700">{en.origen ?? '—'}</td>
                  <td className="px-3 py-2.5 text-slate-600">{en.notas ?? '—'}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => ver(en)}
                        className="btn-secondary btn-icon"
                        title="Ver documento"
                        aria-label="Ver documento"
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        onClick={() => eliminar(en)}
                        className="btn-danger btn-icon"
                        title="Eliminar"
                        aria-label="Eliminar entrada"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ── Página ───────────────────────────────────────────────────────
export default function Documentos() {
  const [tab, setTab] = useState<'salidas' | 'entradas'>('salidas')

  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-title">Documentos</h1>
        <p className="page-sub">Memorandos de salida y hojas de entrada, con historial por fecha</p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setTab('salidas')}
          className={tab === 'salidas' ? 'btn-primary' : 'btn-secondary'}
        >
          <ScrollText size={15} /> Salidas (memorandos)
        </button>
        <button
          onClick={() => setTab('entradas')}
          className={tab === 'entradas' ? 'btn-primary' : 'btn-secondary'}
        >
          <Inbox size={15} /> Entradas (hojas recibidas)
        </button>
      </div>

      {tab === 'salidas' ? <TabSalidas /> : <TabEntradas />}
    </div>
  )
}
