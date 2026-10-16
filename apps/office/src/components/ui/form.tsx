import type { InputHTMLAttributes, ReactNode, Ref, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { useId } from "react";
import { cn } from "../../lib/cn";

const control =
  "w-full rounded-lg border border-line bg-surface px-3 text-ink placeholder:text-ink-subtle shadow-xs transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:bg-surface-muted disabled:text-ink-muted aria-invalid:border-rose-500 aria-invalid:ring-rose-500/20";

/** Label + control + error/hint. The control is passed the generated id via render prop. */
export function Field({
  label,
  error,
  hint,
  required,
  className,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: (props: { id: string; "aria-invalid"?: boolean; "aria-describedby"?: string }) => ReactNode;
}) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
        {required && <span className="ml-0.5 text-rose-500">*</span>}
      </label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-rose-600 dark:text-rose-400">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-ink-subtle">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Input({ className, ref, ...props }: InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> }) {
  return <input ref={ref} className={cn(control, "h-10", className)} {...props} />;
}

export function Select({ className, ref, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { ref?: Ref<HTMLSelectElement> }) {
  return (
    <select ref={ref} className={cn(control, "h-10 pr-8", className)} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ className, ref, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: Ref<HTMLTextAreaElement> }) {
  return <textarea ref={ref} className={cn(control, "min-h-20 py-2", className)} {...props} />;
}

export function Checkbox({ label, className, ref, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; ref?: Ref<HTMLInputElement> }) {
  return (
    <label className={cn("flex cursor-pointer items-center gap-2.5 rounded-lg py-1.5 text-sm text-ink", className)}>
      <input ref={ref} type="checkbox" className="size-4 rounded border-line accent-brand-600" {...props} />
      <span>{label}</span>
    </label>
  );
}

/** Form-level error banner (e.g. the API rejected the request). */
export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
      {message}
    </div>
  );
}
