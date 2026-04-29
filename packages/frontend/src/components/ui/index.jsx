// Minimal shadcn-compatible UI primitives for fhex402
// These are bare-bones implementations using the fhex402 design system.
// For full shadcn/ui, run: npx shadcn@latest add <component>

import { cn } from "@/lib/utils";

// ── Button ────────────────────────────────────────────────────────────────
export function Button({
  children,
  className,
  variant = "default",
  size = "default",
  disabled,
  onClick,
  type = "button",
  ...props
}) {
  const base = "inline-flex items-center justify-center font-medium transition-colors rounded-md focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed";

  const variants = {
    default:   "bg-accent text-white hover:bg-accent-dim",
    outline:   "border border-border-bright text-text-secondary hover:text-text-primary hover:border-accent",
    ghost:     "text-text-secondary hover:text-text-primary hover:bg-elevated",
    destructive: "bg-red-900/30 text-red-400 hover:bg-red-900/50 border border-red-900/50",
  };

  const sizes = {
    default: "px-4 py-2 text-sm",
    sm:      "px-3 py-1.5 text-xs",
    lg:      "px-5 py-2.5 text-sm",
    icon:    "w-8 h-8 p-0",
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    >
      {children}
    </button>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────
export function Badge({ children, className, variant = "default" }) {
  const variants = {
    default: "bg-accent-glow text-accent border-accent/20",
    success: "bg-green-900/20 text-green-400 border-green-900/30",
    error:   "bg-red-900/20 text-red-400 border-red-900/30",
    warning: "bg-yellow-900/20 text-yellow-400 border-yellow-900/30",
    outline: "bg-transparent text-text-secondary border-border-bright",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono border",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────
export function Card({ children, className, ...props }) {
  return (
    <div
      className={cn("card p-4", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className }) {
  return (
    <div className={cn("mb-3", className)}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className }) {
  return (
    <h3 className={cn("text-sm font-semibold text-text-primary", className)}>
      {children}
    </h3>
  );
}

export function CardContent({ children, className }) {
  return <div className={cn("space-y-3", className)}>{children}</div>;
}

// ── Input ─────────────────────────────────────────────────────────────────
export function Input({ className, ...props }) {
  return (
    <input
      className={cn(
        "w-full bg-elevated border border-border-bright rounded-md px-3 py-2 text-sm text-text-primary font-mono",
        "placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors",
        className
      )}
      {...props}
    />
  );
}

// ── Separator ─────────────────────────────────────────────────────────────
export function Separator({ className, orientation = "horizontal" }) {
  return (
    <div
      className={cn(
        orientation === "horizontal" ? "h-px w-full" : "w-px h-full",
        "bg-border",
        className
      )}
    />
  );
}

// ── Skeleton (loading placeholder) ────────────────────────────────────────
export function Skeleton({ className }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md",
        className
      )}
      style={{ background: "var(--bg-elevated)" }}
    />
  );
}

// ── Tooltip wrapper ───────────────────────────────────────────────────────
export function Tooltip({ children, content }) {
  return (
    <div className="relative group inline-flex">
      {children}
      <div
        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 text-[10px] rounded whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-bright)",
          color: "var(--text-secondary)",
          fontFamily: "'SFMono-Regular', 'Cascadia Code', Consolas, monospace",
        }}
      >
        {content}
      </div>
    </div>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────
export function Progress({ value = 0, className }) {
  return (
    <div
      className={cn("h-1.5 rounded-full overflow-hidden", className)}
      style={{ background: "var(--bg-elevated)" }}
    >
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{
          width: `${Math.min(100, Math.max(0, value))}%`,
          background: value > 80 ? "var(--red)" : "var(--accent)",
        }}
      />
    </div>
  );
}

// ── Alert ─────────────────────────────────────────────────────────────────
export function Alert({ children, className, variant = "default" }) {
  const variants = {
    default:     { bg: "var(--bg-elevated)",        border: "var(--border)",              color: "var(--text-secondary)" },
    destructive: { bg: "rgba(239,68,68,0.08)",      border: "rgba(239,68,68,0.2)",        color: "var(--red)" },
    warning:     { bg: "rgba(245,158,11,0.08)",     border: "rgba(245,158,11,0.2)",       color: "#F59E0B" },
    success:     { bg: "rgba(16,185,129,0.08)",     border: "rgba(16,185,129,0.2)",       color: "var(--green)" },
    accent:      { bg: "var(--accent-glow)",         border: "var(--border)",              color: "var(--text-secondary)" },
  };

  const v = variants[variant] || variants.default;

  return (
    <div
      className={cn("rounded-md px-3 py-2.5 text-xs", className)}
      style={{ background: v.bg, border: `1px solid ${v.border}`, color: v.color }}
    >
      {children}
    </div>
  );
}
