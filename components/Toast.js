import { createContext, useCallback, useContext, useMemo, useState } from "react";

const ToastContext = createContext({ showToast: () => 0, dismiss: () => {} });

let nextId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message, type = "success", duration = 3200) => {
      const id = ++nextId;
      setToasts((list) => [...list, { id, message, type }]);
      if (duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }
      return id;
    },
    [dismiss]
  );

  const value = useMemo(() => ({ showToast, dismiss }), [showToast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="fixed inset-x-0 bottom-[calc(5.5rem_+_env(safe-area-inset-bottom))] md:bottom-6 md:left-auto md:right-6 z-[60] flex flex-col gap-2 px-4 md:px-0 pointer-events-none"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const STYLE_POR_TIPO = {
  success: { border: "border-success/50", iconBg: "bg-success", icon: "✓" },
  error: { border: "border-danger/50", iconBg: "bg-danger", icon: "!" },
  info: { border: "border-primary/50", iconBg: "bg-primary", icon: "i" },
};

function ToastItem({ toast, onDismiss }) {
  const estilo = STYLE_POR_TIPO[toast.type] || STYLE_POR_TIPO.info;
  return (
    <div
      role="status"
      className={
        "pointer-events-auto flex items-start gap-3 rounded-xl border bg-white shadow-soft px-4 py-3 max-w-sm w-full md:w-auto animate-[toast-in_180ms_ease-out] " +
        estilo.border
      }
    >
      <span
        className={
          "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 " +
          estilo.iconBg
        }
        aria-hidden="true"
      >
        {estilo.icon}
      </span>
      <p className="text-sm flex-1 min-w-0 break-words text-textPrimary">
        {toast.message}
      </p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Fechar aviso"
        className="text-textMuted hover:text-textPrimary shrink-0 p-1 -m-1"
      >
        ✕
      </button>
    </div>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
