import { confirmDialog } from "@/components/app/confirm-dialog";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  RefreshCw,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Tag,
  Search,
  CheckSquare,
  Users,
  AlertCircle,
  Gavel,
  Sparkles,
  MapPin,
  Clock,
  Trash2,
  Check,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useActiveCompany } from "@/hooks/use-active-company";
import { useCompanyMembers } from "@/hooks/use-company-members";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CreateMenu, CreateModalRouter, type CreateKind } from "@/components/agenda/agenda-modals";
import {
  type Activity,
  type ActivityKind,
  KIND_COLOR,
  PRIORITY_LABEL,
  isSameDay,
  formatDateLong,
} from "@/components/agenda/agenda-types";

export const Route = createFileRoute("/_app/app/agenda")({ component: AgendaPage });

// ---------- normalization ----------
type RawTask = {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  status: "todo" | "in_progress" | "done" | "cancelled";
  assigned_to: string | null;
  case_id: string | null;
  case?: { title: string } | null;
};
type RawEvent = {
  id: string;
  title: string;
  description: string | null;
  event_type: "hearing" | "meeting" | "deadline" | "other";
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  assigned_to: string | null;
  case_id: string | null;
  case?: { title: string } | null;
};
type RawDeadline = {
  id: string;
  title: string;
  description: string | null;
  due_date: string;
  status: string;
  assigned_to: string | null;
  case_id: string | null;
  is_double_term: boolean;
};

function toActivities(opts: {
  tasks: RawTask[];
  events: RawEvent[];
  deadlines: RawDeadline[];
}): Activity[] {
  const out: Activity[] = [];
  opts.tasks.forEach((t) => {
    if (t.status === "done" || t.status === "cancelled") return;
    out.push({
      id: `task:${t.id}`,
      source: "task",
      kind: "tarefa",
      title: t.title,
      description: t.description,
      start: t.due_date ? new Date(t.due_date) : new Date(),
      end: null,
      allDay: !t.due_date,
      assignedTo: t.assigned_to,
      caseId: t.case_id,
      caseTitle: t.case?.title ?? null,
      location: null,
      priority: t.priority,
      status: t.status,
      raw: t,
    });
  });
  opts.events.forEach((e) => {
    out.push({
      id: `event:${e.id}`,
      source: "event",
      kind: e.event_type === "hearing" ? "audiencia" : "evento",
      title: e.title,
      description: e.description,
      start: new Date(e.starts_at),
      end: e.ends_at ? new Date(e.ends_at) : null,
      allDay: false,
      assignedTo: e.assigned_to,
      caseId: e.case_id,
      caseTitle: e.case?.title ?? null,
      location: e.location,
      priority: null,
      status: null,
      raw: e,
    });
  });
  opts.deadlines.forEach((d) => {
    if (d.status === "done") return;
    // tentar extrair "limite HH:MM" da description
    const hourMatch = d.description?.match(/limite\s+(\d{1,2}):(\d{2})/i);
    const dt = new Date(d.due_date + "T00:00:00");
    if (hourMatch) dt.setHours(+hourMatch[1], +hourMatch[2], 0, 0);
    else dt.setHours(18, 0, 0, 0);
    out.push({
      id: `deadline:${d.id}`,
      source: "deadline",
      kind: "prazo",
      title: d.title,
      description: d.description,
      start: dt,
      end: null,
      allDay: !hourMatch,
      assignedTo: d.assigned_to,
      caseId: d.case_id,
      caseTitle: null,
      location: null,
      priority: null,
      status: d.status,
      raw: d,
    });
  });
  return out;
}

// ---------- view modes ----------
type ViewMode = "dia" | "semana" | "mes" | "ano" | "lista";
type AssignFilter = "minhas" | "equipe" | "todas";
type TypeFilter = "todas" | ActivityKind;

