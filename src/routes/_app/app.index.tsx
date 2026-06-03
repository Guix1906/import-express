/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  addDays,
  differenceInDays,
  format,
  formatDistanceToNow,
  isBefore,
  isToday,
  isTomorrow,
  startOfDay,
  startOfMonth,
  subDays,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Briefcase,
  Calendar,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock,
  FileSignature,
  FileText,
  Gavel,
  LayoutDashboard,
  ListChecks,
  LucideIcon,
  PhoneCall,
  Plus,
  Scale,
  Sparkles,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { QuickAddTaskDialog } from "@/components/app/quick-add-task";
import { NewCaseWizard } from "@/components/app/new-case-wizard";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/use-active-company";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/app/")({
  component: Workspace,
});

const fmtBRL = (value: number) =>
  Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

const isIncome = (type?: string | null) =>
  type === "honorario" || type === "receita" || type === "income";

type Tone = "slate" | "blue" | "amber" | "red" | "emerald" | "violet" | "indigo";

const toneClasses: Record<Tone, { soft: string; text: string; border: string; dot: string }> = {
  slate: {
    soft: "bg-slate-100",
    text: "text-slate-700",
    border: "border-slate-200",
    dot: "bg-slate-500",
  },
  blue: {
    soft: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    dot: "bg-blue-500",
  },
  amber: {
    soft: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    dot: "bg-amber-500",
  },
  red: {
    soft: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200",
    dot: "bg-red-500",
  },
  emerald: {
    soft: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
  },
  violet: {
    soft: "bg-violet-50",
    text: "text-violet-700",
    border: "border-violet-200",
    dot: "bg-violet-500",
  },
  indigo: {
    soft: "bg-indigo-50",
    text: "text-indigo-700",
    border: "border-indigo-200",
    dot: "bg-indigo-500",
  },
};

