import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import ExcelJS from "exceljs";
import { getProducaoEscritorio, type OperationalCard } from "@/lib/producao-escritorio.functions";
import { getCollaboratorProductivity } from "@/lib/colaborador-produtividade.functions";
import { PageHeader } from "@/components/app/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { opLabel, OPERATIONAL_STATUSES, PRIORITY_TONE } from "@/lib/kanban-tracks";
import { initials } from "@/components/producao/types";
import { useActiveCompany } from "@/hooks/use-active-company";
import { useCompanyMembers } from "@/hooks/use-company-members";
import {
  Download,
  AlertTriangle,
  CheckCircle2,
  ListChecks,
  FileText,
  Activity,
  Archive,
  Clock,
  TrendingUp,
  Layers,
  Search,
  ChevronRight,
  ExternalLink,
  X,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
  Cell,
} from "recharts";

export const Route = createFileRoute("/_app/app/producao-escritorio")({
  component: ProducaoDashboardPage,
});

const ROLE_LABEL: Record<string, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  lawyer: "Advogado(a)",
  member: "Colaborador",
};

const STATUS_COLOR: Record<string, string> = {
  aguardando_documentos: "#f59e0b",
  em_analise: "#06b6d4",
  em_producao: "#3b82f6",
  em_revisao: "#a855f7",
  protocolado: "#6366f1",
  acompanhamento: "#0ea5e9",
  pendencias: "#ef4444",
  finalizado: "#10b981",
  concluido: "#10b981",
  arquivado: "#71717a",
};

const FINALIZADOS = new Set(["finalizado", "concluido"]);
const ARQUIVADOS = new Set(["arquivado"]);
const PROTOCOLADOS = new Set(["protocolado"]);

type KpiKey = "total" | "andamento" | "concluidos" | "atrasados" | "protocolados" | "arquivados";

type DrawerState =
  | { open: false }
  | { open: true; title: string; subtitle?: string; cards: OperationalCard[] };

function isConcluido(c: OperationalCard) {
  return FINALIZADOS.has(c.operational_status) || !!c.completed_at;
}
function isAtrasado(c: OperationalCard, now: Date) {
  return (
    !!c.due_date &&
    new Date(c.due_date) < now &&
    !isConcluido(c) &&
    !ARQUIVADOS.has(c.operational_status)
  );
}

