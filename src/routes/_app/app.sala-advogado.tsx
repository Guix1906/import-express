import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Clock, DoorOpen, FileText, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { startTriageAttendance } from "@/lib/triagem-flow.functions";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/use-active-company";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader, EmptyState } from "@/components/app/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import type { TriageListItem } from "@/features/triagem/types";
import {
  elapsedLabel,
  triagePriorityClass,
  triagePriorityLabels,
  triageStatusClass,
  triageStatusLabels,
} from "@/features/triagem/utils";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/app/sala-advogado")({
  component: LawyerRoomPage,
});

function LawyerRoomPage() {
  const { companyId } = useActiveCompany();
  const { user } = useAuth();
  const qc = useQueryClient();
  const startFn = useServerFn(startTriageAttendance);

  const { data: triages = [], isLoading } = useQuery({
    queryKey: ["lawyer-room-triages", companyId, user?.id],
    enabled: !!companyId && !!user,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("triagens")
        .select(
          "id, contact_name, contact_phone, contact_email, document, city, practice_area, demand_type, priority, origin, status, assigned_to, client_id, scheduled_at, started_at, created_at",
        )
        .eq("company_id", companyId!)
        .eq("assigned_to", user!.id)
        .in("status", ["waiting_lawyer", "in_attendance", "waiting_documents"])
        .order("created_at", { ascending: true })
        .limit(40);
      if (error) throw error;
      return (data ?? []) as TriageListItem[];
    },
  });

  const startMut = useMutation({
    mutationFn: (triagemId: string) => startFn({ data: { triagemId } }),
    onSuccess: () => {
      toast.success("Atendimento iniciado");
      qc.invalidateQueries({ queryKey: ["lawyer-room-triages", companyId, user?.id] });
      qc.invalidateQueries({ queryKey: ["triagens", companyId] });
    },
    onError: (e: Error) => toast.error("Erro ao iniciar", { description: e.message }),
  });

  const waiting = triages.filter((t) => t.status === "waiting_lawyer");
  const active = triages.filter((t) => t.status === "in_attendance");

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Sala do Advogado"
        subtitle="Visão rápida para ler o resumo antes do cliente entrar e iniciar o atendimento sem atrito."
        actions={
          <Button variant="outline" asChild>
            <Link to="/app/triagem">Ver triagens</Link>
          </Button>
        }
      />

      <section className="grid gap-3 md:grid-cols-3">
        <Kpi label="Clientes aguardando" value={waiting.length} icon={DoorOpen} />
        <Kpi label="Em atendimento" value={active.length} icon={PlayCircle} />
        <Kpi
          label="Com pendências"
          value={triages.filter((t) => t.status === "waiting_documents").length}
          icon={FileText}
        />
      </section>

      <section className="rounded-2xl border bg-card shadow-sm">
        <div className="border-b p-4">
          <h2 className="font-semibold">Triagens atribuídas a mim</h2>
          <p className="text-sm text-muted-foreground">Ordenadas por tempo de espera.</p>
        </div>
        {isLoading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : triages.length === 0 ? (
          <EmptyState
            title="Nenhum cliente aguardando"
            description="Quando a secretária enviar uma triagem para você, ela aparecerá aqui."
          />
        ) : (
          <div className="divide-y">
            {triages.map((t) => (
              <article
                key={t.id}
                className="grid gap-4 p-4 lg:grid-cols-[1fr_auto] lg:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{t.contact_name || "Cliente sem nome"}</h3>
                    <Badge
                      variant="outline"
                      className={cn("text-[10px]", triageStatusClass[t.status])}
                    >
                      {triageStatusLabels[t.status]}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={cn("text-[10px]", triagePriorityClass[t.priority])}
                    >
                      {triagePriorityLabels[t.priority]}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t.practice_area || "Área não definida"} ·{" "}
                    {t.demand_type || "Demanda não definida"} ·{" "}
                    {t.contact_phone || t.contact_email || "Contato não informado"}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Espera {elapsedLabel(t.created_at)}
                    </span>
                    <span>Documentos: ver aba da triagem</span>
                    <span>Histórico rápido disponível no detalhe</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <Button variant="outline" asChild>
                    <Link to="/app/triagem/$id" params={{ id: t.id }}>
                      Abrir triagem
                    </Link>
                  </Button>
                  <Button
                    disabled={t.status === "in_attendance" || startMut.isPending}
                    onClick={() => startMut.mutate(t.id)}
                  >
                    <PlayCircle className="mr-2 h-4 w-4" /> Iniciar atendimento
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Kpi({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof DoorOpen;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{label}</span>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
