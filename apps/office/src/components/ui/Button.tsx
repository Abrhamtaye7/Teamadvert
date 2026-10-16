import type { ButtonHTMLAttributes, ComponentType, ReactNode } from "react";
import { Link, type LinkProps } from "react-router";
import { Loader2 } from "lucide-react";
import { cn } from "../../lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "accent" | "success";
type Size = "sm" | "md" | "lg" | "icon";

const variants: Record<Variant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 shadow-sm",
  accent: "bg-accent-500 text-white hover:bg-accent-600 shadow-sm",
  success: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm",
  danger: "bg-rose-600 text-white hover:bg-rose-700 shadow-sm",
  secondary: "bg-surface text-ink border border-line hover:bg-surface-muted",
  ghost: "text-ink-muted hover:bg-surface-muted hover:text-ink",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-5 text-base gap-2",
  icon: "h-10 w-10 justify-center",
};

const base =
  "inline-flex shrink-0 items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:pointer-events-none disabled:opacity-50 cursor-pointer";

type Common = { variant?: Variant; size?: Size; icon?: ComponentType<{ className?: string }>; children?: ReactNode };

export function Button({
  variant = "primary",
  size = "md",
  icon: Icon,
  loading,
  className,
  children,
  type = "button",
  disabled,
  ...props
}: Common & ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button type={type} disabled={disabled || loading} className={cn(base, variants[variant], sizes[size], className)} {...props}>
      {loading ? <Loader2 className="size-4 animate-spin" /> : Icon ? <Icon className="size-4" /> : null}
      {children}
    </button>
  );
}

export function ButtonLink({ variant = "primary", size = "md", icon: Icon, className, children, ...props }: Common & LinkProps) {
  return (
    <Link className={cn(base, variants[variant], sizes[size], className)} {...props}>
      {Icon ? <Icon className="size-4" /> : null}
      {children}
    </Link>
  );
}