function ProducaoDashboardPage() {
  const fn = useServerFn(getProducaoEscritorio);
  const collabFn = useServerFn(getCollaboratorProductivity);
  const navigate = useNavigate();
  const { data, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ["producao-dashboard"],
    queryFn: () => fn({}),
    refetchInterval: 60_000,
  });

  const { companyId } = useActiveCompany();
  const { members: companyMembers, byId: memberNameById } = useCompanyMembers(companyId);

  const [memberFilter, setMemberFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [periodFilter, setPeriodFilter] = useState<string>("all"); // all | 7 | 30 | 90
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<string>("recent");
  const PAGE_SIZE = 10;

  const [drawer, setDrawer] = useState<DrawerState>({ open: false });
  const [openCardId, setOpenCardId] = useState<string | null>(null);

  const { data: collab, isFetching: collabLoading } = useQuery({
    queryKey: ["collab-produtividade", memberFilter],
    queryFn: () => collabFn({ data: { user_id: memberFilter } }),
    enabled: memberFilter !== "all",
  });

  const allCards: OperationalCard[] = useMemo(() => data?.cards_full ?? [], [data?.cards_full]);
  const referenceNow = useMemo(() => new Date(dataUpdatedAt || Date.now()), [dataUpdatedAt]);

  // Apply top-level filters (used by KPIs, charts, ranking, list)
  const filteredCards = useMemo(() => {
    const now = new Date();
    const cutoff =
      periodFilter === "all"
        ? null
        : new Date(now.getTime() - parseInt(periodFilter, 10) * 24 * 3600 * 1000);
    return allCards.filter((c) => {
      if (memberFilter !== "all" && c.assignee_id !== memberFilter && c.created_by !== memberFilter)
        return false;
      if (priorityFilter !== "all" && c.priority !== priorityFilter) return false;
      if (stageFilter !== "all" && c.operational_status !== stageFilter) return false;
      if (cutoff && c.created_at && new Date(c.created_at) < cutoff) return false;
      if (roleFilter !== "all") {
        const role = c.assignee_id
          ? (companyMembers.find((m) => m.user_id === c.assignee_id)?.role ?? null)
          : null;
        if (role !== roleFilter) return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const hay =
          `${c.title} ${c.client_name ?? ""} ${c.process_number ?? ""} ${c.assignee_name ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    allCards,
    memberFilter,
    priorityFilter,
    stageFilter,
    periodFilter,
    roleFilter,
    search,
    companyMembers,
  ]);

  // KPIs derived from filteredCards
  const kAndamento = filteredCards.filter(
    (c) => !isConcluido(c) && !ARQUIVADOS.has(c.operational_status),
  ).length;
  const kConcluidos = filteredCards.filter(isConcluido).length;
  const kAtrasados = filteredCards.filter((c) => isAtrasado(c, referenceNow)).length;
  const kProtocolados = filteredCards.filter((c) => PROTOCOLADOS.has(c.operational_status)).length;
  const kArquivados = filteredCards.filter((c) => ARQUIVADOS.has(c.operational_status)).length;
  const kTotal = filteredCards.length;

  const kpis: {
    key: KpiKey;
    label: string;
    value: number;
    icon: typeof Layers;
    tone: string;
    ring: string;
  }[] = [
    {
      key: "total",
      label: "Total",
      value: kTotal,
      icon: Layers,
      tone: "bg-slate-100 text-slate-700",
      ring: "hover:ring-slate-300",
    },
    {
      key: "andamento",
      label: "Em andamento",
      value: kAndamento,
      icon: Activity,
      tone: "bg-blue-100 text-blue-700",
      ring: "hover:ring-blue-300",
    },
    {
      key: "concluidos",
      label: "Concluídos",
      value: kConcluidos,
      icon: CheckCircle2,
      tone: "bg-emerald-100 text-emerald-700",
      ring: "hover:ring-emerald-300",
    },
    {
      key: "atrasados",
      label: "Atrasados",
      value: kAtrasados,
      icon: AlertTriangle,
      tone: "bg-rose-100 text-rose-700",
      ring: "hover:ring-rose-300",
    },
    {
      key: "protocolados",
      label: "Protocolados",
      value: kProtocolados,
      icon: FileText,
      tone: "bg-indigo-100 text-indigo-700",
      ring: "hover:ring-indigo-300",
    },
    {
      key: "arquivados",
      label: "Arquivados",
      value: kArquivados,
      icon: Archive,
      tone: "bg-zinc-100 text-zinc-700",
      ring: "hover:ring-zinc-300",
    },
  ];

  function openKpi(key: KpiKey) {
    let cards: OperationalCard[] = [];
    let title = "";
    switch (key) {
      case "total":
        cards = filteredCards;
        title = "Todos os processos";
        break;
      case "andamento":
        cards = filteredCards.filter(
          (c) => !isConcluido(c) && !ARQUIVADOS.has(c.operational_status),
        );
        title = "Processos em andamento";
        break;
      case "concluidos":
        cards = filteredCards.filter(isConcluido);
        title = "Processos concluídos";
        break;
      case "atrasados":
        cards = filteredCards.filter((c) => isAtrasado(c, referenceNow));
        title = "Processos atrasados";
        break;
      case "protocolados":
        cards = filteredCards.filter((c) => PROTOCOLADOS.has(c.operational_status));
        title = "Processos protocolados";
        break;
      case "arquivados":
        cards = filteredCards.filter((c) => ARQUIVADOS.has(c.operational_status));
        title = "Processos arquivados";
        break;
    }
    setDrawer({ open: true, title, subtitle: `${cards.length} processos`, cards });
  }

  function openStage(status: string) {
    const cards = filteredCards.filter((c) => c.operational_status === status);
    setDrawer({
      open: true,
      title: `Etapa: ${opLabel(status)}`,
      subtitle: `${cards.length} processos nesta etapa`,
      cards,
    });
  }

  function openMember(userId: string, name: string) {
    const cards = filteredCards.filter((c) => c.assignee_id === userId || c.created_by === userId);
    setDrawer({
      open: true,
      title: name,
      subtitle: `${cards.length} processos vinculados`,
      cards,
    });
  }

  // By-stage buckets (from filteredCards)
  const byStage = useMemo(() => {
    const m = new Map<string, number>();
    filteredCards.forEach((c) =>
      m.set(c.operational_status, (m.get(c.operational_status) ?? 0) + 1),
    );
    return Array.from(m.entries())
      .map(([status, count]) => ({
        status,
        label: opLabel(status),
        count,
        fill: STATUS_COLOR[status] ?? "#94a3b8",
      }))
      .sort((a, b) => b.count - a.count);
  }, [filteredCards]);

  // Ranking from filteredCards
  const ranking = useMemo(() => {
    const map = new Map<
      string,
      {
        member_id: string;
        member_name: string;
        member_role: string | null;
        avatar_url: string | null;
        total: number;
        finalizados: number;
        em_andamento: number;
        em_revisao: number;
        atrasados: number;
        produtividade: number;
      }
    >();
    const ensure = (id: string) => {
      if (!map.has(id)) {
        const cm = companyMembers.find((m) => m.user_id === id);
        map.set(id, {
          member_id: id,
          member_name: cm?.full_name ?? memberNameById.get(id) ?? "Membro",
          member_role: cm?.role ?? null,
          avatar_url: null,
          total: 0,
          finalizados: 0,
          em_andamento: 0,
          em_revisao: 0,
          atrasados: 0,
          produtividade: 0,
        });
      }
      return map.get(id)!;
    };
    filteredCards.forEach((c) => {
      if (!c.assignee_id) return;
      const row = ensure(c.assignee_id);
      row.total++;
      if (isConcluido(c)) row.finalizados++;
      if (!isConcluido(c) && !ARQUIVADOS.has(c.operational_status)) row.em_andamento++;
      if (c.operational_status === "em_revisao") row.em_revisao++;
      if (isAtrasado(c, referenceNow)) row.atrasados++;
    });
    // include members with zero so list shows whole team when no filter
    if (memberFilter === "all" && roleFilter === "all" && stageFilter === "all" && !search) {
      companyMembers.forEach((cm) => {
        if (!map.has(cm.user_id)) ensure(cm.user_id);
      });
    }
    const rows = Array.from(map.values()).map((r) => ({
      ...r,
      produtividade: r.total ? Math.round((r.finalizados / r.total) * 100) : 0,
    }));
    rows.sort((a, b) => b.finalizados - a.finalizados || b.total - a.total);
    return rows;
  }, [
    filteredCards,
    companyMembers,
    memberNameById,
    memberFilter,
    roleFilter,
    stageFilter,
    search,
    referenceNow,
  ]);

  // Operational list (sort + paginate)
  const sortedList = useMemo(() => {
    const arr = [...filteredCards];
    switch (sortBy) {
      case "recent":
        arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case "prazo":
        arr.sort((a, b) => {
          const da = a.due_date ? new Date(a.due_date).getTime() : Infinity;
          const db = b.due_date ? new Date(b.due_date).getTime() : Infinity;
          return da - db;
        });
        break;
      case "prioridade": {
        const rank: Record<string, number> = { urgente: 0, alta: 1, media: 2, baixa: 3 };
        arr.sort((a, b) => (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9));
        break;
      }
      case "cliente":
        arr.sort((a, b) => (a.client_name ?? "").localeCompare(b.client_name ?? ""));
        break;
    }
    return arr;
  }, [filteredCards, sortBy]);

  const totalPages = Math.max(1, Math.ceil(sortedList.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = sortedList.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const exportXlsx = async () => {
    if (!data) return;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Produção");
    ws.columns = [
      { header: "Data", key: "data", width: 12 },
      { header: "Colaborador", key: "colaborador", width: 24 },
      { header: "Cliente", key: "cliente", width: 28 },
      { header: "Processo", key: "processo", width: 22 },
      { header: "Área", key: "area", width: 16 },
      { header: "Atividade", key: "atividade", width: 36 },
      { header: "Status", key: "status", width: 18 },
      { header: "Prioridade", key: "prioridade", width: 12 },
      { header: "Prazo", key: "prazo", width: 12 },
    ];
    data.cards.forEach((c) => ws.addRow(c));
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `producao-${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Produção"
        subtitle="Painel operacional alimentado automaticamente pelos cards do Meu Quadro."
        actions={
          <Button variant="outline" onClick={exportXlsx} className="gap-2">
            <Download className="h-4 w-4" /> Exportar XLSX
          </Button>
        }
      />

      {/* KPIs clicáveis */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <button
              key={k.key}
              onClick={() => openKpi(k.key)}
              className={`group text-left cursor-pointer rounded-xl border bg-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg ring-1 ring-transparent ${k.ring}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground font-medium">{k.label}</div>
                  <div className="text-2xl font-bold mt-1 tabular-nums">{k.value}</div>
                </div>
                <div className={`h-9 w-9 rounded-lg grid place-items-center ${k.tone}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                Ver detalhes <ChevronRight className="h-3 w-3" />
              </div>
            </button>
          );
        })}
      </div>

      {/* Filtros inteligentes */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Buscar</label>
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Cliente, processo, título..."
                className="pl-8 w-64"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Colaborador</label>
            <Select
              value={memberFilter}
              onValueChange={(v) => {
                setMemberFilter(v);
                setPage(1);
                if (v === "all") setRoleFilter("all");
                else {
                  const cm = companyMembers.find((x) => x.user_id === v);
                  if (cm?.role) setRoleFilter(cm.role);
                }
              }}
            >
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {companyMembers
                  .slice()
                  .sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? ""))
                  .map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {m.full_name ?? "Membro"}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Cargo</label>
            <Select
              value={roleFilter}
              onValueChange={(v) => {
                setRoleFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {Object.entries(ROLE_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Etapa</label>
            <Select
              value={stageFilter}
              onValueChange={(v) => {
                setStageFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {OPERATIONAL_STATUSES.map((s) => (
                  <SelectItem key={s.key} value={s.key}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Prioridade</label>
            <Select
              value={priorityFilter}
              onValueChange={(v) => {
                setPriorityFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="urgente">Urgente</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="media">Média</SelectItem>
                <SelectItem value="baixa">Baixa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Período</label>
            <Select
              value={periodFilter}
              onValueChange={(v) => {
                setPeriodFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todo período</SelectItem>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="ghost"
            onClick={() => {
              setMemberFilter("all");
              setRoleFilter("all");
              setPriorityFilter("all");
              setStageFilter("all");
              setPeriodFilter("all");
              setSearch("");
              setPage(1);
            }}
            className="text-muted-foreground"
          >
            Limpar filtros
          </Button>
        </div>
      </Card>

      {/* Painel individual do colaborador */}
      {memberFilter !== "all" && (
        <Card className="p-5 border-primary/30">
          {collabLoading && !collab ? (
            <Skeleton className="h-40" />
          ) : collab && collab.member ? (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  {collab.member.avatar_url && <AvatarImage src={collab.member.avatar_url} />}
                  <AvatarFallback>{initials(collab.member.full_name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="font-semibold text-lg">
                    {collab.member.full_name ?? "Colaborador"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {ROLE_LABEL[collab.member.role ?? ""] ?? "Colaborador"} · Painel individual de
                    produtividade
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    navigate({
                      to: "/app/equipe/$id/quadro",
                      params: { id: collab.member!.user_id },
                    })
                  }
                  className="gap-1"
                >
                  Ver quadro <ExternalLink className="h-3 w-3" />
                </Button>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Percentual de conclusão</span>
                  <span className="font-medium tabular-nums">{collab.kpis.produtividade}%</span>
                </div>
                <Progress value={collab.kpis.produtividade} className="h-2" />
              </div>

              <Card className="p-4">
                <h4 className="font-semibold text-sm mb-3">Produtividade nos últimos 6 meses</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={collab.monthly}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="month" stroke="#9ca3af" fontSize={11} />
                    <YAxis stroke="#9ca3af" fontSize={11} allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="criados"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      name="Criados"
                    />
                    <Line
                      type="monotone"
                      dataKey="finalizados"
                      stroke="#10b981"
                      strokeWidth={2}
                      name="Finalizados"
                    />
                    <Line
                      type="monotone"
                      dataKey="movimentacoes"
                      stroke="#a855f7"
                      strokeWidth={2}
                      name="Movimentações"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Sem dados para esse colaborador.
            </p>
          )}
        </Card>
      )}

      {/* Evolução mensal + Por etapa */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">Evolução mensal</h3>
              <p className="text-xs text-muted-foreground">
                Criados vs. finalizados nos últimos 6 meses
              </p>
            </div>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data?.monthly ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" stroke="#9ca3af" fontSize={11} />
              <YAxis stroke="#9ca3af" fontSize={11} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="criados"
                stroke="#3b82f6"
                strokeWidth={2}
                name="Criados"
              />
              <Line
                type="monotone"
                dataKey="finalizados"
                stroke="#10b981"
                strokeWidth={2}
                name="Finalizados"
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">Por etapa</h3>
              <p className="text-xs text-muted-foreground">
                Clique numa barra para ver os processos
              </p>
            </div>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </div>
          {byStage.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-10">
              Sem dados nesta seleção.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(220, byStage.length * 34)}>
              <BarChart data={byStage} layout="vertical" margin={{ left: 80, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" stroke="#9ca3af" fontSize={11} allowDecimals={false} />
                <YAxis type="category" dataKey="label" stroke="#9ca3af" fontSize={11} width={120} />
                <Tooltip />
                <Bar
                  dataKey="count"
                  radius={[0, 6, 6, 0]}
                  cursor="pointer"
                  onClick={(d: { status?: string }) => d?.status && openStage(d.status)}
                >
                  {byStage.map((b, i) => (
                    <Cell key={i} fill={b.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Ranking + Gargalos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">Ranking da equipe</h3>
              <p className="text-xs text-muted-foreground">
                Clique num colaborador para investigar os processos.
              </p>
            </div>
            <Badge variant="secondary">{ranking.length}</Badge>
          </div>
          {ranking.length === 0 ? (
            <div className="text-sm text-muted-foreground py-10 text-center">
              <ListChecks className="h-10 w-10 mx-auto mb-2 opacity-40" />
              Nenhum colaborador encontrado.
            </div>
          ) : (
            <div className="divide-y rounded-lg border">
              {ranking.slice(0, 12).map((m, i) => (
                <button
                  key={m.member_id}
                  onClick={() => openMember(m.member_id, m.member_name)}
                  className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  <div className="w-6 text-xs font-bold text-muted-foreground tabular-nums">
                    {i + 1}
                  </div>
                  <Avatar className="h-8 w-8">
                    {m.avatar_url && <AvatarImage src={m.avatar_url} />}
                    <AvatarFallback className="text-xs">{initials(m.member_name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate text-sm">{m.member_name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {ROLE_LABEL[m.member_role ?? ""] ?? "Colaborador"}
                    </div>
                  </div>
                  <div className="hidden md:flex items-center gap-2 text-[11px]">
                    <Badge className="bg-emerald-600 hover:bg-emerald-600">
                      {m.finalizados} concl.
                    </Badge>
                    <Badge className="bg-blue-600 hover:bg-blue-600">{m.em_andamento} and.</Badge>
                    {m.atrasados > 0 && (
                      <Badge className="bg-rose-600 hover:bg-rose-600">{m.atrasados} atras.</Badge>
                    )}
                  </div>
                  <div className="w-28">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-0.5">
                      <span>Produt.</span>
                      <span className="tabular-nums font-medium">{m.produtividade}%</span>
                    </div>
                    <Progress value={m.produtividade} className="h-1.5" />
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">Gargalos</h3>
              <p className="text-xs text-muted-foreground">Tempo médio parado por etapa</p>
            </div>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="space-y-3">
            {(data?.bottlenecks ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Sem gargalos identificados.
              </p>
            )}
            {(data?.bottlenecks ?? []).map((b) => (
              <button
                key={b.status}
                onClick={() => openStage(b.status)}
                className="w-full space-y-1 text-left rounded-md p-2 -mx-2 hover:bg-muted/50 transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{opLabel(b.status)}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {b.avg_hours}h · {b.count}
                  </span>
                </div>
                <Progress value={Math.min(100, b.avg_hours)} className="h-1.5" />
              </button>
            ))}
          </div>
        </Card>
      </div>

      {/* Produtividade por colaborador (cards) */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold">Produtividade por colaborador</h3>
            <p className="text-xs text-muted-foreground">
              Clique para abrir os processos do colaborador.
            </p>
          </div>
          <Badge variant="secondary">{ranking.filter((r) => r.total > 0).length}</Badge>
        </div>
        {ranking.filter((r) => r.total > 0).length === 0 ? (
          <div className="text-sm text-muted-foreground py-10 text-center">
            Nenhum dado para os filtros selecionados.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {ranking
              .filter((r) => r.total > 0)
              .map((m) => (
                <button
                  key={m.member_id}
                  onClick={() => openMember(m.member_id, m.member_name)}
                  className="text-left p-4 rounded-xl border bg-card hover:shadow-md hover:border-primary/40 hover:-translate-y-0.5 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <Avatar className="h-10 w-10">
                      {m.avatar_url && <AvatarImage src={m.avatar_url} />}
                      <AvatarFallback>{initials(m.member_name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{m.member_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {ROLE_LABEL[m.member_role ?? ""] ?? "Colaborador"}
                      </div>
                    </div>
                    <Badge variant="outline" className="tabular-nums">
                      {m.total}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="rounded-lg bg-blue-50 p-2">
                      <div className="text-[10px] uppercase tracking-wide text-blue-700/80">
                        Andam.
                      </div>
                      <div className="text-base font-bold text-blue-700 tabular-nums">
                        {m.em_andamento}
                      </div>
                    </div>
                    <div className="rounded-lg bg-violet-50 p-2">
                      <div className="text-[10px] uppercase tracking-wide text-violet-700/80">
                        Revisão
                      </div>
                      <div className="text-base font-bold text-violet-700 tabular-nums">
                        {m.em_revisao}
                      </div>
                    </div>
                    <div className="rounded-lg bg-emerald-50 p-2">
                      <div className="text-[10px] uppercase tracking-wide text-emerald-700/80">
                        Concl.
                      </div>
                      <div className="text-base font-bold text-emerald-700 tabular-nums">
                        {m.finalizados}
                      </div>
                    </div>
                    <div className="rounded-lg bg-rose-50 p-2">
                      <div className="text-[10px] uppercase tracking-wide text-rose-700/80">
                        Atras.
                      </div>
                      <div className="text-base font-bold text-rose-700 tabular-nums">
                        {m.atrasados}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Produtividade</span>
                      <span className="font-medium tabular-nums">{m.produtividade}%</span>
                    </div>
                    <Progress value={m.produtividade} className="h-1.5" />
                  </div>
                </button>
              ))}
          </div>
        )}
      </Card>

      {/* Lista operacional */}
      <Card className="p-5">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
          <div>
            <h3 className="font-semibold">Lista operacional</h3>
            <p className="text-xs text-muted-foreground">
              Todos os processos filtrados ({sortedList.length})
            </p>
          </div>
          <div className="flex items-end gap-2">
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Ordenar por
              </label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Mais recentes</SelectItem>
                  <SelectItem value="prazo">Prazo (mais próximo)</SelectItem>
                  <SelectItem value="prioridade">Prioridade</SelectItem>
                  <SelectItem value="cliente">Cliente (A-Z)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {pageItems.length === 0 ? (
          <div className="text-sm text-muted-foreground py-10 text-center">
            Nenhum processo encontrado.
          </div>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2">Cliente / Processo</th>
                    <th className="text-left px-3 py-2">Atividade</th>
                    <th className="text-left px-3 py-2">Responsável</th>
                    <th className="text-left px-3 py-2">Etapa</th>
                    <th className="text-left px-3 py-2">Prioridade</th>
                    <th className="text-left px-3 py-2">Prazo</th>
                    <th className="text-left px-3 py-2 w-24"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {pageItems.map((c) => {
                    const overdue = isAtrasado(c, referenceNow);
                    const done = isConcluido(c);
                    return (
                      <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-3 py-2">
                          <div className="font-medium truncate max-w-[220px]">
                            {c.client_name ?? "—"}
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate max-w-[220px]">
                            {c.process_number ?? "Sem nº"} · {c.practice_area ?? "—"}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="truncate max-w-[240px]">{c.title}</div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="text-[10px]">
                                {initials(c.assignee_name ?? "?")}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs truncate max-w-[120px]">
                              {c.assignee_name ?? "Não atribuído"}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <Badge
                            variant="outline"
                            className="text-[10px] cursor-pointer"
                            onClick={() => openStage(c.operational_status)}
                            style={{ borderColor: STATUS_COLOR[c.operational_status] ?? "#cbd5e1" }}
                          >
                            {opLabel(c.operational_status)}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">
                          <Badge
                            className={`text-[10px] ${PRIORITY_TONE[c.priority] ?? "bg-slate-100 text-slate-700"}`}
                          >
                            {c.priority}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">
                          {c.due_date ? (
                            <span
                              className={`text-xs tabular-nums ${
                                overdue
                                  ? "text-rose-700 font-medium"
                                  : done
                                    ? "text-emerald-700"
                                    : ""
                              }`}
                            >
                              {new Date(c.due_date).toLocaleDateString("pt-BR")}
                              {overdue && <AlertTriangle className="inline h-3 w-3 ml-1 -mt-0.5" />}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs gap-1"
                            onClick={() => setOpenCardId(c.id)}
                          >
                            Abrir <ChevronRight className="h-3 w-3" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between p-3 border-t bg-muted/20">
              <div className="text-xs text-muted-foreground tabular-nums">
                Página {safePage} de {totalPages} · {sortedList.length} processos
              </div>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Próxima
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Drawer drill-down */}
      <Sheet open={drawer.open} onOpenChange={(o) => !o && setDrawer({ open: false })}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {drawer.open && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">{drawer.title}</SheetTitle>
                {drawer.subtitle && <SheetDescription>{drawer.subtitle}</SheetDescription>}
              </SheetHeader>
              <div className="mt-6 space-y-2">
                {drawer.cards.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhum processo encontrado.
                  </p>
                ) : (
                  drawer.cards.map((c) => {
                    const overdue = isAtrasado(c, referenceNow);
                    const done = isConcluido(c);
                    return (
                      <div
                        key={c.id}
                        className="rounded-lg border p-3 hover:border-primary/40 hover:shadow-sm transition-all"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium">{c.title}</span>
                              <Badge
                                variant="outline"
                                className="text-[10px]"
                                style={{
                                  borderColor: STATUS_COLOR[c.operational_status] ?? "#cbd5e1",
                                }}
                              >
                                {opLabel(c.operational_status)}
                              </Badge>
                              <Badge className={`text-[10px] ${PRIORITY_TONE[c.priority] ?? ""}`}>
                                {c.priority}
                              </Badge>
                              {overdue && (
                                <Badge className="text-[10px] bg-rose-600 hover:bg-rose-600">
                                  <AlertTriangle className="h-3 w-3 mr-1" /> Atrasado
                                </Badge>
                              )}
                              {done && (
                                <Badge className="text-[10px] bg-emerald-600 hover:bg-emerald-600">
                                  <CheckCircle2 className="h-3 w-3 mr-1" /> Concluído
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {c.client_name ?? "—"}
                              {c.process_number ? ` · ${c.process_number}` : ""}
                              {c.practice_area ? ` · ${c.practice_area}` : ""}
                            </div>
                            <div className="flex items-center gap-4 mt-2 text-[11px] text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Avatar className="h-4 w-4">
                                  <AvatarFallback className="text-[8px]">
                                    {initials(c.assignee_name ?? "?")}
                                  </AvatarFallback>
                                </Avatar>
                                {c.assignee_name ?? "Não atribuído"}
                              </span>
                              {c.due_date && (
                                <span className={overdue ? "text-rose-600 font-medium" : ""}>
                                  Prazo: {new Date(c.due_date).toLocaleDateString("pt-BR")}
                                </span>
                              )}
                              {c.completed_at && (
                                <span className="text-emerald-700">
                                  Concluído: {new Date(c.completed_at).toLocaleDateString("pt-BR")}
                                </span>
                              )}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 shrink-0"
                            onClick={() => {
                              setOpenCardId(c.id);
                              setDrawer({ open: false });
                            }}
                          >
                            Abrir <ChevronRight className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Detalhe do card */}
      <CardQuickDetail
        cardId={openCardId}
        onClose={() => setOpenCardId(null)}
        memberNameById={memberNameById}
        navigate={navigate}
      />
    </div>
  );
}

function CardQuickDetail({
  cardId,
  onClose,
  memberNameById,
  navigate,
}: {
  cardId: string | null;
  onClose: () => void;
  memberNameById: Map<string, string>;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const { data: card, isLoading } = useQuery({
    queryKey: ["card-quick", cardId],
    enabled: !!cardId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_cards")
        .select("*")
        .eq("id", cardId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: comments = [] } = useQuery({
    queryKey: ["card-quick-comments", cardId],
    enabled: !!cardId,
    queryFn: async () => {
      const { data } = await supabase
        .from("production_card_comments")
        .select("id, content, author_id, created_at")
        .eq("card_id", cardId!)
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  const { data: events = [] } = useQuery({
    queryKey: ["card-quick-events", cardId],
    enabled: !!cardId,
    queryFn: async () => {
      const { data } = await supabase
        .from("production_card_events")
        .select("id, event_type, actor_id, created_at")
        .eq("card_id", cardId!)
        .order("created_at", { ascending: false })
        .limit(30);
      return data ?? [];
    },
  });

  return (
    <Dialog open={!!cardId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {card?.title ?? (isLoading ? "Carregando..." : "Processo")}
          </DialogTitle>
        </DialogHeader>
        {isLoading || !card ? (
          <Skeleton className="h-64" />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-[10px] uppercase text-muted-foreground">Cliente</div>
                <div className="font-medium">{card.client_name_snapshot ?? "—"}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-muted-foreground">Processo</div>
                <div className="font-medium">{card.process_number ?? "—"}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-muted-foreground">Área</div>
                <div>{card.practice_area ?? "—"}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-muted-foreground">Etapa</div>
                <Badge variant="outline" className="text-[10px]">
                  {opLabel(card.operational_status)}
                </Badge>
              </div>
              <div>
                <div className="text-[10px] uppercase text-muted-foreground">Prioridade</div>
                <Badge className={`text-[10px] ${PRIORITY_TONE[card.priority] ?? ""}`}>
                  {card.priority}
                </Badge>
              </div>
              <div>
                <div className="text-[10px] uppercase text-muted-foreground">Responsável</div>
                <div>{memberNameById.get(card.assignee_id) ?? "—"}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-muted-foreground">Prazo</div>
                <div>
                  {card.due_date ? new Date(card.due_date).toLocaleDateString("pt-BR") : "—"}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-muted-foreground">Conclusão</div>
                <div>
                  {card.completed_at
                    ? new Date(card.completed_at).toLocaleDateString("pt-BR")
                    : "—"}
                </div>
              </div>
            </div>

            {card.description && (
              <div>
                <div className="text-[10px] uppercase text-muted-foreground mb-1">Descrição</div>
                <p className="text-sm whitespace-pre-wrap">{card.description}</p>
              </div>
            )}

            <div>
              <div className="text-xs font-semibold mb-2">Comentários recentes</div>
              {comments.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum comentário.</p>
              ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {comments.map((c) => (
                    <div key={c.id} className="text-xs border-l-2 border-primary/40 pl-2">
                      <div className="text-muted-foreground">
                        {memberNameById.get(c.author_id) ?? "—"} ·{" "}
                        {new Date(c.created_at).toLocaleString("pt-BR")}
                      </div>
                      <div>{c.content}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="text-xs font-semibold mb-2">Timeline</div>
              {events.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sem movimentações.</p>
              ) : (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {events.map((e) => (
                    <div key={e.id} className="text-xs text-muted-foreground">
                      • {e.event_type} — {memberNameById.get(e.actor_id) ?? "—"} ·{" "}
                      {new Date(e.created_at).toLocaleString("pt-BR")}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" onClick={onClose} className="gap-1">
                <X className="h-3 w-3" /> Fechar
              </Button>
              <Button
                onClick={() => {
                  onClose();
                  navigate({
                    to: "/app/meu-quadro",
                    search: { card_id: card.id },
                  });
                }}
                className="gap-1"
              >
                Abrir no quadro <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