function Workspace() {
  const [taskOpen, setTaskOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const { companyId, fullName } = useActiveCompany();
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-v4", companyId, user?.id],
    enabled: !!companyId && !!user?.id,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const now = new Date();
      const todayStart = startOfDay(now);
      const todayIso = format(now, "yyyy-MM-dd");
      const in7Iso = format(addDays(now, 7), "yyyy-MM-dd");
      const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
      const sixMonthsAgo = format(startOfMonth(subMonths(now, 5)), "yyyy-MM-dd");
      const last14Iso = subDays(now, 14).toISOString();

      const [
        casesRes,
        clientsRes,
        tasksRes,
        deadlinesRes,
        eventsRes,
        financialRes,
        financialSeriesRes,
        publicationsRes,
        activityRes,
        attendancesRes,
        movementsRes,
        contractsRes,
        triagesRes,
        completedTasksRes,
        productionRes,
      ] = await Promise.all([
        supabase
          .from("cases")
          .select("id, title, status, case_value, created_at, updated_at")
          .eq("company_id", companyId!),
        supabase
          .from("clients")
          .select("id, name, created_at")
          .eq("company_id", companyId!)
          .order("created_at", { ascending: false })
          .limit(6),
        supabase
          .from("tasks")
          .select("id, title, status, priority, due_date, client_id, assigned_to, created_at")
          .eq("company_id", companyId!)
          .neq("status", "done")
          .neq("status", "cancelled")
          .order("due_date", { ascending: true, nullsFirst: false })
          .limit(24),
        supabase
          .from("deadlines")
          .select("id, title, due_date, status, case_id, is_double_term, assigned_to")
          .eq("company_id", companyId!)
          .neq("status", "completed")
          .gte("due_date", todayIso)
          .lte("due_date", in7Iso)
          .order("due_date", { ascending: true })
          .limit(20),
        supabase
          .from("events")
          .select("id, title, starts_at, event_type, location, case_id")
          .eq("company_id", companyId!)
          .gte("starts_at", todayStart.toISOString())
          .order("starts_at", { ascending: true })
          .limit(12),
        supabase
          .from("financial_entries")
          .select("id, entry_type, amount, status, due_date, paid_at, description")
          .eq("company_id", companyId!)
          .gte("due_date", monthStart)
          .limit(80),
        supabase
          .from("financial_entries")
          .select("entry_type, amount, status, paid_at, due_date")
          .eq("company_id", companyId!)
          .gte("paid_at", sixMonthsAgo)
          .limit(240),
        supabase
          .from("publications")
          .select("id, process_number, publication_date, status, content")
          .eq("company_id", companyId!)
          .eq("status", "not_handled")
          .order("publication_date", { ascending: false })
          .limit(6),
        supabase
          .from("activity_logs")
          .select("id, user_id, action, entity_type, entity_label, created_at, metadata")
          .eq("company_id", companyId!)
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("atendimentos")
          .select("id, subject, scheduled_at, status, client_id, channel")
          .eq("company_id", companyId!)
          .gte("scheduled_at", todayStart.toISOString())
          .order("scheduled_at", { ascending: true })
          .limit(8),
        supabase
          .from("process_movements")
          .select("id, title, movement_date, movement_type, case_id, created_at")
          .eq("company_id", companyId!)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("contracts")
          .select("id, title, status, value, created_at")
          .eq("company_id", companyId!)
          .not("status", "in", '("assinado","ativo","encerrado","cancelado")')
          .order("created_at", { ascending: false })
          .limit(8),
        supabase
          .from("triagens")
          .select("id, contact_name, practice_area, priority, created_at, status, assigned_to")
          .eq("company_id", companyId!)
          .in("status", ["draft", "new", "waiting_lawyer", "in_attendance", "waiting_documents"])
          .order("created_at", { ascending: true })
          .limit(12),
        supabase
          .from("tasks")
          .select("id, assigned_to, completed_at")
          .eq("company_id", companyId!)
          .eq("status", "done")
          .gte("completed_at", last14Iso)
          .limit(200),
        supabase
          .from("production_cards")
          .select(
            "id, title, priority, due_date, operational_status, column_key, completed_at, assignee_id, client_name_snapshot, updated_at",
          )
          .eq("company_id", companyId!)
          .order("updated_at", { ascending: false })
          .limit(40),
      ]);

      const userIds = Array.from(
        new Set([
          ...((activityRes.data ?? []).map((a) => a.user_id).filter(Boolean) as string[]),
          ...((completedTasksRes.data ?? []).map((t) => t.assigned_to).filter(Boolean) as string[]),
        ]),
      );

      const profiles = userIds.length
        ? ((await supabase.from("profiles").select("id, full_name, avatar_url").in("id", userIds))
            .data ?? [])
        : [];

      return {
        cases: casesRes.data ?? [],
        clients: clientsRes.data ?? [],
        tasks: tasksRes.data ?? [],
        deadlines: deadlinesRes.data ?? [],
        events: eventsRes.data ?? [],
        financial: financialRes.data ?? [],
        financialSeries: financialSeriesRes.data ?? [],
        publications: publicationsRes.data ?? [],
        activity: activityRes.data ?? [],
        atendimentos: attendancesRes.data ?? [],
        movements: movementsRes.data ?? [],
        contracts: contractsRes.data ?? [],
        triages: triagesRes.data ?? [],
        completedTasks: completedTasksRes.data ?? [],
        productionCards: productionRes.data ?? [],
        profiles,
      };
    },
  });

  const profileMap = useMemo(() => {
    const map = new Map<string, { name: string; avatar: string | null }>();
    (data?.profiles ?? []).forEach((p: any) =>
      map.set(p.id, { name: p.full_name ?? "Usuario", avatar: p.avatar_url ?? null }),
    );
    return map;
  }, [data]);

  const metrics = useMemo(() => {
    if (!data) return null;

    const now = new Date();
    const monthStart = startOfMonth(now);
    const lastMonthStart = startOfMonth(subMonths(now, 1));
    const lastMonthEnd = monthStart;
    const in3 = addDays(now, 3);

    const activeCases = data.cases.filter((c: any) =>
      ["active", "ativo"].includes(c.status),
    ).length;
    const urgentTriages = data.triages.filter((t: any) =>
      ["alta", "urgente"].includes(String(t.priority ?? "").toLowerCase()),
    ).length;
    const waitingDocuments = data.triages.filter(
      (t: any) => t.status === "waiting_documents",
    ).length;
    const waitingLawyer = data.triages.filter((t: any) =>
      ["new", "waiting_lawyer", "draft"].includes(t.status),
    ).length;
    const overdueTasks = data.tasks.filter(
      (t: any) => t.due_date && isBefore(new Date(t.due_date), now),
    ).length;
    const urgentDeadlines = data.deadlines.filter((d: any) =>
      isBefore(new Date(d.due_date), in3),
    ).length;
    const todayEvents = data.events.filter((e: any) => isToday(new Date(e.starts_at))).length;
    const todayAtendimentos = data.atendimentos.filter(
      (a: any) => a.scheduled_at && isToday(new Date(a.scheduled_at)),
    ).length;
    const pendingContracts = data.contracts.length;

    const financialMonth = data.financial as any[];
    const financialSeries = data.financialSeries as any[];
    const receivedMonth = financialSeries
      .filter(
        (f) =>
          isIncome(f.entry_type) &&
          f.status === "pago" &&
          f.paid_at &&
          new Date(f.paid_at) >= monthStart,
      )
      .reduce((sum, f) => sum + Number(f.amount || 0), 0);
    const receivedPreviousMonth = financialSeries
      .filter(
        (f) =>
          isIncome(f.entry_type) &&
          f.status === "pago" &&
          f.paid_at &&
          new Date(f.paid_at) >= lastMonthStart &&
          new Date(f.paid_at) < lastMonthEnd,
      )
      .reduce((sum, f) => sum + Number(f.amount || 0), 0);
    const receivable = financialMonth
      .filter((f) => isIncome(f.entry_type) && f.status !== "pago")
      .reduce((sum, f) => sum + Number(f.amount || 0), 0);
    const delinquent = financialMonth
      .filter(
        (f) =>
          isIncome(f.entry_type) &&
          f.status !== "pago" &&
          f.due_date &&
          isBefore(new Date(f.due_date), now),
      )
      .reduce((sum, f) => sum + Number(f.amount || 0), 0);

    const revenueDelta =
      receivedPreviousMonth === 0
        ? receivedMonth > 0
          ? 100
          : 0
        : Math.round(((receivedMonth - receivedPreviousMonth) / receivedPreviousMonth) * 100);

    const productionCards = data.productionCards as any[];
    const productionOpen = productionCards.filter(
      (c) =>
        !c.completed_at && !["concluido", "finalizado", "arquivado"].includes(c.operational_status),
    ).length;
    const productionReview = productionCards.filter(
      (c) => c.operational_status === "em_revisao",
    ).length;
    const productionOverdue = productionCards.filter(
      (c) => c.due_date && isBefore(new Date(c.due_date), now) && !c.completed_at,
    ).length;
    const productionDone = productionCards.filter((c) => !!c.completed_at).length;
    const staleCards = productionCards.filter(
      (c) => !c.completed_at && c.updated_at && differenceInDays(now, new Date(c.updated_at)) >= 7,
    ).length;

    const tasksDoneByUser = new Map<string, number>();
    data.completedTasks.forEach((task: any) => {
      if (!task.assigned_to) return;
      tasksDoneByUser.set(task.assigned_to, (tasksDoneByUser.get(task.assigned_to) ?? 0) + 1);
    });
    const productivity = Array.from(tasksDoneByUser.entries())
      .map(([uid, count]) => ({ uid, count, name: profileMap.get(uid)?.name ?? "Colaborador" }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const months: { key: string; label: string; income: number; expense: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const date = subMonths(now, i);
      months.push({
        key: format(date, "yyyy-MM"),
        label: format(date, "MMM", { locale: ptBR }),
        income: 0,
        expense: 0,
      });
    }
    financialSeries.forEach((entry) => {
      if (!entry.paid_at || entry.status !== "pago") return;
      const key = format(new Date(entry.paid_at), "yyyy-MM");
      const bucket = months.find((month) => month.key === key);
      if (!bucket) return;
      if (isIncome(entry.entry_type)) bucket.income += Number(entry.amount || 0);
      if (entry.entry_type === "despesa") bucket.expense += Number(entry.amount || 0);
    });

    return {
      activeCases,
      urgentTriages,
      waitingDocuments,
      waitingLawyer,
      overdueTasks,
      urgentDeadlines,
      todayEvents,
      todayAtendimentos,
      pendingContracts,
      receivedMonth,
      receivable,
      delinquent,
      revenueDelta,
      productionOpen,
      productionReview,
      productionOverdue,
      productionDone,
      staleCards,
      productivity,
      months,
    };
  }, [data, profileMap]);

  const attentionItems = useMemo(() => {
    if (!data) return [];
    const now = new Date();
    const items: AttentionItemProps[] = [];

    data.triages
      .filter((t: any) => t.status !== "waiting_documents")
      .slice(0, 4)
      .forEach((t: any) => {
        const priority = String(t.priority ?? "normal").toLowerCase();
        items.push({
          id: `triage-${t.id}`,
          tone: priority === "alta" || priority === "urgente" ? "red" : "amber",
          type: "Triagem",
          title: t.contact_name ?? "Cliente sem nome",
          description: t.practice_area ?? "Area nao definida",
          status: statusLabel(t.status),
          dateLabel: formatDistanceToNow(new Date(t.created_at), { locale: ptBR, addSuffix: true }),
          href: `/app/triagem/${t.id}`,
        });
      });

    data.tasks
      .filter((task: any) => task.due_date && isBefore(new Date(task.due_date), now))
      .slice(0, 4)
      .forEach((task: any) => {
        items.push({
          id: `task-${task.id}`,
          tone: "red",
          type: "Tarefa",
          title: task.title,
          description: "Tarefa atrasada",
          status: task.priority ?? "pendente",
          dateLabel: `Atrasada ha ${formatDistanceToNow(new Date(task.due_date), { locale: ptBR })}`,
          href: "/app/agenda",
        });
      });

    data.deadlines.slice(0, 4).forEach((deadline: any) => {
      const due = new Date(deadline.due_date);
      items.push({
        id: `deadline-${deadline.id}`,
        tone: isToday(due) || isTomorrow(due) ? "red" : "amber",
        type: "Prazo",
        title: deadline.title,
        description: deadline.is_double_term ? "Prazo em dobro" : "Prazo processual",
        status: isToday(due) ? "Hoje" : isTomorrow(due) ? "Amanha" : "Proximo",
        dateLabel: format(due, "dd 'de' MMM", { locale: ptBR }),
        href: "/app/agenda",
      });
    });

    data.financial
      .filter(
        (entry: any) =>
          isIncome(entry.entry_type) &&
          entry.status !== "pago" &&
          entry.due_date &&
          isBefore(new Date(entry.due_date), now),
      )
      .slice(0, 3)
      .forEach((entry: any) => {
        items.push({
          id: `finance-${entry.id}`,
          tone: "red",
          type: "Financeiro",
          title: entry.description,
          description: fmtBRL(Number(entry.amount || 0)),
          status: "Vencido",
          dateLabel: format(new Date(entry.due_date), "dd/MM"),
          href: "/app/financeiro",
        });
      });

    data.contracts.slice(0, 3).forEach((contract: any) => {
      items.push({
        id: `contract-${contract.id}`,
        tone: "blue",
        type: "Contrato",
        title: contract.title,
        description: contract.value ? fmtBRL(Number(contract.value)) : "Contrato pendente",
        status: statusLabel(contract.status),
        dateLabel: formatDistanceToNow(new Date(contract.created_at), {
          locale: ptBR,
          addSuffix: true,
        }),
        href: "/app/contratos",
      });
    });

    data.productionCards
      .filter((card: any) => {
        const stale = card.updated_at && differenceInDays(now, new Date(card.updated_at)) >= 7;
        const overdue = card.due_date && isBefore(new Date(card.due_date), now);
        return !card.completed_at && (stale || overdue || card.operational_status === "em_revisao");
      })
      .slice(0, 4)
      .forEach((card: any) => {
        items.push({
          id: `production-${card.id}`,
          tone: card.due_date && isBefore(new Date(card.due_date), now) ? "red" : "violet",
          type: "Producao",
          title: card.title,
          description: card.client_name_snapshot ?? "Card de producao",
          status: statusLabel(card.operational_status),
          dateLabel: card.due_date
            ? format(new Date(card.due_date), "dd/MM")
            : "Sem prazo definido",
          href: "/app/meu-quadro",
        });
      });

    return items
      .sort((a, b) => (a.tone === "red" ? -1 : 1) - (b.tone === "red" ? -1 : 1))
      .slice(0, 10);
  }, [data]);

  const agendaItems = useMemo(() => {
    if (!data) return [];
    return [
      ...data.events
        .filter((event: any) => isToday(new Date(event.starts_at)))
        .map((event: any) => ({
          id: `event-${event.id}`,
          time: format(new Date(event.starts_at), "HH:mm"),
          title: event.title,
          detail: event.location || statusLabel(event.event_type),
          icon: event.event_type === "hearing" ? Gavel : Calendar,
          href: "/app/agenda",
        })),
      ...data.atendimentos
        .filter(
          (attendance: any) =>
            attendance.scheduled_at && isToday(new Date(attendance.scheduled_at)),
        )
        .map((attendance: any) => ({
          id: `attendance-${attendance.id}`,
          time: format(new Date(attendance.scheduled_at), "HH:mm"),
          title: attendance.subject,
          detail: `Atendimento ${attendance.channel ?? ""}`.trim(),
          icon: PhoneCall,
          href: "/app/atendimentos",
        })),
      ...data.deadlines
        .filter((deadline: any) => isToday(new Date(deadline.due_date)))
        .map((deadline: any) => ({
          id: `deadline-today-${deadline.id}`,
          time: "Hoje",
          title: deadline.title,
          detail: "Prazo processual",
          icon: Gavel,
          href: "/app/agenda",
        })),
    ].slice(0, 8);
  }, [data]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  }, []);

  const firstName = (fullName ?? user?.email?.split("@")[0] ?? "advogado").split(" ")[0];
  const alertCount =
    (metrics?.urgentTriages ?? 0) +
    (metrics?.overdueTasks ?? 0) +
    (metrics?.urgentDeadlines ?? 0) +
    (metrics?.delinquent ? 1 : 0) +
    (metrics?.productionOverdue ?? 0);

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 pb-10">
      <motion.section
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden rounded-2xl border bg-white shadow-sm"
      >
        <div className="flex flex-col gap-6 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
              {greeting}, {firstName}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              Voce possui{" "}
              <strong className="text-slate-950">
                {metrics?.urgentTriages ?? 0} triagens urgentes
              </strong>
              ,{" "}
              <strong className="text-slate-950">
                {metrics?.urgentDeadlines ?? 0} prazos vencendo
              </strong>{" "}
              e <strong className="text-emerald-700">{fmtBRL(metrics?.receivedMonth ?? 0)}</strong>{" "}
              recebidos no mes.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <QuickAction href="/app/triagem" icon={PhoneCall} label="Nova triagem" primary />
            <QuickAction href="/app/clientes" icon={UserPlus} label="Novo cliente" />
            <QuickAction
              onClick={() => setWizardOpen(true)}
              icon={Briefcase}
              label="Novo processo"
            />
            <QuickAction onClick={() => setTaskOpen(true)} icon={Plus} label="Nova tarefa" />
          </div>
        </div>
      </motion.section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <ExecutiveMetric
          label="Atencao agora"
          value={alertCount}
          hint="itens operacionais"
          icon={AlertTriangle}
          tone={alertCount > 0 ? "red" : "emerald"}
          loading={isLoading}
        />
        <ExecutiveMetric
          label="Pipeline juridico"
          value={metrics?.activeCases ?? 0}
          hint="processos ativos"
          icon={Scale}
          tone="indigo"
          href="/app/processos"
          loading={isLoading}
        />
        <ExecutiveMetric
          label="Financeiro"
          value={fmtBRL(metrics?.receivable ?? 0)}
          hint="a receber"
          icon={Wallet}
          tone="emerald"
          href="/app/financeiro"
          loading={isLoading}
        />
        <ExecutiveMetric
          label="Producao"
          value={metrics?.productionOpen ?? 0}
          hint="cards em aberto"
          icon={ListChecks}
          tone="violet"
          href="/app/meu-quadro"
          loading={isLoading}
        />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <DashboardPanel
          title="Precisa de atencao"
          subtitle="Triagens, prazos, tarefas, financeiro e producao em uma lista unica."
          icon={LayoutDashboard}
          action={{ label: "Ver agenda", to: "/app/agenda" }}
        >
          {isLoading ? (
            <SkeletonRows rows={6} />
          ) : attentionItems.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="Tudo em ordem por enquanto." />
          ) : (
            <div className="space-y-2">
              {attentionItems.map((item) => (
                <AttentionItem key={item.id} {...item} />
              ))}
            </div>
          )}
        </DashboardPanel>

        <DashboardPanel
          title="Agenda do dia"
          subtitle={`${metrics?.todayEvents ?? 0} eventos e ${metrics?.todayAtendimentos ?? 0} atendimentos`}
          icon={Calendar}
          action={{ label: "Abrir", to: "/app/agenda" }}
        >
          {isLoading ? (
            <SkeletonRows rows={4} compact />
          ) : agendaItems.length === 0 ? (
            <EmptyState icon={Calendar} title="Sem compromissos para hoje." compact />
          ) : (
            <div className="space-y-2">
              {agendaItems.map((item) => (
                <AgendaItem key={item.id} {...item} />
              ))}
            </div>
          )}
        </DashboardPanel>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <DashboardPanel
          title="Pipeline juridico"
          subtitle="Do primeiro contato ate a producao juridica."
          icon={Scale}
        >
          <div className="space-y-3">
            <PipelineStep
              label="Triagens"
              value={metrics?.waitingLawyer ?? 0}
              href="/app/triagem"
              tone="amber"
            />
            <PipelineStep
              label="Aguardando documentos"
              value={metrics?.waitingDocuments ?? 0}
              href="/app/triagem"
              tone="blue"
            />
            <PipelineStep
              label="Contratos"
              value={metrics?.pendingContracts ?? 0}
              href="/app/contratos"
              tone="indigo"
            />
            <PipelineStep
              label="Processos"
              value={metrics?.activeCases ?? 0}
              href="/app/processos"
              tone="emerald"
            />
            <PipelineStep
              label="Producao"
              value={metrics?.productionOpen ?? 0}
              href="/app/meu-quadro"
              tone="violet"
              last
            />
          </div>
        </DashboardPanel>

        <DashboardPanel
          title="Financeiro resumido"
          subtitle="Recebido, a receber e inadimplencia do mes."
          icon={CircleDollarSign}
          action={{ label: "Abrir financeiro", to: "/app/financeiro" }}
        >
          <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <MoneyBox label="Recebido" value={metrics?.receivedMonth ?? 0} tone="emerald" />
            <MoneyBox label="A receber" value={metrics?.receivable ?? 0} tone="amber" />
            <MoneyBox label="Inadimplencia" value={metrics?.delinquent ?? 0} tone="red" />
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={metrics?.months ?? []}
                margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="incomeGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#059669" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#059669" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="currentColor"
                  strokeOpacity={0.08}
                  vertical={false}
                />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value: number) =>
                    value >= 1000 ? `${Math.round(value / 1000)}k` : String(value)
                  }
                />
                <Tooltip formatter={(value: number) => fmtBRL(Number(value))} />
                <Area
                  type="monotone"
                  dataKey="income"
                  name="Receita"
                  stroke="#059669"
                  strokeWidth={2}
                  fill="url(#incomeGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </DashboardPanel>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1fr]">
        <DashboardPanel
          title="Producao da equipe"
          subtitle="Cards atrasados, em revisao e concluidos."
          icon={BarChart3}
          action={{ label: "Abrir quadro", to: "/app/meu-quadro" }}
        >
          <div className="grid grid-cols-3 gap-3">
            <ProductionBox label="Atrasados" value={metrics?.productionOverdue ?? 0} tone="red" />
            <ProductionBox
              label="Em revisao"
              value={metrics?.productionReview ?? 0}
              tone="violet"
            />
            <ProductionBox label="Concluidos" value={metrics?.productionDone ?? 0} tone="emerald" />
          </div>
          <div className="mt-5 h-28">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  { label: "Atrasados", value: metrics?.productionOverdue ?? 0 },
                  { label: "Revisao", value: metrics?.productionReview ?? 0 },
                  { label: "Concluidos", value: metrics?.productionDone ?? 0 },
                ]}
                margin={{ top: 6, right: 4, left: -24, bottom: 0 }}
              >
                <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip />
                <Bar dataKey="value" fill="#1d4ed8" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </DashboardPanel>

        <DashboardPanel
          title="Atividade recente"
          subtitle="Auditoria e movimentacoes reais do escritorio."
          icon={Activity}
          action={{ label: "Ver auditoria", to: "/app/auditoria" }}
        >
          {!data?.activity.length ? (
            <EmptyState icon={Activity} title="Sem atividade recente." compact />
          ) : (
            <div className="space-y-3">
              {data.activity.slice(0, 6).map((activity: any) => (
                <ActivityItem key={activity.id} activity={activity} profileMap={profileMap} />
              ))}
            </div>
          )}
        </DashboardPanel>
      </section>

      <QuickAddTaskDialog open={taskOpen} onOpenChange={setTaskOpen} />
      <NewCaseWizard open={wizardOpen} onOpenChange={setWizardOpen} />
    </div>
  );
}

