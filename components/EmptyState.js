export default function EmptyState({ icon, title, description, action }) {
  return (
    <div className="rounded-2xl bg-white border border-dashed border-borderSoft p-8 text-center">
      {icon && (
        <div
          className="mx-auto mb-3 w-12 h-12 rounded-full bg-primarySoft flex items-center justify-center text-primary text-2xl"
          aria-hidden="true"
        >
          {icon}
        </div>
      )}
      {title && <p className="font-semibold text-textPrimary">{title}</p>}
      {description && (
        <p className="text-textMuted text-sm mt-1 max-w-sm mx-auto">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
