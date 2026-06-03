import type { ReactNode } from "react";
import { AlertCircle, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function PremiumCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border bg-card p-5 shadow-sm", className)}>
      {children}
    </section>
  );
}

export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <PremiumCard className={className}>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </header>
      {children}
    </PremiumCard>
  );
}

export function KpiCard({
  label,
  value,
  helper,
  icon,
}: {
  label: string;
  value: string | number;
  helper?: string;
  icon?: ReactNode;
}) {
  return (
    <PremiumCard>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        {icon && <div className="text-primary">{icon}</div>}
      </div>
      <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">{value}</p>
      {helper && <p className="mt-1 text-xs text-muted-foreground">{helper}</p>}
    </PremiumCard>
  );
}

export function StatusBadge({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "muted" | "success" | "warning" | "danger" | "info";
}) {
  const tones = {
    muted: "border-muted bg-muted/50 text-muted-foreground",
    success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
    warning: "border-amber-500/30 bg-amber-500/10 text-amber-700",
    danger: "border-rose-500/30 bg-rose-500/10 text-rose-700",
    info: "border-blue-500/30 bg-blue-500/10 text-blue-700",
  };
  return (
    <Badge variant="outline" className={cn("text-[10px]", tones[tone])}>
      {children}
    </Badge>
  );
}

export function LoadingSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-16 w-full" />
      ))}
    </div>
  );
}

export function PremiumEmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed bg-card p-10 text-center">
      <Inbox className="mx-auto h-8 w-8 text-muted-foreground/60" />
      <p className="mt-3 font-semibold">{title}</p>
      {description && (
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function PermissionDenied({
  message = "Você não tem permissão para acessar esta área.",
}: {
  message?: string;
}) {
  return (
    <PremiumEmptyState
      title="Acesso restrito"
      description={message}
      action={
        <Button variant="outline" disabled className="gap-2">
          <AlertCircle className="h-4 w-4" />
          Permissão necessária
        </Button>
      }
    />
  );
}
