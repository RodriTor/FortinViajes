import { createContext, ReactNode, useCallback, useContext, useState } from "react";

type Kind = "ok" | "error";
const ToastContext = createContext<(message: string, kind?: Kind) => void>(() => undefined);
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ id: number; message: string; kind: Kind } | null>(null);
  const show = useCallback((message: string, kind: Kind = "ok") => {
    const id = Date.now();
    setToast({ id, message, kind });
    setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 5000);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {toast && <div key={toast.id} className={`toast toast-${toast.kind}`}>{toast.message}</div>}
      </div>
    </ToastContext.Provider>
  );
}
