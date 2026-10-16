import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/cn";

const widths = { sm: "md:max-w-md", md: "md:max-w-2xl", lg: "md:max-w-4xl" };

/**
 * Native <dialog>: focus trap and Esc come free. Full-screen sheet on phones, centred card on desktop.
 * Children only render while open, so forms start fresh each time.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  footer,
  size = "md",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  footer?: ReactNode;
  size?: keyof typeof widths;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      aria-labelledby="dialog-title"
      className={cn(
        "m-0 h-dvh max-h-dvh w-full max-w-full bg-surface p-0 text-ink shadow-2xl",
        "md:m-auto md:h-auto md:max-h-[90dvh] md:rounded-card md:border md:border-line",
        widths[size],
      )}
    >
      {open && (
        <div className="flex h-full max-h-dvh flex-col md:max-h-[90dvh]">
          <header className="flex items-start gap-3 border-b border-line px-4 py-3 md:px-6 md:py-4">
            <div className="min-w-0 flex-1">
              <h2 id="dialog-title" className="truncate text-lg font-semibold">
                {title}
              </h2>
              {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-2 rounded-lg p-2 text-ink-muted hover:bg-surface-muted hover:text-ink"
            >
              <X className="size-5" />
            </button>
          </header>
          <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6">{children}</div>
          {footer && <footer className="pb-safe flex flex-wrap justify-end gap-2 border-t border-line px-4 py-3 md:px-6">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  danger,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button type="button" onClick={onClose} className="h-10 rounded-lg border border-line px-4 text-sm font-medium hover:bg-surface-muted">
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              "h-10 rounded-lg px-4 text-sm font-medium text-white disabled:opacity-50",
              danger ? "bg-rose-600 hover:bg-rose-700" : "bg-brand-600 hover:bg-brand-700",
            )}
          >
            {loading ? "Working…" : confirmLabel}
          </button>
        </>
      }
    >
      <div className="text-sm text-ink-muted">{message}</div>
    </Dialog>
  );
}
