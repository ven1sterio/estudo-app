import { useEffect } from "react";

export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  maxWidth = "max-w-lg",
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = anterior;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[65] flex items-end sm:items-center justify-center bg-black/40 sm:px-4"
      role="dialog"
      aria-modal="true"
      aria-label={title || "Modal"}
      onClick={onClose}
    >
      <div
        className={
          "bg-white rounded-t-2xl sm:rounded-2xl shadow-soft w-full " +
          maxWidth +
          " max-h-[90dvh] overflow-y-auto overscroll-contain p-5 pb-[calc(1rem_+_env(safe-area-inset-bottom))] sm:pb-5"
        }
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          {title ? (
            <h2 className="text-lg font-semibold text-textPrimary">{title}</h2>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onClose}
            className="text-textMuted hover:text-textPrimary w-8 h-8 flex items-center justify-center"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>
        {children}
        {footer && <div className="mt-4">{footer}</div>}
      </div>
    </div>
  );
}
