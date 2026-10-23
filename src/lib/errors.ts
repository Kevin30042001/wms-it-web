/**
 * Saca un mensaje legible de cualquier cosa que se haya lanzado como error.
 * Supabase-js a veces rechaza una promesa con un PostgrestError/AuthError
 * que es un objeto plano (no hereda de `Error`), así que un simple
 * `String(e)` termina mostrando "[object Object]" en vez del mensaje real.
 */
export function describeError(e: unknown): string {
  if (e instanceof Error) return e.message
  if (e && typeof e === 'object') {
    const anyE = e as Record<string, unknown>
    if (typeof anyE.message === 'string' && anyE.message) return anyE.message
    try {
      return JSON.stringify(e)
    } catch {
      // sigue al fallback de abajo
    }
  }
  return String(e)
}
