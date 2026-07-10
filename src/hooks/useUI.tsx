import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react'

type ToastKind = 'success' | 'error' | 'info'

interface Toast {
  id: number
  kind: ToastKind
  text: string
}

interface ConfirmOptions {
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
}

interface UIContextValue {
  toast: (kind: ToastKind, text: string) => void
  confirm: (opts: ConfirmOptions) => Promise<boolean>
}

const UIContext = createContext<UIContextValue | undefined>(undefined)

const TOAST_ICON: Record<ToastKind, ReactNode> = {
  success: <CheckCircle2 size={17} className="text-estado-operativo" />,
  error: <AlertTriangle size={17} className="text-estado-fuera" />,
  info: <Info size={17} className="text-wmblue" />,
}

export function UIProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [confirmState, setConfirmState] = useState<
    (ConfirmOptions & { resolve: (ok: boolean) => void }) | null
  >(null)
  const nextId = useRef(1)

  const toast = useCallback((kind: ToastKind, text: string) => {
    const id = nextId.current++
    setToasts((t) => [...t, { id, kind, text }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000)
  }, [])

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({ ...opts, resolve })
    })
  }, [])

  function resolverConfirm(ok: boolean) {
    confirmState?.resolve(ok)
    setConfirmState(null)
  }

  return (
    <UIContext.Provider value={{ toast, confirm }}>
      {children}

      {/* Toasts */}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-80 flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex items-start gap-2.5 rounded-lg border border-slate-200 bg-white p-3 shadow-pop"
          >
            {TOAST_ICON[t.kind]}
            <p className="flex-1 text-sm text-slate-700">{t.text}</p>
            <button
              onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}
              className="text-slate-400 hover:text-slate-600"
              aria-label="Cerrar aviso"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Diálogo de confirmación */}
      {confirmState && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-ink/50 p-4"
          onClick={() => resolverConfirm(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-white p-5 shadow-pop"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-lg font-bold uppercase tracking-wide text-slate-900">
              {confirmState.title}
            </h3>
            <p className="mt-2 text-sm text-slate-600">{confirmState.message}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => resolverConfirm(false)} className="btn-secondary">
                Cancelar
              </button>
              <button
                onClick={() => resolverConfirm(true)}
                className={confirmState.danger ? 'btn-danger' : 'btn-primary'}
                autoFocus
              >
                {confirmState.confirmLabel ?? 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </UIContext.Provider>
  )
}

export function useUI() {
  const ctx = useContext(UIContext)
  if (!ctx) throw new Error('useUI debe usarse dentro de <UIProvider>')
  return ctx
}
