import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "framer-motion";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
  FunnelChart,
  Funnel,
  LabelList,
} from "recharts";
import {
  TrendingUp,
  Briefcase,
  Scale,
  Wallet,
  Activity,
  AlertTriangle,
  Users,
  FileText,
  Calendar as CalIcon,
  Search,
  Download,
  FileSpreadsheet,
  RefreshCw,
  Clock,
  CheckCircle2,
  ArrowUpRight,
  Sparkles,
  Target,
  DollarSign,
  ClipboardList,
  Bell,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

import {
  getCommercialReport,
  getLegalReport,
  getFinancialReport,
  getOperationalReport,
  getTeamPerformance,
  getRecentActivities,
  getSmartAlerts,
} from "@/lib/reports.functions";
import { KpiCard } from "@/components/relatorios/KpiCard";
import { KpiDrillSheet, type DrillKind } from "@/components/relatorios/KpiDrillSheet";
import { exportToPDF, exportToExcel } from "@/lib/report-export";

export const Route = createFileRoute("/_app/app/relatorios")({
  component: RelatoriosPage,
});

const CHART_COLORS = [
  "#6366f1",
  "#10b981",
  "#f59e0b",
  "#f43f5e",
  "#8b5cf6",
  "#0ea5e9",
  "#ec4899",
  "#14b8a6",
];
const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtNum = (n: number) => n.toLocaleString("pt-BR");

type PresetKey = "today" | "7d" | "30d" | "custom";
type Period = { from: Date; to: Date };

function presetRange(k: PresetKey): Period {
  const to = new Date();
  const from = new Date();
  if (k === "today") from.setHours(0, 0, 0, 0);
  else if (k === "7d") from.setDate(from.getDate() - 7);
  else from.setDate(from.getDate() - 30);
  return { from, to };
}

function RelatoriosPage() {
  const [tab, setTab] = useState("comercial");
  const [preset, setPreset] = useState<PresetKey>("30d");
  const [custom, setCustom] = useState<Period | null>(null);
  const [search, setSearch] = useState("");
  const period = preset === "custom" && custom ? custom : presetRange(preset);
  const periodArg = { from: period.from.toISOString(), to: period.to.toISOString() };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Relatórios"
        subtitle="Central executiva — comercial, jurídico, financeiro e operacional"
      />

      {/* Toolbar */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-center gap-2 rounded-2xl border bg-card p-3 shadow-sm"
      >
        <div className="flex items-center gap-1 rounded-xl bg-muted/50 p-1">
          {[
            { k: "today", label: "Hoje" },
            { k: "7d", label: "7 dias" },
            { k: "30d", label: "30 dias" },
          ].map((p) => (
            <button
              key={p.k}
              onClick={() => setPreset(p.k as PresetKey)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                preset === p.k
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
          <Popover>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition-all inline-flex items-center gap-1.5",
                  preset === "custom"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <CalIcon className="h-3 w-3" />
                {preset === "custom" && custom
                  ? `${format(custom.from, "dd/MM")} – ${format(custom.to, "dd/MM")}`
                  : "Personalizado"}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={{ from: custom?.from, to: custom?.to }}
                onSelect={(r) => {
                  if (r?.from && r?.to) {
                    setCustom({ from: r.from, to: r.to });
                    setPreset("custom");
                  }
                }}
                numberOfMonths={2}
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar nos relatórios..."
            className="h-9 pl-8 text-sm"
          />
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <Badge variant="secondary" className="gap-1 font-normal">
            <Sparkles className="h-3 w-3" /> Atualização automática
          </Badge>
          <ExportMenu tab={tab} period={periodArg} />
        </div>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6 min-w-0">
          <Tabs value={tab} onValueChange={setTab} className="space-y-4">
            <TabsList className="bg-muted/50 p-1 h-auto rounded-xl">
              <TabsTrigger value="comercial" className="rounded-lg data-[state=active]:shadow-sm">
                <TrendingUp className="h-3.5 w-3.5 mr-1.5" />
                Comercial
              </TabsTrigger>
              <TabsTrigger value="juridico" className="rounded-lg data-[state=active]:shadow-sm">
                <Scale className="h-3.5 w-3.5 mr-1.5" />
                Jurídico
              </TabsTrigger>
              <TabsTrigger value="financeiro" className="rounded-lg data-[state=active]:shadow-sm">
                <Wallet className="h-3.5 w-3.5 mr-1.5" />
                Financeiro
              </TabsTrigger>
              <TabsTrigger value="operacional" className="rounded-lg data-[state=active]:shadow-sm">
                <Activity className="h-3.5 w-3.5 mr-1.5" />
                Operacional
              </TabsTrigger>
            </TabsList>

            <TabsContent value="comercial" className="space-y-6 mt-2">
              <ComercialTab period={periodArg} search={search} />
            </TabsContent>
            <TabsContent value="juridico" className="space-y-6 mt-2">
              <JuridicoTab period={periodArg} search={search} />
            </TabsContent>
            <TabsContent value="financeiro" className="space-y-6 mt-2">
              <FinanceiroTab period={periodArg} />
            </TabsContent>
            <TabsContent value="operacional" className="space-y-6 mt-2">
              <OperacionalTab period={periodArg} />
            </TabsContent>
          </Tabs>

          <TeamPerformanceCard period={periodArg} search={search} />
        </div>

        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <AlertsCard />
          <RecentActivitiesCard />
        </aside>
      </div>
    </div>
  );
}

/* ============== EXPORT MENU ============== */
function ExportMenu({ tab, period }: { tab: string; period: { from: string; to: string } }) {
  const cFn = useServerFn(getCommercialReport);
  const lFn = useServerFn(getLegalReport);
  const fFn = useServerFn(getFinancialReport);
  const oFn = useServerFn(getOperationalReport);

  async function build() {
    const t = tab;
    if (t === "comercial") {
      const d = await cFn({ data: period });
      return {
        title: "Relatório Comercial",
        sections: [
          {
            title: "Indicadores",
            rows: [
              {
                Triagens: d.totals.triagens,
                Contratos: d.totals.contratos_assinados,
                "Novos clientes": d.totals.novos_clientes,
                Faturamento: d.totals.faturamento_contratos,
                "Conversão %": d.totals.taxa_conversao,
              },
            ],
          },
          { title: "Por área", rows: d.por_area.map((a) => ({ Área: a.area, Quantidade: a.qty })) },
        ],
      };
    }
    if (t === "juridico") {
      const d = await lFn({ data: period });
      return {
        title: "Relatório Jurídico",
        sections: [
          {
            title: "Indicadores",
            rows: [
              {
                Processos: d.totals.processos,
                Prazos: d.totals.prazos,
                "Prazos vencidos": d.totals.prazos_vencidos,
                Movimentações: d.totals.movimentacoes,
                "Tarefas concluídas": d.totals.tarefas_concluidas,
              },
            ],
          },
          { title: "Por área", rows: d.por_area.map((a) => ({ Área: a.area, Quantidade: a.qty })) },
          { title: "Por fase", rows: d.por_fase.map((a) => ({ Fase: a.fase, Quantidade: a.qty })) },
        ],
      };
    }
    if (t === "financeiro") {
      const d = await fFn({ data: period });
      return {
        title: "Relatório Financeiro",
        sections: [
          {
            title: "Indicadores",
            rows: [
              {
                "A receber": d.totals.a_receber,
                "A pagar": d.totals.a_pagar,
                Recebido: d.totals.recebido,
                Inadimplência: d.totals.inadimplencia,
                Saldo: d.totals.saldo,
              },
            ],
          },
          {
            title: "Fluxo de caixa",
            rows: d.fluxo.map((f) => ({ Mês: f.mes, Entradas: f.entrada, Saídas: f.saida })),
          },
        ],
      };
    }
    const d = await oFn({ data: period });
    return {
      title: "Relatório Operacional",
      sections: [
        {
          title: "Indicadores",
          rows: [
            {
              "Tarefas concluídas": d.totals.tarefas_concluidas,
              "Tarefas atrasadas": d.totals.tarefas_atrasadas,
              "Cards ativos": d.totals.cards_ativos,
              "Tempo médio (h)": d.totals.tempo_medio_horas,
            },
          ],
        },
        {
          title: "Gargalos",
          rows: d.gargalos.map((g) => ({
            Fase: g.fase,
            Cards: g.count,
            "Tempo médio (h)": g.tempo_medio_h,
          })),
        },
      ],
    };
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="h-9 gap-1.5"
        onClick={async () => {
          const r = await build();
          exportToPDF(r.title, r.sections);
        }}
      >
        <Download className="h-3.5 w-3.5" /> PDF
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="h-9 gap-1.5"
        onClick={async () => {
          const r = await build();
          exportToExcel(r.title, r.sections);
        }}
      >
        <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
      </Button>
    </>
  );
}

/* ============== LOADING / EMPTY ============== */
function LoadingGrid({ count = 5 }: { count?: number }) {
  return (
    <div className={cn("grid gap-3", count === 4 ? "md:grid-cols-4" : "md:grid-cols-5")}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-28 rounded-2xl" />
      ))}
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
      <div className="rounded-2xl bg-muted/40 p-4 mb-3">
        <Sparkles className="h-6 w-6" />
      </div>
      <p className="text-sm">{label}</p>
      <p className="text-xs opacity-70 mt-1">
        Os dados aparecerão aqui assim que houver movimento.
      </p>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <Card
        className={cn(
          "rounded-2xl border-border/60 shadow-sm hover:shadow-md transition-shadow",
          className,
        )}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base">{title}</CardTitle>
              {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
            </div>
          </div>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </motion.div>
  );
}

/** Wraps a KpiCard with a drill-down Sheet pulling the underlying rows from the DB. */
function DrillKpi(props: {
  kind: DrillKind;
  period: { from: string; to: string };
  moduleHref: string;
  moduleLabel?: string;
  drillTitle: string;
  drillDescription?: string;
  // KpiCard props
  index: number;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  delta?: number;
  tone?: React.ComponentProps<typeof KpiCard>["tone"];
  series?: { date: string; value: number }[];
}) {
  const { kind, period, moduleHref, moduleLabel, drillTitle, drillDescription, ...kpi } = props;
  return (
    <KpiDrillSheet
      kind={kind}
      title={drillTitle}
      description={drillDescription}
      period={period}
      moduleHref={moduleHref}
      moduleLabel={moduleLabel}
      trigger={<KpiCard {...(kpi as any)} />}
    />
  );
}

/* ============== COMERCIAL ============== */
function ComercialTab({
  period,
  search,
}: {
  period: { from: string; to: string };
  search: string;
}) {
  const fn = useServerFn(getCommercialReport);
  const { data, isLoading } = useQuery({
    queryKey: ["report-comercial", period],
    queryFn: () => fn({ data: period }),
    refetchInterval: 60_000,
    placeholderData: (p: any) => p,
  });
  if (isLoading || !data) return <LoadingGrid count={5} />;

  const filteredArea = data.por_area.filter(
    (a) => !search || a.area.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <DrillKpi
          kind="triagens"
          period={period}
          moduleHref="/app/triagem"
          drillTitle="Triagens do período"
          drillDescription="Leads e pré-atendimentos captados na janela selecionada"
          index={0}
          icon={Briefcase}
          label="Triagens"
          value={fmtNum(data.totals.triagens)}
          delta={data.deltas.triagens}
          tone="indigo"
          series={data.series.triagens}
        />
        <DrillKpi
          kind="contratos"
          period={period}
          moduleHref="/app/contratos"
          drillTitle="Contratos no período"
          drillDescription="Contratos criados e/ou assinados"
          index={1}
          icon={FileText}
          label="Contratos"
          value={fmtNum(data.totals.contratos_assinados)}
          delta={data.deltas.contratos_assinados}
          tone="emerald"
          series={data.series.contratos}
        />
        <DrillKpi
          kind="novos_clientes"
          period={period}
          moduleHref="/app/clientes"
          drillTitle="Novos clientes"
          drillDescription="Clientes cadastrados no CRM"
          index={2}
          icon={Users}
          label="Novos clientes"
          value={fmtNum(data.totals.novos_clientes)}
          delta={data.deltas.novos_clientes}
          tone="sky"
          series={data.series.clientes}
        />
        <DrillKpi
          kind="faturamento"
          period={period}
          moduleHref="/app/financeiro"
          drillTitle="Faturamento de contratos"
          drillDescription="Valores de contratos ativos/assinados"
          index={3}
          icon={DollarSign}
          label="Faturamento"
          value={fmtBRL(data.totals.faturamento_contratos)}
          delta={data.deltas.faturamento_contratos}
          tone="violet"
        />
        <DrillKpi
          kind="conversao"
          period={period}
          moduleHref="/app/triagem"
          drillTitle="Funil de conversão"
          drillDescription="Contratos gerados a partir de triagens"
          index={4}
          icon={Target}
          label="Conversão"
          value={`${data.totals.taxa_conversao}%`}
          delta={data.deltas.taxa_conversao}
          tone="amber"
        />
        <DrillKpi
          kind="ticket_medio"
          period={period}
          moduleHref="/app/contratos"
          drillTitle="Ticket médio"
          drillDescription="Contratos do período (base do ticket médio)"
          index={5}
          icon={TrendingUp}
          label="Ticket médio"
          value={fmtBRL(data.totals.ticket_medio)}
          delta={data.deltas.ticket_medio}
          tone="rose"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Funil comercial" subtitle="Da triagem ao contrato">
          {data.funnel.length === 0 ? (
            <EmptyChart label="Sem dados de funil" />
          ) : (
            <div className="space-y-2 py-2">
              {data.funnel.map((s, i) => {
                const max = data.funnel[0].valor || 1;
                const pct = (s.valor / max) * 100;
                return (
                  <motion.div
                    key={s.etapa}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08 }}
                  >
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-medium">{s.etapa}</span>
                      <span className="text-muted-foreground">{fmtNum(s.valor)}</span>
                    </div>
                    <div className="h-8 rounded-lg bg-muted/50 overflow-hidden relative">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6, delay: i * 0.08, ease: "easeOut" }}
                        className="h-full rounded-lg"
                        style={{
                          background: `linear-gradient(90deg, ${CHART_COLORS[i % CHART_COLORS.length]}, ${CHART_COLORS[i % CHART_COLORS.length]}aa)`,
                        }}
                      />
                      <span className="absolute inset-y-0 left-3 flex items-center text-[11px] font-medium text-white mix-blend-difference">
                        {pct.toFixed(0)}%
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </ChartCard>

        <ChartCard title="Triagens por área" subtitle="Distribuição por prática jurídica">
          {filteredArea.length === 0 ? (
            <EmptyChart label="Nenhuma triagem no período" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={filteredArea}>
                <defs>
                  <linearGradient id="grad-area" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.5} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="area" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))" }}
                />
                <Bar dataKey="qty" fill="url(#grad-area)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  );
}

/* ============== JURÍDICO ============== */
function JuridicoTab({ period, search }: { period: { from: string; to: string }; search: string }) {
  const fn = useServerFn(getLegalReport);
  const { data, isLoading } = useQuery({
    queryKey: ["report-juridico", period],
    queryFn: () => fn({ data: period }),
    refetchInterval: 60_000,
    placeholderData: (p: any) => p,
  });
  if (isLoading || !data) return <LoadingGrid count={5} />;

  const filteredArea = data.por_area.filter(
    (a) => !search || a.area.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <DrillKpi
          kind="processos"
          period={period}
          moduleHref="/app/processos"
          drillTitle="Processos do período"
          index={0}
          icon={Scale}
          label="Processos ativos"
          value={fmtNum(data.totals.processos)}
          delta={data.deltas.processos}
          tone="indigo"
        />
        <DrillKpi
          kind="prazos"
          period={period}
          moduleHref="/app/agenda"
          drillTitle="Prazos no período"
          index={1}
          icon={Clock}
          label="Prazos"
          value={fmtNum(data.totals.prazos)}
          delta={data.deltas.prazos}
          tone="sky"
        />
        <DrillKpi
          kind="prazos_vencidos"
          period={period}
          moduleHref="/app/agenda"
          drillTitle="Prazos vencidos"
          drillDescription="Prazos não concluídos com data anterior a hoje"
          index={2}
          icon={AlertTriangle}
          label="Vencidos"
          value={fmtNum(data.totals.prazos_vencidos)}
          tone="rose"
        />
        <DrillKpi
          kind="movimentacoes"
          period={period}
          moduleHref="/app/processos"
          drillTitle="Movimentações processuais"
          index={3}
          icon={Activity}
          label="Movimentações"
          value={fmtNum(data.totals.movimentacoes)}
          tone="violet"
        />
        <DrillKpi
          kind="tarefas_concluidas"
          period={period}
          moduleHref="/app/meu-quadro"
          drillTitle="Tarefas concluídas"
          index={4}
          icon={CheckCircle2}
          label="Tarefas concluídas"
          value={fmtNum(data.totals.tarefas_concluidas)}
          delta={data.deltas.tarefas_concluidas}
          tone="emerald"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Processos por área" subtitle="Distribuição por especialidade">
          {filteredArea.length === 0 ? (
            <EmptyChart label="Nenhum processo no período" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={filteredArea}
                  dataKey="qty"
                  nameKey="area"
                  outerRadius={90}
                  innerRadius={50}
                  paddingAngle={2}
                >
                  {filteredArea.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))" }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Processos por fase" subtitle="Estado processual atual">
          {data.por_fase.length === 0 ? (
            <EmptyChart label="Sem dados de fase" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.por_fase} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                <YAxis
                  type="category"
                  dataKey="fase"
                  fontSize={11}
                  width={100}
                  stroke="hsl(var(--muted-foreground))"
                />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))" }}
                />
                <Bar dataKey="qty" fill="#10b981" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  );
}

/* ============== FINANCEIRO ============== */
function FinanceiroTab({ period }: { period: { from: string; to: string } }) {
  const fn = useServerFn(getFinancialReport);
  const { data, isLoading } = useQuery({
    queryKey: ["report-financeiro", period],
    queryFn: () => fn({ data: period }),
    refetchInterval: 60_000,
    placeholderData: (p: any) => p,
  });
  if (isLoading || !data) return <LoadingGrid count={5} />;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <DrillKpi
          kind="a_receber"
          period={period}
          moduleHref="/app/financeiro"
          drillTitle="Contas a receber"
          index={0}
          icon={Wallet}
          label="A receber"
          value={fmtBRL(data.totals.a_receber)}
          tone="amber"
        />
        <DrillKpi
          kind="a_pagar"
          period={period}
          moduleHref="/app/financeiro"
          drillTitle="Contas a pagar"
          index={1}
          icon={Wallet}
          label="A pagar"
          value={fmtBRL(data.totals.a_pagar)}
          tone="rose"
        />
        <DrillKpi
          kind="recebido"
          period={period}
          moduleHref="/app/financeiro"
          drillTitle="Recebimentos confirmados"
          index={2}
          icon={CheckCircle2}
          label="Recebido"
          value={fmtBRL(data.totals.recebido)}
          delta={data.deltas.recebido}
          tone="emerald"
        />
        <DrillKpi
          kind="inadimplencia"
          period={period}
          moduleHref="/app/financeiro"
          drillTitle="Inadimplência"
          drillDescription="A receber com vencimento passado"
          index={3}
          icon={AlertTriangle}
          label="Inadimplência"
          value={fmtBRL(data.totals.inadimplencia)}
          delta={data.deltas.inadimplencia}
          tone="rose"
        />
        <DrillKpi
          kind="recebido"
          period={period}
          moduleHref="/app/financeiro"
          drillTitle="Saldo (recebido - pago)"
          index={4}
          icon={TrendingUp}
          label="Saldo"
          value={fmtBRL(data.totals.saldo)}
          tone={data.totals.saldo >= 0 ? "emerald" : "rose"}
        />
      </div>

      <ChartCard title="Receita x Despesas" subtitle="Fluxo de caixa mensal">
        {data.fluxo.length === 0 ? (
          <EmptyChart label="Sem lançamentos no período" />
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={data.fluxo}>
              <defs>
                <linearGradient id="grad-in" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="grad-out" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#f43f5e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="mes" fontSize={11} stroke="hsl(var(--muted-foreground))" />
              <YAxis
                tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                fontSize={11}
                stroke="hsl(var(--muted-foreground))"
              />
              <Tooltip
                formatter={(v: number) => fmtBRL(v)}
                contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))" }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area
                type="monotone"
                dataKey="entrada"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#grad-in)"
                name="Entradas"
              />
              <Area
                type="monotone"
                dataKey="saida"
                stroke="#f43f5e"
                strokeWidth={2}
                fill="url(#grad-out)"
                name="Saídas"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
}

/* ============== OPERACIONAL ============== */
function OperacionalTab({ period }: { period: { from: string; to: string } }) {
  const fn = useServerFn(getOperationalReport);
  const { data, isLoading } = useQuery({
    queryKey: ["report-operacional", period],
    queryFn: () => fn({ data: period }),
    refetchInterval: 60_000,
    placeholderData: (p: any) => p,
  });
  if (isLoading || !data) return <LoadingGrid count={4} />;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <DrillKpi
          kind="tarefas_concluidas"
          period={period}
          moduleHref="/app/meu-quadro"
          drillTitle="Tarefas concluídas"
          index={0}
          icon={CheckCircle2}
          label="Concluídas"
          value={fmtNum(data.totals.tarefas_concluidas)}
          tone="emerald"
        />
        <DrillKpi
          kind="tarefas_atrasadas"
          period={period}
          moduleHref="/app/meu-quadro"
          drillTitle="Tarefas atrasadas"
          drillDescription="Tarefas com prazo vencido e não concluídas"
          index={1}
          icon={AlertTriangle}
          label="Atrasadas"
          value={fmtNum(data.totals.tarefas_atrasadas)}
          tone="rose"
        />
        <DrillKpi
          kind="cards_ativos"
          period={period}
          moduleHref="/app/producao-escritorio"
          drillTitle="Cards ativos na produção"
          index={2}
          icon={Briefcase}
          label="Cards ativos"
          value={fmtNum(data.totals.cards_ativos)}
          tone="indigo"
        />
        <DrillKpi
          kind="tarefas_concluidas"
          period={period}
          moduleHref="/app/meu-quadro"
          drillTitle="Tarefas concluídas (tempo médio)"
          index={3}
          icon={Clock}
          label="Tempo médio (h)"
          value={data.totals.tempo_medio_horas}
          tone="amber"
        />
      </div>

      <ChartCard
        title="Gargalos operacionais"
        subtitle="Fases com maior tempo médio de permanência"
      >
        {data.gargalos.length === 0 ? (
          <EmptyChart label="Sem gargalos detectados" />
        ) : (
          <div className="space-y-2">
            {data.gargalos.map((g, i) => (
              <motion.div
                key={g.fase}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center justify-between rounded-xl border bg-gradient-to-r from-amber-500/5 to-transparent p-3 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="rounded-lg bg-amber-500/10 p-2 text-amber-600">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{g.fase}</p>
                    <p className="text-xs text-muted-foreground">{g.count} cards parados</p>
                  </div>
                </div>
                <Badge variant="secondary" className="font-mono">
                  {g.tempo_medio_h}h
                </Badge>
              </motion.div>
            ))}
          </div>
        )}
      </ChartCard>
    </div>
  );
}

/* ============== TEAM PERFORMANCE ============== */
function TeamPerformanceCard({
  period,
  search,
}: {
  period: { from: string; to: string };
  search: string;
}) {
  const fn = useServerFn(getTeamPerformance);
  const { data, isLoading } = useQuery({
    queryKey: ["report-team", period],
    queryFn: () => fn({ data: period }),
    refetchInterval: 60_000,
    placeholderData: (p: any) => p,
  });

  const rows = (data ?? []).filter(
    (r) => !search || r.full_name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <ChartCard title="Performance da equipe" subtitle="Produtividade por colaborador no período">
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyChart label="Nenhum colaborador com atividade" />
      ) : (
        <div className="overflow-x-auto -mx-2 px-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b">
                <th className="py-2 pr-2 font-medium">Colaborador</th>
                <th className="py-2 px-2 font-medium text-right">Cards</th>
                <th className="py-2 px-2 font-medium text-right">Tarefas</th>
                <th className="py-2 px-2 font-medium text-right">Movs.</th>
                <th className="py-2 px-2 font-medium text-right">Contratos</th>
                <th className="py-2 pl-2 font-medium min-w-[140px]">Performance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <motion.tr
                  key={r.user_id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="border-b border-border/40 hover:bg-muted/30 transition-colors"
                >
                  <td className="py-2.5 pr-2">
                    <div className="flex items-center gap-2.5">
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={r.avatar_url ?? undefined} />
                        <AvatarFallback className="text-[10px]">
                          {r.full_name
                            .split(" ")
                            .map((p) => p[0])
                            .slice(0, 2)
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium truncate max-w-[180px]">{r.full_name}</span>
                    </div>
                  </td>
                  <td className="text-right tabular-nums">
                    {r.cards_done}/{r.cards}
                  </td>
                  <td className="text-right tabular-nums">{r.tasks_done}</td>
                  <td className="text-right tabular-nums">{r.movimentacoes}</td>
                  <td className="text-right tabular-nums">{r.contratos}</td>
                  <td className="pl-2">
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${r.performance}%` }}
                          transition={{ duration: 0.6, delay: i * 0.03, ease: "easeOut" }}
                          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                        />
                      </div>
                      <span className="text-[11px] font-medium text-muted-foreground w-8 text-right tabular-nums">
                        {r.performance}%
                      </span>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ChartCard>
  );
}

/* ============== ALERTS ============== */
function AlertsCard() {
  const fn = useServerFn(getSmartAlerts);
  const { data } = useQuery({
    queryKey: ["report-alerts"],
    queryFn: () => fn({ data: {} }),
    refetchInterval: 60_000,
  });

  const buckets = [
    {
      key: "prazos",
      label: "Prazos vencendo",
      tone: "amber" as const,
      icon: Clock,
      items: data?.prazos_vencendo ?? [],
      render: (it: any) => ({
        title: it.title,
        sub: `Vence ${format(new Date(it.due_date), "dd/MM/yyyy", { locale: ptBR })}`,
      }),
    },
    {
      key: "contratos",
      label: "Contratos pendentes",
      tone: "indigo" as const,
      icon: FileText,
      items: data?.contratos_pendentes ?? [],
      render: (it: any) => ({ title: it.title, sub: "Em rascunho há mais de 10 dias" }),
    },
    {
      key: "tarefas",
      label: "Tarefas atrasadas",
      tone: "rose" as const,
      icon: AlertTriangle,
      items: data?.tarefas_atrasadas ?? [],
      render: (it: any) => ({
        title: it.title,
        sub: it.due_date
          ? `Atrasada desde ${format(new Date(it.due_date), "dd/MM", { locale: ptBR })}`
          : "Sem prazo",
      }),
    },
  ];

  const total = buckets.reduce((s, b) => s + b.items.length, 0);

  return (
    <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <div className="rounded-lg bg-amber-500/10 p-1.5 text-amber-600">
              <Bell className="h-3.5 w-3.5" />
            </div>
            Alertas inteligentes
          </CardTitle>
          {total > 0 && (
            <Badge variant="destructive" className="rounded-full">
              {total}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {total === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-xs">
            <CheckCircle2 className="h-5 w-5 mx-auto mb-2 text-emerald-500" />
            Tudo em dia 🎉
          </div>
        ) : (
          buckets
            .filter((b) => b.items.length > 0)
            .map((b) => {
              const Icon = b.icon;
              const toneColor =
                b.tone === "amber"
                  ? "text-amber-600 bg-amber-500/10"
                  : b.tone === "indigo"
                    ? "text-indigo-600 bg-indigo-500/10"
                    : "text-rose-600 bg-rose-500/10";
              return (
                <Sheet key={b.key}>
                  <SheetTrigger asChild>
                    <button className="w-full text-left rounded-xl border bg-gradient-to-br from-background to-muted/30 p-3 hover:shadow-md transition-all group">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={cn("rounded-lg p-1.5", toneColor)}>
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <span className="text-xs font-medium truncate">{b.label}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Badge variant="secondary" className="rounded-full text-[10px] h-5 px-2">
                            {b.items.length}
                          </Badge>
                          <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    </button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-[400px] sm:w-[480px]">
                    <SheetHeader>
                      <SheetTitle className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        {b.label}
                      </SheetTitle>
                    </SheetHeader>
                    <ScrollArea className="h-[calc(100vh-80px)] mt-4 pr-2">
                      <div className="space-y-2">
                        {b.items.map((it: any) => {
                          const r = b.render(it);
                          return (
                            <div key={it.id} className="rounded-xl border p-3">
                              <p className="font-medium text-sm">{r.title}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{r.sub}</p>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </SheetContent>
                </Sheet>
              );
            })
        )}
      </CardContent>
    </Card>
  );
}

/* ============== RECENT ACTIVITIES ============== */
function RecentActivitiesCard() {
  const fn = useServerFn(getRecentActivities);
  const { data, isLoading } = useQuery({
    queryKey: ["report-activities"],
    queryFn: () => fn({ data: {} }),
    refetchInterval: 30_000,
  });

  function actionLabel(a: string) {
    const map: Record<string, string> = {
      create: "criou",
      update: "atualizou",
      delete: "excluiu",
      complete: "concluiu",
      move: "moveu",
      comment: "comentou em",
      assign: "atribuiu",
    };
    return map[a] ?? a;
  }
  function entityLabel(t: string) {
    const map: Record<string, string> = {
      task: "tarefa",
      case: "processo",
      client: "cliente",
      contract: "contrato",
      triagem: "triagem",
      deadline: "prazo",
      production_card: "card",
      publication: "publicação",
    };
    return map[t] ?? t;
  }

  return (
    <Card className="rounded-2xl border-border/60 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <div className="rounded-lg bg-indigo-500/10 p-1.5 text-indigo-600">
            <Activity className="h-3.5 w-3.5" />
          </div>
          Atividades recentes
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ScrollArea className="h-[420px] pr-3 -mr-3">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : !data || data.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">
              Nenhuma atividade registrada.
            </p>
          ) : (
            <div className="space-y-3">
              <AnimatePresence initial={false}>
                {data.map((a, i) => (
                  <motion.div
                    key={a.id}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i * 0.02, 0.3) }}
                    className="flex gap-2.5"
                  >
                    <div className="relative shrink-0">
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={a.avatar_url ?? undefined} />
                        <AvatarFallback className="text-[10px]">
                          {a.user_name
                            .split(" ")
                            .map((p: string) => p[0])
                            .slice(0, 2)
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                      {i < data.length - 1 && (
                        <span className="absolute left-1/2 -translate-x-1/2 top-7 w-px h-[calc(100%+12px)] bg-border" />
                      )}
                    </div>
                    <div className="min-w-0 pb-2">
                      <p className="text-xs leading-snug">
                        <span className="font-medium">{a.user_name}</span>{" "}
                        <span className="text-muted-foreground">
                          {actionLabel(a.action)} {entityLabel(a.entity_type)}
                        </span>
                        {a.entity_label && <span className="font-medium"> "{a.entity_label}"</span>}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {format(new Date(a.created_at), "dd MMM, HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
