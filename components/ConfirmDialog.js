import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";

const ConfirmContext = createContext({ confirm: () => Promise.resolve(true) });

const DEFAULTS = {
  title: "Confirmar",
  description: "",
  confirmLabel: "Confirmar",
  cancelLabel: "Cancelar",
  danger: false,
};

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  const resolverRef = useRef(null);

  const confirm = useCallback((options = {}) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setState({ ...DEFAULTS, ...options });
    });
  }, []);

  function resolver(result) {
    const fn = resolverRef.current;
    resolverRef.current = null;
    setState(null);
    if (fn) fn(result);
  }

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {state && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center px-4 bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-label={state.title}
          onClick={() => resolver(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-soft max-w-sm w-full p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-textPrimary">
              {state.title}
            </h2>
            {state.description && (
              <p className="text-sm text-textSecondary mt-2 whitespace-pre-wrap">
                {state.description}
              </p>
            )}
            <div className="flex gap-2 justify-end mt-5">
              <button
                type="button"
                onClick={() => resolver(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-textMuted hover:text-textPrimary"
              >
                {state.cancelLabel}
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => resolver(true)}
                className={
                  "px-4 py-2 rounded-xl text-sm font-semibold text-white transition-colors " +
                  (state.danger
                    ? "bg-danger hover:bg-red-600"
                    : "bg-primary hover:bg-primaryDark")
                }
              >
                {state.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  return useContext(ConfirmContext).confirm;
}
