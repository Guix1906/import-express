import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowUpRight, ExternalLink } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getKpiDrilldown } from "@/lib/reports.functions";

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export type DrillKind =
  | "triagens"
  | "contratos"
  | "novos_clientes"
  | "faturamento"
  | "conversao"
  | "ticket_medio"
  | "processos"
  | "prazos"
  | "prazos_vencidos"
  | "movimentacoes"
  | "tarefas_concluidas"
  | "a_receber"
  | "a_pagar"
  | "recebido"
  | "inadimplencia"
  | "tarefas_atrasadas"
  | "cards_ativos";

export interface KpiDrillSheetProps {
  kind: DrillKind;
  title: string;
  description?: string;
  period: { from: string; to: string };
  moduleHref: string;
  moduleLabel?: string;
  trigger: ReactNode;
}

export function KpiDrillSheet({
  kind,
  title,
  description,
  period,
  moduleHref,
  moduleLabel,
  trigger,
}: KpiDrillSheetProps) {
  const [open, setOpen] = useState(false);
  const fn = useServerFn(getKpiDrilldown);

  const { data, isLoading } = useQuery({
    queryKey: ["kpi-drill", kind, period],
    queryFn: () => fn({ data: { kind, ...period, limit: 50 } }),
    enabled: open,
    staleTime: 30_000,
  });

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <div onClick={() => setOpen(true)} className="contents">
        {trigger}
      </div>
      <SheetContent side="right" className="w-full sm:max-w-[520px] flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>

        <div className="mt-4 flex items-center justify-between gap-2">
          <Badge variant="secondary" className="rounded-full">
            {isLoading ? "..." : `${data?.length ?? 0} resultado(s)`}
          </Badge>
          <Button asChild size="sm" variant="default" className="gap-1.5">
            <Link to={moduleHref}>
              {moduleLabel ?? "Abrir módulo"} <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>

        <Separator className="my-4" />

        <ScrollArea className="flex-1 -mx-6 px-6">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-xl" />
              ))}
            </div>
          ) : !data || data.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              Nenhum registro encontrado no período.
            </div>
          ) : (
            <ul className="space-y-2 pb-6">
              {data.map((row) => (
                <li
                  key={row.id}
                  className="group rounded-xl border bg-card p-3 hover:shadow-sm hover:border-primary/30 transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{row.title}</p>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        {row.subtitle && <span className="truncate">{row.subtitle}</span>}
                        {row.date && (
                          <span className="shrink-0">
                            {format(new Date(row.date), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {typeof row.value === "number" && (
                        <span className="text-sm font-semibold tabular-nums">
                          {fmtBRL(row.value)}
                        </span>
                      )}
                      {row.status && (
                        <Badge variant="outline" className="text-[10px] h-5">
                          {row.status}
                        </Badge>
                      )}
                      <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
