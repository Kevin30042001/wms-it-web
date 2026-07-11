import { useEffect, useRef } from 'react'
import { Printer } from 'lucide-react'
import Modal from '@/components/Modal'
import type { Equipo } from '@/types/database'

/**
 * Etiqueta imprimible del equipo: ID + S/N en Code128 (legible por los
 * lectores 1D de los Zebra). Pensada para imprimirse en la ZQ630 o en
 * cualquier impresora de etiquetas configurada en el sistema.
 */
export default function EtiquetaModal({ equipo, onClose }: { equipo: Equipo; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    ;(async () => {
      const { default: JsBarcode } = await import('jsbarcode')
      if (canvasRef.current) {
        JsBarcode(canvasRef.current, equipo.serie, {
          format: 'CODE128',
          width: 2,
          height: 64,
          displayValue: true,
          fontSize: 14,
          font: 'monospace',
          margin: 8,
        })
      }
    })()
  }, [equipo.serie])

  function imprimir() {
    const dataUrl = canvasRef.current?.toDataURL('image/png')
    if (!dataUrl) return
    const w = window.open('', '_blank', 'width=420,height=320')
    if (!w) return
    w.document.write(`
      <html>
        <head><title>Etiqueta ${equipo.codigo ?? equipo.serie}</title>
        <style>
          body { font-family: monospace; text-align: center; margin: 16px; }
          .id { font-size: 20px; font-weight: bold; letter-spacing: 1px; }
          img { max-width: 100%; }
          @media print { @page { margin: 4mm; } }
        </style></head>
        <body>
          <div class="id">${equipo.codigo ?? ''}</div>
          <img src="${dataUrl}" />
          <script>window.onload = () => { window.print(); }</script>
        </body>
      </html>
    `)
    w.document.close()
  }

  return (
    <Modal title={`Etiqueta — ${equipo.codigo ?? equipo.serie}`} onClose={onClose}>
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-slate-300 bg-white p-4">
        <span className="font-mono text-lg font-bold tracking-wider text-slate-800">
          {equipo.codigo ?? '—'}
        </span>
        <canvas ref={canvasRef} />
      </div>
      <p className="mt-2 text-center text-xs text-slate-400">
        Code128 · legible por los lectores 1D de los equipos Zebra
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className="btn-secondary">Cerrar</button>
        <button onClick={imprimir} className="btn-primary">
          <Printer size={15} /> Imprimir
        </button>
      </div>
    </Modal>
  )
}
