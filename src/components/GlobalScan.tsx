import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ScanBarcode, Search, ArrowRight, Camera, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Equipo, EstadoEquipo } from '@/types/database'

const ESTADO_ESTILO: Record<EstadoEquipo, string> = {
  Operativo: 'bg-green-50 text-estado-operativo',
  'En reparación': 'bg-orange-50 text-estado-reparacion',
  'Fuera de servicio': 'bg-red-50 text-estado-fuera',
  'En bodega': 'bg-blue-50 text-estado-bodega',
  'Reportado con falla': 'bg-amber-50 text-estado-falla',
  Transferido: 'bg-slate-100 text-estado-transferido',
}

/**
 * Escáner global — la firma del sistema:
 *  · Ctrl+K (o Cmd+K) abre el buscador desde cualquier pantalla.
 *  · Disparar el escáner Zebra SIN estar en ningún campo también lo abre:
 *    detecta la ráfaga de teclas del lector (más rápida que un humano)
 *    terminada en Enter, y busca ese S/N al instante.
 */
export default function GlobalScan() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [resultados, setResultados] = useState<Equipo[]>([])
  const [buscando, setBuscando] = useState(false)
  const [camaraAbierta, setCamaraAbierta] = useState(false)
  const camaraRef = useRef<{ stop: () => Promise<void> } | null>(null)
  const navigate = useNavigate()

  const buffer = useRef('')
  const lastKey = useRef(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounce = useRef<ReturnType<typeof setTimeout>>()

  const buscar = useCallback(async (q: string) => {
    const term = q.trim()
    if (term.length < 2) {
      setResultados([])
      return
    }
    setBuscando(true)
    const { data } = await supabase
      .from('equipos')
      .select('*')
      .or(`serie.ilike.%${term}%,codigo.ilike.%${term}%`)
      .limit(8)
    setResultados((data as Equipo[]) ?? [])
    setBuscando(false)
  }, [])

  // Escáner por cámara (html5-qrcode, carga dinámica)
  useEffect(() => {
    if (!camaraAbierta) return
    let activo = true
    ;(async () => {
      const { Html5Qrcode } = await import('html5-qrcode')
      if (!activo) return
      const scanner = new Html5Qrcode('camara-scan')
      camaraRef.current = scanner
      try {
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 120 } },
          (texto) => {
            setQuery(texto)
            buscar(texto)
            setCamaraAbierta(false)
          },
          () => {}
        )
      } catch {
        setCamaraAbierta(false)
      }
    })()
    return () => {
      activo = false
      camaraRef.current?.stop().catch(() => {})
      camaraRef.current = null
    }
  }, [camaraAbierta, buscar])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Ctrl+K / Cmd+K: abrir buscador manual
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(true)
        return
      }
      if (e.key === 'Escape') {
        setOpen(false)
        return
      }

      // Detección de escáner: ignorar si el usuario está escribiendo en un campo
      const t = e.target as HTMLElement
      const enCampo =
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable
      if (enCampo) return

      const ahora = Date.now()
      if (ahora - lastKey.current > 80) buffer.current = '' // pausa humana: reiniciar
      lastKey.current = ahora

      if (e.key === 'Enter') {
        if (buffer.current.length >= 5) {
          const sn = buffer.current
          setQuery(sn)
          setOpen(true)
          buscar(sn)
        }
        buffer.current = ''
      } else if (e.key.length === 1) {
        buffer.current += e.key
      }
    }

    function onOpenEvent() {
      setOpen(true)
    }

    document.addEventListener('keydown', onKey)
    window.addEventListener('wms:open-search', onOpenEvent)
    return () => {
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('wms:open-search', onOpenEvent)
    }
  }, [buscar])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
    else {
      setQuery('')
      setResultados([])
    }
  }, [open])

  function irAInventario(eq: Equipo) {
    setOpen(false)
    navigate(`/inventario?q=${encodeURIComponent(eq.serie)}`)
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center bg-ink/50 p-4 pt-[12vh]"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-slate-100 px-4">
          <ScanBarcode size={18} className="shrink-0 text-wmblue" />
          <input
            ref={inputRef}
            className="h-12 w-full bg-transparent font-mono text-sm outline-none placeholder:font-sans"
            placeholder="Escanea un S/N o escribe para buscar…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              clearTimeout(debounce.current)
              debounce.current = setTimeout(() => buscar(e.target.value), 250)
            }}
          />
          <button
            onClick={() => setCamaraAbierta(!camaraAbierta)}
            className="shrink-0 rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-wmblue"
            title="Escanear con la cámara"
            aria-label="Escanear con la cámara"
          >
            {camaraAbierta ? <X size={17} /> : <Camera size={17} />}
          </button>
          <kbd className="shrink-0 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-400">
            ESC
          </kbd>
        </div>

        {camaraAbierta && (
          <div className="border-b border-slate-100 bg-black">
            <div id="camara-scan" className="mx-auto max-w-sm" />
          </div>
        )}

        <div className="max-h-80 overflow-y-auto">
          {buscando ? (
            <div className="space-y-2 p-4">
              <div className="skeleton h-10" />
              <div className="skeleton h-10" />
            </div>
          ) : resultados.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-8 text-center">
              <Search size={22} className="text-slate-300" />
              <p className="text-sm text-slate-500">
                {query.trim().length < 2
                  ? 'Dispara el escáner o escribe al menos 2 caracteres.'
                  : 'Sin coincidencias para ese S/N o ID.'}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {resultados.map((eq) => (
                <li key={eq.id}>
                  <button
                    onClick={() => irAInventario(eq)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
                  >
                    <span className="tag-id shrink-0">{eq.codigo ?? '—'}</span>
                    <span className="flex-1 truncate font-mono text-xs text-slate-700">
                      {eq.serie}
                    </span>
                    <span className={`badge shrink-0 ${ESTADO_ESTILO[eq.estado]}`}>
                      {eq.estado}
                    </span>
                    <ArrowRight size={14} className="shrink-0 text-slate-300" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-[11px] text-slate-400">
          Tip: desde cualquier pantalla, dispara el escáner y este buscador se abre solo.
        </div>
      </div>
    </div>
  )
}
