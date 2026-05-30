import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { statusFor, type StockStatus } from "@/lib/inventory";

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">{label}</span>
        <Icon className="h-4 w-4 text-muted" />
      </div>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-fg">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

const STATUS_STYLES: Record<StockStatus, { label: string; className: string }> = {
  out: { label: "Out of stock", className: "bg-red-500/15 text-red-400" },
  low: { label: "Low", className: "bg-amber-500/15 text-amber-400" },
  ok: { label: "In stock", className: "bg-emerald-500/15 text-emerald-400" },
};

export function StatusBadge({ quantity }: { quantity: number }) {
  const { label, className } = STATUS_STYLES[statusFor(quantity)];
  return (
    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", className)}>
      {label}
    </span>
  );
}

/** A titled surface used for the dashboard sections. */
export function Panel({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl border border-line bg-surface", className)}>
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 className="text-sm font-semibold text-fg">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
