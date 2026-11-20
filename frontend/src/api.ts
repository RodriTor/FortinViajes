// Rebuild forzado para tomar el nuevo VITE_API_URL (termina en /api).
const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, "") ?? "http://localhost:3000/api";
const TOKEN_KEY = "fortinviajes.token";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

export const tokenStore = {
  get(): string | null { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set(t: string) { try { localStorage.setItem(TOKEN_KEY, t); } catch { /* sin almacenamiento */ } },
  clear() { try { localStorage.removeItem(TOKEN_KEY); } catch { /* sin almacenamiento */ } }
};

// Render (plan gratuito) duerme el servicio: si tarda, la pantalla avisa que se está despertando.
const slowListeners = new Set<(slow: boolean) => void>();
export function onSlowRequest(fn: (slow: boolean) => void) { slowListeners.add(fn); return () => { slowListeners.delete(fn); }; }
let pending = 0;
const notify = (slow: boolean) => slowListeners.forEach((l) => l(slow));

export async function api<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  const token = tokenStore.get();
  pending++;
  const timer = setTimeout(() => pending > 0 && notify(true), 4000);
  try {
    let res: Response;
    try {
      res = await fetch(BASE + path, {
        method,
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
    } catch {
      throw new ApiError(0, "No pudimos conectarnos con el servidor. Revisá tu conexión e intentá de nuevo.");
    }
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new ApiError(res.status, data?.error ?? "Ocurrió un error inesperado");
    return data as T;
  } finally {
    clearTimeout(timer);
    pending--;
    if (pending === 0) notify(false);
  }
}