function AgendaPage() {
  const { user } = useAuth();
  const { companyId } = useActiveCompany();
  const qc = useQueryClient();
  const { members, byId } = useCompanyMembers(companyId);

  // ----- state -----
  const [view, setView] = useState<ViewMode>("dia");
  const [assignFilter, setAssignFilter] = useState<AssignFilter>("todas");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("todas");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [date, setDate] = useState<Date>(() => {
    const d = new Date();
    d.setSeconds(0, 0);
    return d;
  });
  const [createKind, setCreateKind] = useState<CreateKind | null>(null);
  const [createDefault, setCreateDefault] = useState<Date | undefined>();
  const [drawer, setDrawer] = useState<Activity | null>(null);

  // ----- queries -----
  const { data: cases = [] } = useQuery({
    queryKey: ["cases-mini", companyId],
    enabled: !!companyId,
    queryFn: async () =>
      (await supabase.from("cases").select("id, title").eq("company_id", companyId!).order("title"))
        .data ?? [],
  });

  const tasksQ = useQuery({
    queryKey: ["agenda-tasks", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select(
          "id, title, description, due_date, priority, status, assigned_to, case_id, case:cases(title)",
        )
        .eq("company_id", companyId!);
      if (error) throw error;
      return data as RawTask[];
    },
  });
  const eventsQ = useQuery({
    queryKey: ["agenda-events", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select(
          "id, title, description, event_type, starts_at, ends_at, location, assigned_to, case_id, case:cases(title)",
        )
        .eq("company_id", companyId!);
      if (error) throw error;
      return data as RawEvent[];
    },
  });
  const deadlinesQ = useQuery({
    queryKey: ["agenda-deadlines", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deadlines")
        .select("id, title, description, due_date, status, assigned_to, case_id, is_double_term")
        .eq("company_id", companyId!);
      if (error) throw error;
      return data as RawDeadline[];
    },
  });

  const isLoading = tasksQ.isLoading || eventsQ.isLoading || deadlinesQ.isLoading;

  // ----- realtime -----
  useEffect(() => {
    if (!companyId) return;
    const ch = supabase
      .channel(`agenda-${companyId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks", filter: `company_id=eq.${companyId}` },
        () => qc.invalidateQueries({ queryKey: ["agenda-tasks", companyId] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "events", filter: `company_id=eq.${companyId}` },
        () => qc.invalidateQueries({ queryKey: ["agenda-events", companyId] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "deadlines", filter: `company_id=eq.${companyId}` },
        () => qc.invalidateQueries({ queryKey: ["agenda-deadlines", companyId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [companyId, qc]);

  // ----- normalize + filter -----
  const allActivities = useMemo(
    () =>
      toActivities({
        tasks: tasksQ.data ?? [],
        events: eventsQ.data ?? [],
        deadlines: deadlinesQ.data ?? [],
      }),
    [tasksQ.data, eventsQ.data, deadlinesQ.data],
  );

  const filteredAll = useMemo(() => {
    return allActivities.filter((a) => {
      if (typeFilter !== "todas" && a.kind !== typeFilter) return false;
      if (assignFilter === "minhas" && a.assignedTo !== user?.id) return false;
      if (assignFilter === "equipe" && a.assignedTo === user?.id) return false;
      if (search.trim()) {
        const s = search.toLowerCase();
        const owner = a.assignedTo ? (byId.get(a.assignedTo) ?? "") : "";
        const hay = `${a.title} ${a.description ?? ""} ${a.caseTitle ?? ""} ${owner}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [allActivities, typeFilter, assignFilter, search, user?.id, byId]);

  const dayActivities = useMemo(
    () => filteredAll.filter((a) => isSameDay(a.start, date)),
    [filteredAll, date],
  );

  const upcoming = useMemo(() => {
    const now = new Date();
    return filteredAll
      .filter((a) => a.start >= now)
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .slice(0, 12);
  }, [filteredAll]);

  // ----- nav -----
  const shiftDay = (d: number) =>
    setDate((cur) => {
      const n = new Date(cur);
      n.setDate(n.getDate() + d);
      return n;
    });
  const goToday = () => {
    const d = new Date();
    d.setSeconds(0, 0);
    setDate(d);
  };

  // keyboard
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const tag = (ev.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (ev.target as HTMLElement)?.isContentEditable)
        return;
      if (ev.key === "ArrowLeft") shiftDay(-1);
      else if (ev.key === "ArrowRight") shiftDay(1);
      else if (ev.key.toLowerCase() === "t") goToday();
      else if (ev.key.toLowerCase() === "n") setCreateKind("tarefa");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["agenda-tasks", companyId] });
    qc.invalidateQueries({ queryKey: ["agenda-events", companyId] });
    qc.invalidateQueries({ queryKey: ["agenda-deadlines", companyId] });
    toast.success("Agenda atualizada");
  };

  // ----- mutations: complete / delete -----
  const completeMut = useMutation({
    mutationFn: async (a: Activity) => {
      if (a.source === "task") {
        const id = a.id.replace("task:", "");
        const { error } = await supabase
          .from("tasks")
          .update({ status: "done", completed_at: new Date().toISOString() })
          .eq("id", id);
        if (error) throw error;
      } else if (a.source === "deadline") {
        const id = a.id.replace("deadline:", "");
        const { error } = await supabase.from("deadlines").update({ status: "done" }).eq("id", id);
        if (error) throw error;
      } else {
        throw new Error("Eventos não podem ser concluídos.");
      }
    },
    onSuccess: () => {
      toast.success("Atividade concluída");
      refresh();
      setDrawer(null);
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });
  const deleteMut = useMutation({
    mutationFn: async (a: Activity) => {
      const tbl = a.source === "task" ? "tasks" : a.source === "event" ? "events" : "deadlines";
      const id = a.id.split(":")[1];
      const { error } = await supabase.from(tbl).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Atividade excluída");
      refresh();
      setDrawer(null);
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  return (
    <TooltipProvider delayDuration={200}>
      <div className="-m-4 md:-m-6 lg:-m-8 min-h-[calc(100vh-4rem)] bg-background text-foreground relative">
        {/* subtle ambient glow */}
        <div
          className="pointer-events-none absolute inset-0 -z-0 opacity-60"
          style={{
            backgroundImage:
              "radial-gradient(700px 350px at 10% -10%, hsl(var(--primary) / 0.08), transparent 60%), radial-gradient(900px 450px at 100% 0%, hsl(var(--primary) / 0.05), transparent 60%)",
          }}
        />

        <div className="relative px-6 lg:px-10 pt-8 pb-12 max-w-[1400px] mx-auto">
          {/* === Header === */}
          <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
            <div>
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" /> Agenda jurídica
              </div>
              <h1 className="font-display text-4xl md:text-5xl font-normal tracking-tight text-balance">
                Agenda
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={refresh}
                    className="h-9 w-9 grid place-items-center rounded-md border border-border bg-card hover:bg-accent hover:border-border text-foreground transition-colors"
                  >
                    <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Atualizar</TooltipContent>
              </Tooltip>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="h-9 w-9 grid place-items-center rounded-md border border-border bg-card hover:bg-accent hover:border-border text-foreground">
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-56 bg-popover backdrop-blur-xl border-border text-foreground"
                >
                  <DropdownMenuItem className="focus:bg-accent" onClick={() => window.print()}>
                    Imprimir agenda
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="focus:bg-accent"
                    onClick={() => toast.info("Exportação em breve")}
                  >
                    Exportar (PDF/CSV)
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="focus:bg-accent"
                    onClick={() => toast.info("Integração em breve")}
                  >
                    Sincronizar Google Calendar
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-border" />
                  <DropdownMenuItem
                    className="focus:bg-accent"
                    onClick={() => toast.info("Configurações em breve")}
                  >
                    Configurações
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <CreateMenu
                onPick={(k) => {
                  setCreateDefault(undefined);
                  setCreateKind(k);
                }}
              />
            </div>
          </div>

          {/* === Filter pills === */}
          <div className="flex items-center gap-2 mb-6 flex-wrap">
            <PillSelect
              label="Visualização"
              value={view}
              onChange={(v) => setView(v as ViewMode)}
              options={[
                { value: "dia", label: "Por dia" },
                { value: "semana", label: "Por semana" },
                { value: "mes", label: "Por mês" },
                { value: "ano", label: "Por ano" },
                { value: "lista", label: "Lista" },
              ]}
            />
            <PillSelect
              label="Atribuições"
              value={assignFilter}
              onChange={(v) => setAssignFilter(v as AssignFilter)}
              options={[
                { value: "minhas", label: "Minhas atribuições" },
                { value: "equipe", label: "Da minha equipe" },
                { value: "todas", label: "Todas" },
              ]}
            />
            <PillSelect
              label="Tipo"
              value={typeFilter}
              onChange={(v) => setTypeFilter(v as TypeFilter)}
              options={[
                { value: "todas", label: "Todas as atividades" },
                { value: "tarefa", label: "Tarefas" },
                { value: "evento", label: "Eventos" },
                { value: "prazo", label: "Prazos" },
                { value: "audiencia", label: "Audiências" },
              ]}
            />
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className="h-9 w-9 grid place-items-center rounded-full border border-border bg-card hover:bg-accent text-muted-foreground"
                  title="Etiquetas"
                >
                  <Tag className="h-4 w-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-64 bg-muted border-border text-foreground">
                <p className="text-sm text-foreground font-medium mb-1">Filtrar por etiqueta</p>
                <p className="text-xs text-muted-foreground">Disponível em breve.</p>
              </PopoverContent>
            </Popover>
            <Popover open={searchOpen} onOpenChange={setSearchOpen}>
              <PopoverTrigger asChild>
                <button
                  className="h-9 w-9 grid place-items-center rounded-full border border-border bg-card hover:bg-accent text-muted-foreground"
                  title="Buscar"
                >
                  <Search className="h-4 w-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-72 bg-muted border-border text-foreground">
                <Input
                  autoFocus
                  placeholder="Buscar por título, processo, responsável..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-background border-border text-foreground"
                />
                {search && (
                  <p className="text-[11px] text-muted-foreground mt-2">
                    {filteredAll.length} resultado(s)
                  </p>
                )}
              </PopoverContent>
            </Popover>
            {search && (
              <button
                onClick={() => setSearch("")}
                className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                <X className="h-3 w-3" /> Limpar busca: "{search}"
              </button>
            )}
          </div>

          {/* === Main grid === */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
            {/* Calendar */}
            <section className="rounded-2xl border border-border bg-card backdrop-blur-sm overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="px-3 h-8 rounded-md border border-border bg-muted hover:bg-accent text-sm font-medium text-foreground inline-flex items-center gap-1.5">
                        {isSameDay(date, new Date()) ? "Hoje" : formatDateLong(date)}
                        <ChevronRight className="h-3 w-3 rotate-90 text-muted-foreground" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      className="bg-muted border-border text-foreground"
                    >
                      <DropdownMenuItem onClick={goToday} className="focus:bg-accent">
                        Hoje
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          const n = new Date();
                          n.setDate(n.getDate() + 1);
                          n.setSeconds(0, 0);
                          setDate(n);
                        }}
                        className="focus:bg-accent"
                      >
                        Amanhã
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-border" />
                      <div className="px-2 py-1.5">
                        <Input
                          type="date"
                          value={`${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`}
                          onChange={(e) => {
                            if (!e.target.value) return;
                            const [y, m, d] = e.target.value.split("-").map(Number);
                            const n = new Date(date);
                            n.setFullYear(y, m - 1, d);
                            setDate(n);
                          }}
                          className="bg-background border-border text-foreground h-8"
                        />
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={goToday}
                    className="text-foreground hover:bg-accent h-8 text-xs uppercase tracking-wider font-semibold"
                  >
                    HOJE
                  </Button>
                  <button
                    onClick={() => shiftDay(-1)}
                    className="h-8 w-8 grid place-items-center rounded-md hover:bg-accent text-muted-foreground"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => shiftDay(1)}
                    className="h-8 w-8 grid place-items-center rounded-md hover:bg-accent text-muted-foreground"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {view === "dia" ? (
                <DailyGrid
                  date={date}
                  activities={dayActivities}
                  loading={isLoading}
                  onActivityClick={setDrawer}
                  onSlotClick={(d) => {
                    setCreateDefault(d);
                    setCreateKind("tarefa");
                  }}
                />
              ) : (
                <ListView
                  activities={filteredAll}
                  loading={isLoading}
                  onActivityClick={setDrawer}
                />
              )}
            </section>

            {/* Upcoming panel */}
            <aside className="rounded-2xl border border-border bg-card backdrop-blur-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-foreground">
                  {upcoming.length > 0 ? "Próximas atividades" : "Nenhuma atividade"}
                </h2>
                <span className="text-[11px] text-muted-foreground">{upcoming.length}</span>
              </div>
              {isLoading ? (
                <div className="space-y-2">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
                  ))}
                </div>
              ) : upcoming.length === 0 ? (
                <EmptyUpcoming onCreate={() => setCreateKind("tarefa")} />
              ) : (
                <div className="space-y-2">
                  {upcoming.map((a) => (
                    <UpcomingCard
                      key={a.id}
                      a={a}
                      ownerName={a.assignedTo ? (byId.get(a.assignedTo) ?? "Membro") : null}
                      onClick={() => setDrawer(a)}
                    />
                  ))}
                </div>
              )}
            </aside>
          </div>

          {/* keyboard hint */}
          <p className="text-[10px] text-muted-foreground/70 mt-4 text-center">
            Atalhos: <kbd className="px-1 py-0.5 rounded bg-muted border border-border">←</kbd> dia
            anterior · <kbd className="px-1 py-0.5 rounded bg-muted border border-border">→</kbd>{" "}
            próximo · <kbd className="px-1 py-0.5 rounded bg-muted border border-border">T</kbd>{" "}
            hoje · <kbd className="px-1 py-0.5 rounded bg-muted border border-border">N</kbd> nova
          </p>
        </div>

        {/* Drawer */}
        <ActivityDrawer
          activity={drawer}
          onClose={() => setDrawer(null)}
          ownerName={drawer?.assignedTo ? (byId.get(drawer.assignedTo) ?? null) : null}
          onComplete={(a) => completeMut.mutate(a)}
          onDelete={(a) => {
            confirmDialog({
              title: "Excluir atividade",
              description: "Deseja realmente excluir esta atividade da agenda?",
              confirmText: "Excluir",
            }).then((ok) => {
              if (ok) deleteMut.mutate(a);
            });
          }}
        />

        {/* Modais */}
        <CreateModalRouter
          kind={createKind}
          defaultDate={createDefault}
          ctx={{
            companyId,
            userId: user?.id ?? null,
            cases,
            members,
            onSaved: () => {
              setCreateKind(null);
              refresh();
            },
            onClose: () => setCreateKind(null),
          }}
        />
      </div>
    </TooltipProvider>
  );
}