function QuickAction({
  icon: Icon,
  label,
  href,
  onClick,
  primary,
}: {
  icon: LucideIcon;
  label: string;
  href?: string;
  onClick?: () => void;
  primary?: boolean;
}) {
  const button = (
    <Button
      type="button"
      variant={primary ? "default" : "outline"}
      size="sm"
      onClick={onClick}
      className={cn(
        "h-10 gap-2 rounded-lg",
        primary && "bg-slate-950 text-white hover:bg-slate-800",
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Button>
  );
  return href ? <Link to={href as any}>{button}</Link> : button;
}

function ExecutiveMetric({
  label,
  value,
  hint,
  icon: Icon,
  tone,
  href,
  loading,
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: LucideIcon;
  tone: Tone;
  href?: string;
  loading?: boolean;
}) {
  const t = toneClasses[tone];
  const content = (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md",
        t.border,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
          <p className={cn("mt-2 text-3xl font-semibold tracking-tight", t.text)}>
            {loading ? (
              <span className="block h-9 w-20 animate-pulse rounded bg-slate-100" />
            ) : (
              value
            )}
          </p>
          <p className="mt-1 text-sm text-slate-500">{hint}</p>
        </div>
        <div className={cn("grid h-11 w-11 place-items-center rounded-xl", t.soft)}>
          <Icon className={cn("h-5 w-5", t.text)} />
        </div>
      </div>
    </motion.div>
  );
  return href ? <Link to={href as any}>{content}</Link> : content;
}

function DashboardPanel({
  title,
  subtitle,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  action?: { label: string; to: string };
  children: ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border bg-white p-5 shadow-sm"
    >
      <header className="mb-5 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-700">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-950">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
          </div>
        </div>
        {action && (
          <Link to={action.to as any}>
            <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs">
              {action.label}
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        )}
      </header>
      {children}
    </motion.section>
  );
}

type AttentionItemProps = {
  id: string;
  type: string;
  title: string;
  description: string;
  status: string;
  dateLabel: string;
  href: string;
  tone: Tone;
};

function AttentionItem({
  type,
  title,
  description,
  status,
  dateLabel,
  href,
  tone,
}: AttentionItemProps) {
  const t = toneClasses[tone];
  return (
    <Link
      to={href as any}
      className="group flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3 transition hover:border-slate-200 hover:bg-white hover:shadow-sm"
    >
      <span className={cn("h-2.5 w-2.5 rounded-full", t.dot)} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={cn("h-5 rounded-full px-2 text-[10px]", t.border, t.text)}
          >
            {type}
          </Badge>
          <span className="text-xs text-slate-500">{dateLabel}</span>
        </div>
        <p className="mt-1 truncate text-sm font-semibold text-slate-950">{title}</p>
        <p className="truncate text-xs text-slate-500">{description}</p>
      </div>
      <Badge variant="secondary" className="hidden text-[10px] sm:inline-flex">
        {status}
      </Badge>
      <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs">
        Abrir
        <ChevronRight className="h-3.5 w-3.5" />
      </Button>
    </Link>
  );
}

function AgendaItem({
  time,
  title,
  detail,
  icon: Icon,
  href,
}: {
  time: string;
  title: string;
  detail: string;
  icon: LucideIcon;
  href: string;
}) {
  return (
    <Link
      to={href as any}
      className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3 transition hover:bg-white hover:shadow-sm"
    >
      <div className="w-12 text-sm font-semibold tabular-nums text-slate-950">{time}</div>
      <div className="grid h-9 w-9 place-items-center rounded-lg bg-blue-50 text-blue-700">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-950">{title}</p>
        <p className="truncate text-xs text-slate-500">{detail}</p>
      </div>
    </Link>
  );
}

function PipelineStep({
  label,
  value,
  href,
  tone,
  last,
}: {
  label: string;
  value: number;
  href: string;
  tone: Tone;
  last?: boolean;
}) {
  const t = toneClasses[tone];
  return (
    <Link to={href as any} className="block">
      <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3 transition hover:bg-white hover:shadow-sm">
        <div
          className={cn(
            "grid h-10 w-10 place-items-center rounded-xl text-lg font-semibold",
            t.soft,
            t.text,
          )}
        >
          {value}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-slate-950">{label}</p>
          {!last && <p className="text-xs text-slate-500">Proxima etapa conectada</p>}
        </div>
        <ChevronRight className="h-4 w-4 text-slate-400" />
      </div>
    </Link>
  );
}

function MoneyBox({ label, value, tone }: { label: string; value: number; tone: Tone }) {
  const t = toneClasses[tone];
  return (
    <Link
      to="/app/financeiro"
      className={cn("rounded-xl border p-3 transition hover:shadow-sm", t.border)}
    >
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={cn("mt-1 text-lg font-semibold", t.text)}>{fmtBRL(value)}</p>
    </Link>
  );
}

function ProductionBox({ label, value, tone }: { label: string; value: number; tone: Tone }) {
  const t = toneClasses[tone];
  return (
    <Link
      to={"/app/meu-quadro" as any}
      className={cn("rounded-xl border p-3 text-center transition hover:shadow-sm", t.border)}
    >
      <p className={cn("text-2xl font-semibold", t.text)}>{value}</p>
      <p className="mt-1 text-xs text-slate-500">{label}</p>
    </Link>
  );
}

function ActivityItem({
  activity,
  profileMap,
}: {
  activity: any;
  profileMap: Map<string, { name: string; avatar: string | null }>;
}) {
  const profile = profileMap.get(activity.user_id);
  return (
    <div className="flex gap-3">
      <div className="mt-1 h-2 w-2 rounded-full bg-emerald-500" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-slate-700">
          <span className="font-semibold text-slate-950">{profile?.name ?? "Usuario"}</span>{" "}
          {formatAction(activity.action, activity.entity_type)}{" "}
          {activity.entity_label && <span className="font-medium">{activity.entity_label}</span>}
        </p>
        <p className="text-xs text-slate-500">
          {formatDistanceToNow(new Date(activity.created_at), { locale: ptBR, addSuffix: true })}
        </p>
      </div>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  compact,
}: {
  icon: LucideIcon;
  title: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-dashed border-slate-200 bg-slate-50 text-center",
        compact ? "p-6" : "p-10",
      )}
    >
      <Icon className="mx-auto mb-2 h-7 w-7 text-slate-400" />
      <p className="text-sm font-medium text-slate-700">{title}</p>
    </div>
  );
}

