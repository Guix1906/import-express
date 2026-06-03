import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Mail,
  Phone,
  Briefcase,
  CheckSquare,
  Calendar,
  Clock,
  AlertTriangle,
  Crown,
  ShieldCheck,
  Eye,
  Users2,
  Shield,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/use-active-company";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/app/equipe/$id")({ component: MemberDetailPage });

type AppRole = "owner" | "admin" | "lawyer" | "assistant" | "viewer";

const ROLE_LABEL: Record<AppRole, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  lawyer: "Advogado",
  assistant: "Assistente",
  viewer: "Visualizador",
};
const ROLE_ICON: Record<AppRole, typeof Shield> = {
  owner: Crown,
  admin: ShieldCheck,
  lawyer: Briefcase,
  assistant: Users2,
  viewer: Eye,
};
const ROLE_STYLE: Record<AppRole, string> = {
  owner: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  admin: "bg-primary/10 text-primary border-primary/20",
  lawyer: "bg-indigo-500/10 text-indigo-700 border-indigo-500/20",
  assistant: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  viewer: "bg-muted text-muted-foreground border-border",
};

function fmt(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}
function fmtDt(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function MemberDetailPage() {
  const { id } = Route.useParams();
  const { companyId } = useActiveCompany();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["team-member-detail", companyId, id],
    enabled: !!companyId && !!id,
    queryFn: async () => {
      const [profileRes, rolesRes, casesRes, tasksRes, eventsRes, deadlinesRes, atendsRes] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("id, full_name, oab_number, oab_state")
            .eq("id", id)
            .maybeSingle(),
          supabase.from("user_roles").select("role").eq("company_id", companyId!).eq("user_id", id),
          supabase
            .from("cases")
            .select("id, title, status, cnj_number, created_at, client:clients(name)")
            .eq("company_id", companyId!)
            .eq("assigned_to", id)
            .order("created_at", { ascending: false }),
          supabase
            .from("tasks")
            .select("id, title, status, priority, due_date, completed_at")
            .eq("company_id", companyId!)
            .eq("assigned_to", id)
            .order("created_at", { ascending: false }),
          supabase
            .from("events")
            .select("id, title, event_type, starts_at, ends_at, location")
            .eq("company_id", companyId!)
            .eq("assigned_to", id)
            .order("starts_at", { ascending: false })
            .limit(50),
          supabase
            .from("deadlines")
            .select("id, title, due_date, status")
            .eq("company_id", companyId!)
            .eq("assigned_to", id)
            .order("due_date"),
          supabase
            .from("atendimentos")
            .select("id, subject, status, scheduled_at, channel, client:clients(name)")
            .eq("company_id", companyId!)
            .eq("assigned_to", id)
            .order("scheduled_at", { ascending: false, nullsFirst: false }),
        ]);
      return {
        profile: profileRes.data,
        roles: (rolesRes.data ?? []).map((r) => r.role as AppRole),
        cases: casesRes.data ?? [],
        tasks: tasksRes.data ?? [],
        events: eventsRes.data ?? [],
        deadlines: deadlinesRes.data ?? [],
        atendimentos: atendsRes.data ?? [],
      };
    },
  });

  const stats = useMemo(() => {
    if (!data)
      return {
        activeCases: 0,
        openTasks: 0,
        overdueDeadlines: 0,
        completionRate: 0,
        upcomingEvents: 0,
      };
    const now = new Date();
    const activeCases = data.cases.filter((c) => c.status === "active").length;
    const openTasks = data.tasks.filter((t) => t.status !== "done").length;
    const completed = data.tasks.filter((t) => t.status === "done").length;
    const completionRate =
      data.tasks.length > 0 ? Math.round((completed / data.tasks.length) * 100) : 0;
    const overdueDeadlines = data.deadlines.filter(
      (d) => d.status === "pending" && new Date(d.due_date) < now,
    ).length;
    const upcomingEvents = data.events.filter((e) => new Date(e.starts_at) >= now).length;
    return { activeCases, openTasks, overdueDeadlines, completionRate, upcomingEvents };
  }, [data]);

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!data?.profile) {
    return (
      <div className="max-w-6xl mx-auto">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate({ to: "/app/equipe" })}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Voltar
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="font-medium">Membro não encontrado</p>
            <p className="text-sm text-muted-foreground mt-1">
              Este usuário não pertence ao escritório.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const initials = (data.profile.full_name ?? "?")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="max-w-6xl mx-auto">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate({ to: "/app/equipe" })}
        className="mb-4"
      >
        <ArrowLeft className="h-4 w-4 mr-1.5" /> Voltar à equipe
      </Button>

      <PageHeader
        title={data.profile.full_name ?? "Membro"}
        subtitle="Visão 360° do membro: produtividade, processos, agenda e atendimentos."
      />

      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4 flex-wrap">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-semibold">{data.profile.full_name ?? "Membro"}</h2>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {data.roles.length === 0 && (
                  <span className="text-xs text-muted-foreground">Sem cargo atribuído</span>
                )}
                {data.roles.map((r) => {
                  const Icon = ROLE_ICON[r];
                  return (
                    <Badge key={r} variant="outline" className={cn("gap-1", ROLE_STYLE[r])}>
                      <Icon className="h-3 w-3" />
                      {ROLE_LABEL[r]}
                    </Badge>
                  );
                })}
              </div>
              {(data.profile.oab_number || data.profile.oab_state) && (
                <p className="text-xs text-muted-foreground mt-2">
                  OAB: {data.profile.oab_number ?? "—"}{" "}
                  {data.profile.oab_state && `/ ${data.profile.oab_state}`}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 grid-cols-2 md:grid-cols-5 mb-6">
        {[
          {
            icon: Briefcase,
            label: "Processos ativos",
            value: stats.activeCases,
            tone: "text-primary bg-primary-soft",
          },
          {
            icon: CheckSquare,
            label: "Tarefas abertas",
            value: stats.openTasks,
            tone: "text-indigo-700 bg-indigo-50",
          },
          {
            icon: AlertTriangle,
            label: "Prazos vencidos",
            value: stats.overdueDeadlines,
            tone: "text-rose-700 bg-rose-50",
          },
          {
            icon: Calendar,
            label: "Próximos eventos",
            value: stats.upcomingEvents,
            tone: "text-emerald-700 bg-emerald-50",
          },
          {
            icon: Clock,
            label: "Conclusão",
            value: `${stats.completionRate}%`,
            tone: "text-amber-700 bg-amber-50",
          },
        ].map((s, i) => {
          const Icon = s.icon;
          return (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div
                    className={cn("h-9 w-9 rounded-lg flex items-center justify-center", s.tone)}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className="text-lg font-semibold tabular-nums">{s.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Tabs defaultValue="tasks">
        <TabsList>
          <TabsTrigger value="tasks">Tarefas · {data.tasks.length}</TabsTrigger>
          <TabsTrigger value="cases">Processos · {data.cases.length}</TabsTrigger>
          <TabsTrigger value="deadlines">Prazos · {data.deadlines.length}</TabsTrigger>
          <TabsTrigger value="events">Agenda · {data.events.length}</TabsTrigger>
          <TabsTrigger value="atendimentos">Atendimentos · {data.atendimentos.length}</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              {data.tasks.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhuma tarefa atribuída.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tarefa</TableHead>
                      <TableHead>Prioridade</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Vencimento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.tasks.map((t) => {
                      const overdue =
                        t.due_date && t.status !== "done" && new Date(t.due_date) < new Date();
                      return (
                        <TableRow key={t.id}>
                          <TableCell className="font-medium">{t.title}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{t.priority}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={t.status === "done" ? "default" : "secondary"}>
                              {t.status}
                            </Badge>
                          </TableCell>
                          <TableCell
                            className={cn("text-sm", overdue && "text-rose-600 font-medium")}
                          >
                            {fmtDt(t.due_date)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cases" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              {data.cases.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhum processo atribuído.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Processo</TableHead>
                      <TableHead>CNJ</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.cases.map(
                      (c: {
                        id: string;
                        title: string;
                        status: string;
                        cnj_number: string | null;
                        client: { name: string } | null;
                      }) => (
                        <TableRow
                          key={c.id}
                          className="cursor-pointer"
                          onClick={() =>
                            navigate({ to: "/app/processos/$id", params: { id: c.id } })
                          }
                        >
                          <TableCell className="font-medium">{c.title}</TableCell>
                          <TableCell className="text-xs tabular-nums">
                            {c.cnj_number ?? "—"}
                          </TableCell>
                          <TableCell className="text-sm">{c.client?.name ?? "—"}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{c.status}</Badge>
                          </TableCell>
                        </TableRow>
                      ),
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deadlines" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              {data.deadlines.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhum prazo atribuído.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Prazo</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.deadlines.map((d) => {
                      const overdue = d.status === "pending" && new Date(d.due_date) < new Date();
                      return (
                        <TableRow key={d.id}>
                          <TableCell className="font-medium">{d.title}</TableCell>
                          <TableCell
                            className={cn("text-sm", overdue && "text-rose-600 font-medium")}
                          >
                            {fmt(d.due_date)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={overdue ? "destructive" : "secondary"}>
                              {overdue ? "Vencido" : d.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              {data.events.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhum evento na agenda.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Evento</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Quando</TableHead>
                      <TableHead>Local</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.events.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="font-medium">{e.title}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{e.event_type}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{fmtDt(e.starts_at)}</TableCell>
                        <TableCell className="text-sm">{e.location ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="atendimentos" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              {data.atendimentos.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhum atendimento.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Assunto</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Canal</TableHead>
                      <TableHead>Quando</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.atendimentos.map(
                      (a: {
                        id: string;
                        subject: string;
                        status: string;
                        scheduled_at: string | null;
                        channel: string;
                        client: { name: string } | null;
                      }) => (
                        <TableRow key={a.id}>
                          <TableCell className="font-medium">{a.subject}</TableCell>
                          <TableCell className="text-sm">{a.client?.name ?? "—"}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{a.channel}</Badge>
                          </TableCell>
                          <TableCell className="text-sm">{fmtDt(a.scheduled_at)}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{a.status}</Badge>
                          </TableCell>
                        </TableRow>
                      ),
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="mt-6 text-xs text-muted-foreground">
        <Link to="/app/equipe" className="inline-flex items-center gap-1 hover:text-foreground">
          <Mail className="h-3 w-3" /> <Phone className="h-3 w-3" /> Para alterar cargos use a
          página de equipe
        </Link>
      </div>
    </div>
  );
}