// =================== Pill Select ===================
function PillSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  const current = options.find((o) => o.value === value)?.label ?? label;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="h-9 px-3.5 rounded-full border border-border bg-card hover:bg-accent hover:border-border text-sm text-foreground inline-flex items-center gap-1.5 transition-colors">
          <span className="text-muted-foreground text-[11px] uppercase tracking-wider">
            {label}:
          </span>{" "}
          {current}
          <ChevronRight className="h-3 w-3 rotate-90 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="bg-muted border-border text-foreground">
        <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground">
          {label}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-border" />
        {options.map((o) => (
          <DropdownMenuItem
            key={o.value}
            onClick={() => onChange(o.value)}
            className="focus:bg-accent"
          >
            {o.label}
            {o.value === value && <Check className="h-3.5 w-3.5 ml-auto text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// =================== Daily grid ===================
function DailyGrid({
  date,
  activities,
  loading,
  onActivityClick,
  onSlotClick,
}: {
  date: Date;
  activities: Activity[];
  loading: boolean;
  onActivityClick: (a: Activity) => void;
  onSlotClick: (d: Date) => void;
}) {
  const HOUR_H = 56; // px per hour
  const allDay = activities.filter((a) => a.allDay);
  const timed = activities.filter((a) => !a.allDay);
  const isToday = isSameDay(date, new Date());
  const containerRef = useRef<HTMLDivElement>(null);

  // current time line
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  const nowOffset = isToday ? (now.getHours() + now.getMinutes() / 60) * HOUR_H : -1;

  // scroll to ~ current hour or 8am on mount
  useEffect(() => {
    if (!containerRef.current) return;
    const target = isToday ? Math.max(0, (now.getHours() - 1) * HOUR_H) : 7 * HOUR_H;
    containerRef.current.scrollTop = target;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  if (loading) {
    return (
      <div className="p-6 space-y-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-12 rounded bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* All-day strip */}
      <div className="flex border-b border-border bg-muted/30">
        <div className="w-16 shrink-0 px-2 py-2 text-[10px] uppercase tracking-wider text-muted-foreground border-r border-border">
          Dia todo
        </div>
        <div className="flex-1 p-2 flex flex-wrap gap-1.5 min-h-[40px]">
          {allDay.length === 0 ? (
            <span className="text-[11px] text-muted-foreground/70 self-center pl-1">—</span>
          ) : (
            allDay.map((a) => (
              <ActivityChip key={a.id} a={a} onClick={() => onActivityClick(a)} compact />
            ))
          )}
        </div>
      </div>

      {/* Hour grid */}
      <div ref={containerRef} className="relative overflow-y-auto" style={{ maxHeight: "70vh" }}>
        <div className="relative" style={{ height: HOUR_H * 24 }}>
          {/* hour rows */}
          {Array.from({ length: 24 }, (_, h) => (
            <div
              key={h}
              className="flex absolute left-0 right-0 border-b border-border"
              style={{ top: h * HOUR_H, height: HOUR_H }}
            >
              <div className="w-16 shrink-0 pr-2 pt-1 text-[10px] tabular-nums text-muted-foreground text-right border-r border-border">
                {pad2(h)}:00
              </div>
              <button
                onClick={() => {
                  const d = new Date(date);
                  d.setHours(h, 0, 0, 0);
                  onSlotClick(d);
                }}
                className="flex-1 hover:bg-accent/40 transition-colors text-left"
                aria-label={`Criar tarefa às ${pad2(h)}:00`}
              />
            </div>
          ))}

          {/* now line */}
          {isToday && nowOffset >= 0 && (
            <div
              className="absolute left-16 right-0 z-20 pointer-events-none"
              style={{ top: nowOffset }}
            >
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.7)]" />
                <span className="h-px bg-rose-500/70 flex-1 shadow-[0_0_8px_rgba(244,63,94,0.4)]" />
              </div>
            </div>
          )}

          {/* events */}
          <div className="absolute left-16 right-2 top-0 bottom-0 pointer-events-none">
            {timed.map((a) => {
              const startH = a.start.getHours() + a.start.getMinutes() / 60;
              const endH = a.end
                ? Math.max(startH + 0.5, a.end.getHours() + a.end.getMinutes() / 60)
                : startH + 0.75;
              const top = startH * HOUR_H;
              const height = Math.max(28, (endH - startH) * HOUR_H - 2);
              return (
                <ActivityCard
                  key={a.id}
                  a={a}
                  style={{ top, height }}
                  onClick={() => onActivityClick(a)}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// =================== Activity Card (in grid) ===================
function ActivityCard({
  a,
  style,
  onClick,
}: {
  a: Activity;
  style: React.CSSProperties;
  onClick: () => void;
}) {
  const c = KIND_COLOR[a.kind];
  return (
    <button
      onClick={onClick}
      className={cn(
        "absolute left-2 right-2 rounded-md border backdrop-blur-sm pointer-events-auto text-left overflow-hidden group transition-all hover:translate-y-[-1px]",
        c.soft,
      )}
      style={{ ...style, paddingLeft: 8 }}
    >
      <span className={cn("absolute left-0 top-0 bottom-0 w-1", c.bar)} />
      <div className="px-2 py-1.5">
        <div className="flex items-center gap-1.5">
          <KindIcon kind={a.kind} className={cn("h-3 w-3 shrink-0", c.text)} />
          <p className="text-[12px] font-medium text-foreground truncate">{a.title}</p>
        </div>
        <p className="text-[10px] text-muted-foreground tabular-nums mt-0.5">
          {a.start.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          {a.end &&
            ` – ${a.end.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
          {a.location && <span className="ml-1.5 text-muted-foreground">· {a.location}</span>}
        </p>
      </div>
    </button>
  );
}

function ActivityChip({
  a,
  onClick,
  compact,
}: {
  a: Activity;
  onClick: () => void;
  compact?: boolean;
}) {
  const c = KIND_COLOR[a.kind];
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] hover:brightness-125 transition",
        c.chip,
        compact ? "" : "",
      )}
    >
      <KindIcon kind={a.kind} className="h-3 w-3" />
      <span className="truncate max-w-[160px]">{a.title}</span>
    </button>
  );
}

function KindIcon({ kind, className }: { kind: ActivityKind; className?: string }) {
  const Icon =
    kind === "tarefa"
      ? CheckSquare
      : kind === "evento"
        ? Users
        : kind === "prazo"
          ? AlertCircle
          : Gavel;
  return <Icon className={className} />;
}

// =================== List view (fallback for outras visualizações) ===================
function ListView({
  activities,
  loading,
  onActivityClick,
}: {
  activities: Activity[];
  loading: boolean;
  onActivityClick: (a: Activity) => void;
}) {
  if (loading)
    return (
      <div className="p-6">
        <div className="h-32 rounded bg-muted animate-pulse" />
      </div>
    );
  if (activities.length === 0)
    return (
      <div className="p-12 text-center text-sm text-muted-foreground">
        Nenhuma atividade encontrada.
      </div>
    );
  const sorted = [...activities].sort((a, b) => a.start.getTime() - b.start.getTime());
  return (
    <div className="divide-y divide-border">
      {sorted.map((a) => {
        const c = KIND_COLOR[a.kind];
        return (
          <button
            key={a.id}
            onClick={() => onActivityClick(a)}
            className="w-full flex items-start gap-3 p-4 hover:bg-card text-left transition-colors"
          >
            <span className={cn("w-1 self-stretch rounded-full", c.bar)} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <KindIcon kind={a.kind} className={cn("h-3.5 w-3.5", c.text)} />
                <p className="font-medium text-foreground truncate">{a.title}</p>
                <span className={cn("text-[10px] px-1.5 py-0.5 rounded border", c.chip)}>
                  {c.label}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 tabular-nums">
                {a.start.toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {a.caseTitle && <span className="ml-2 text-muted-foreground">· {a.caseTitle}</span>}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// =================== Upcoming card ===================
function UpcomingCard({
  a,
  ownerName,
  onClick,
}: {
  a: Activity;
  ownerName: string | null;
  onClick: () => void;
}) {
  const c = KIND_COLOR[a.kind];
  return (
    <button
      onClick={onClick}
      className="w-full relative overflow-hidden rounded-lg border border-border bg-card hover:bg-muted hover:border-border transition-colors p-3 pl-3.5 text-left"
    >
      <span className={cn("absolute left-0 top-0 bottom-0 w-1", c.bar)} />
      <div className="flex items-start gap-2">
        <KindIcon kind={a.kind} className={cn("h-4 w-4 mt-0.5 shrink-0", c.text)} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{a.title}</p>
          <div className="mt-1 flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground">
            <span className={cn("px-1.5 py-0.5 rounded border", c.chip)}>{c.label}</span>
            <span className="tabular-nums">
              {a.start.toLocaleString("pt-BR", {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            {ownerName && <span className="truncate">· {ownerName}</span>}
          </div>
        </div>
      </div>
    </button>
  );
}

function EmptyUpcoming({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center">
      <svg
        viewBox="0 0 64 64"
        className="h-14 w-14 mx-auto text-muted-foreground/70 mb-2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <rect x="10" y="14" width="44" height="40" rx="4" />
        <path d="M10 24h44M22 8v10M42 8v10" strokeLinecap="round" />
        <circle cx="32" cy="38" r="3" className="fill-primary" stroke="none" />
      </svg>
      <p className="text-xs text-muted-foreground">
        Nenhuma atividade encontrada.
        <br />
        Verifique os filtros selecionados.
      </p>
      <button
        onClick={onCreate}
        className="mt-3 text-[11px] font-semibold tracking-wide text-primary hover:underline"
      >
        + Criar primeira atividade
      </button>
    </div>
  );
}

// =================== Drawer ===================
function ActivityDrawer({
  activity,
  onClose,
  ownerName,
  onComplete,
  onDelete,
}: {
  activity: Activity | null;
  onClose: () => void;
  ownerName: string | null;
  onComplete: (a: Activity) => void;
  onDelete: (a: Activity) => void;
}) {
  if (!activity) return null;
  const c = KIND_COLOR[activity.kind];
  return (
    <Sheet open={!!activity} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="bg-background/95 backdrop-blur-2xl border-border text-foreground sm:max-w-md">
        <SheetHeader>
          <div className="flex items-center gap-2 mb-1">
            <span
              className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] border",
                c.chip,
              )}
            >
              <KindIcon kind={activity.kind} className="h-3 w-3" /> {c.label}
            </span>
            {activity.priority && (
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {PRIORITY_LABEL[activity.priority]}
              </span>
            )}
          </div>
          <SheetTitle className="text-foreground text-xl">{activity.title}</SheetTitle>
          <SheetDescription className="text-muted-foreground">
            Detalhes da atividade selecionada.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-3 text-sm text-foreground">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="tabular-nums">
              {activity.start.toLocaleString("pt-BR", {
                weekday: "short",
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
              {activity.end &&
                ` – ${activity.end.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
            </span>
          </div>
          {activity.location && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              {activity.location}
            </div>
          )}
          {ownerName && (
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              {ownerName}
            </div>
          )}
          {activity.caseTitle && (
            <div className="flex items-center gap-2">
              <Gavel className="h-4 w-4 text-muted-foreground" />
              {activity.caseTitle}
            </div>
          )}
          {activity.description && (
            <div className="rounded-lg border border-border bg-card p-3 whitespace-pre-wrap text-foreground">
              {activity.description}
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center gap-2">
          {(activity.source === "task" || activity.source === "deadline") && (
            <Button onClick={() => onComplete(activity)} className="font-semibold">
              <Check className="h-4 w-4 mr-1" /> Concluir
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={() => onDelete(activity)}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-1" /> Excluir
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