function SkeletonRows({ rows, compact }: { rows: number; compact?: boolean }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className={cn("animate-pulse rounded-xl bg-slate-100", compact ? "h-16" : "h-20")}
        />
      ))}
    </div>
  );
}

function statusLabel(status?: string | null) {
  const labels: Record<string, string> = {
    draft: "Rascunho",
    new: "Nova",
    waiting_lawyer: "Aguardando advogado",
    in_attendance: "Em atendimento",
    attendance_finished: "Atendimento finalizado",
    waiting_documents: "Aguardando documentos",
    converted: "Convertida",
    archived: "Arquivada",
    pending: "Pendente",
    assinado: "Assinado",
    ativo: "Ativo",
    em_revisao: "Em revisao",
    concluido: "Concluido",
    finalizado: "Finalizado",
  };
  return labels[String(status ?? "").toLowerCase()] ?? String(status ?? "Pendente");
}

function formatAction(action: string, entity: string) {
  const verbs: Record<string, string> = {
    create: "criou",
    created: "criou",
    insert: "criou",
    update: "atualizou",
    updated: "atualizou",
    delete: "removeu",
    deleted: "removeu",
    complete: "concluiu",
    completed: "concluiu",
    sign: "assinou",
    signed: "assinou",
  };
  const entities: Record<string, string> = {
    client: "cliente",
    clients: "cliente",
    case: "processo",
    cases: "processo",
    task: "tarefa",
    tasks: "tarefa",
    contract: "contrato",
    contracts: "contrato",
    document: "documento",
    documents: "documento",
    atendimento: "atendimento",
    triagem: "triagem",
    triagens: "triagem",
    publication: "publicacao",
    event: "evento",
    deadline: "prazo",
  };
  return `${verbs[action?.toLowerCase()] ?? action} ${entities[entity?.toLowerCase()] ?? entity}`;
}
