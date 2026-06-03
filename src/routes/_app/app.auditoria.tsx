import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listActivityLogs } from "@/lib/activity-log.functions";
import { PageHeader } from "@/components/app/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { User, Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_app/app/auditoria")({
  component: AuditoriaPage,
});

const ACTION_LABELS: Record<string, { label: string; tone: string }> = {
  create: { label: "Criou", tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  update: { label: "Editou", tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  delete: { label: "Excluiu", tone: "bg-rose-500/15 text-rose-700 dark:text-rose-300" },
  activate: { label: "Ativou", tone: "bg-blue-500/15 text-blue-700 dark:text-blue-300" },
};

function AuditoriaPage() {
  const fetchLogs = useServerFn(listActivityLogs);
  const { data, isLoading } = useQuery({
    queryKey: ["activity-logs"],
    queryFn: () => fetchLogs({ data: { limit: 200 } }),
  });

  const logs = data?.logs ?? [];

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Auditoria" subtitle="Histórico completo de ações no sistema" />

      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            Nenhuma atividade registrada ainda.
          </div>
        ) : (
          <div className="divide-y">
            {logs.map((log) => {
              const action = ACTION_LABELS[log.action] ?? {
                label: log.action,
                tone: "bg-muted text-foreground",
              };
              return (
                <div
                  key={log.id}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-muted/40 transition-colors"
                >
                  <Badge className={`${action.tone} border-0`} variant="secondary">
                    {action.label}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {log.entity_label || "—"}{" "}
                      <span className="text-muted-foreground font-normal">({log.entity_type})</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" /> {log.user_name}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
