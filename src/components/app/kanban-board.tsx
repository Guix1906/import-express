import { useMemo, useState, useEffect } from "react";

import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listKanbanCards, moveCardOnTrack } from "@/lib/kanban.functions";
import { LEGAL_PHASES, OPERATIONAL_STATUSES, PRIORITY_TONE, type Track } from "@/lib/kanban-tracks";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { AlertCircle, User, Calendar, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type KanbanCard = {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  assignee_id: string | null;
  client_id: string | null;
  client_name_snapshot: string | null;
  practice_area: string | null;
  demand_type: string | null;
  due_date: string | null;
  sla_hours: number | null;
  created_at: string;
  legal_phase: string;
  operational_status: string;
  legal_phase_changed_at: string;
  operational_status_changed_at: string;
};
type Member = { id: string; name: string; avatar: string | null };

export function KanbanBoard({
  track,
  title,
  subtitle,
  lockedAssigneeId,
}: {
  track: Track;
  title: string;
  subtitle: string;
  lockedAssigneeId?: string;
}) {
  const columns = track === "legal" ? LEGAL_PHASES : OPERATIONAL_STATUSES;
  const qc = useQueryClient();
  const listFn = useServerFn(listKanbanCards);
  const moveFn = useServerFn(moveCardOnTrack);

  const [filters, setFilters] = useState<{
    assignee_id?: string;
    practice_area?: string;
    priority?: string;
    search?: string;
  }>({});

  const effectiveAssignee = lockedAssigneeId ?? filters.assignee_id;
  const queryKey = useMemo(
    () => ["kanban", track, { ...filters, assignee_id: effectiveAssignee }],
    [track, filters, effectiveAssignee],
  );

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () =>
      listFn({
        data: {
          track,
          assignee_id: effectiveAssignee || undefined,
          practice_area: filters.practice_area || undefined,
          priority: filters.priority || undefined,
          search: filters.search || undefined,
        },
      }),
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  });

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel(`kanban-${track}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "production_cards" }, () =>
        qc.invalidateQueries({ queryKey: ["kanban", track] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc, track]);

  const move = useMutation({
    mutationFn: (input: { cardId: string; toValue: string }) =>
      moveFn({ data: { cardId: input.cardId, track, toValue: input.toValue } }),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey });
      const prev = qc.getQueryData<{ cards: KanbanCard[]; members: Member[] }>(queryKey);
      if (prev) {
        const key = track === "legal" ? "legal_phase" : "operational_status";
        qc.setQueryData(queryKey, {
          ...prev,
          cards: prev.cards.map((c) =>
            c.id === input.cardId ? ({ ...c, [key]: input.toValue } as unknown as KanbanCard) : c,
          ),
        });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(queryKey, ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: ["kanban", track] }),
  });

  const cards = useMemo(() => data?.cards ?? [], [data?.cards]);
  const members = useMemo(() => data?.members ?? [], [data?.members]);

  const grouped = useMemo(() => {
    const key = track === "legal" ? "legal_phase" : "operational_status";
    const g: Record<string, KanbanCard[]> = {};
    for (const col of columns) g[col.key] = [];
    for (const c of cards) {
      const k = (c as unknown as Record<string, string>)[key];
      if (g[k]) g[k].push(c);
    }
    return g;
  }, [cards, columns, track]);

  const areas = useMemo(
    () => Array.from(new Set(cards.map((c) => c.practice_area).filter(Boolean))) as string[],
    [cards],
  );

  return (
    <div className="space-y-4">
      <PageHeader title={title} subtitle={subtitle} />

      <div className="flex flex-wrap items-center gap-2 px-1">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar título..."
            className="h-9 w-56 pl-7"
            value={filters.search ?? ""}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          />
        </div>
        {!lockedAssigneeId && (
          <select
            value={filters.assignee_id ?? ""}
            onChange={(e) =>
              setFilters((f) => ({ ...f, assignee_id: e.target.value || undefined }))
            }
            className="h-9 rounded-md border bg-background px-2 text-sm"
          >
            <option value="">Advogado: todos</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        )}
        <select
          value={filters.practice_area ?? ""}
          onChange={(e) =>
            setFilters((f) => ({ ...f, practice_area: e.target.value || undefined }))
          }
          className="h-9 rounded-md border bg-background px-2 text-sm"
        >
          <option value="">Área: todas</option>
          {areas.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <select
          value={filters.priority ?? ""}
          onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value || undefined }))}
          className="h-9 rounded-md border bg-background px-2 text-sm"
        >
          <option value="">Prioridade: todas</option>
          <option value="baixa">Baixa</option>
          <option value="media">Média</option>
          <option value="alta">Alta</option>
          <option value="urgente">Urgente</option>
        </select>
        {(filters.assignee_id || filters.practice_area || filters.priority || filters.search) && (
          <button
            onClick={() => setFilters({})}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            limpar
          </button>
        )}
      </div>

      <div className="relative rounded-3xl border bg-gradient-to-br from-slate-50 via-blue-50/40 to-indigo-50/60 dark:from-slate-900/80 dark:via-indigo-950/30 dark:to-slate-900/80 p-3 overflow-hidden">
        <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-primary/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-fuchsia-400/10 blur-3xl" />
        <div className="relative overflow-x-auto pb-2">
          <div className="flex gap-3 min-w-max">
            {columns.map((col) => (
              <BoardColumn
                key={col.key}
                column={col}
                cards={grouped[col.key] ?? []}
                loading={isLoading}
                onDropCard={(cardId) => move.mutate({ cardId, toValue: col.key })}
                members={members}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function BoardColumn({
  column,
  cards,
  loading,
  onDropCard,
  members,
}: {
  column: { key: string; label: string; tone: string };
  cards: KanbanCard[];
  loading: boolean;
  onDropCard: (cardId: string) => void;
  members: Member[];
}) {
  const [isOver, setIsOver] = useState(false);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!isOver) setIsOver(true);
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsOver(false);
        const cardId = e.dataTransfer.getData("text/card-id");
        if (cardId) onDropCard(cardId);
      }}
      className={cn(
        "w-72 shrink-0 rounded-2xl border border-white/40 dark:border-white/10 bg-white/60 dark:bg-white/[0.04] backdrop-blur-xl shadow-[0_8px_30px_-12px_rgba(0,0,0,0.15)] flex flex-col transition-all",
        isOver && "ring-2 ring-primary bg-primary/10 scale-[1.01]",
      )}
    >
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/40 dark:border-white/10">
        <div className="flex items-center gap-2">
          <span className={cn("inline-block h-2.5 w-2.5 rounded-full border", column.tone)} />
          <span className="font-semibold text-sm tracking-tight">{column.label}</span>
        </div>
        <Badge variant="secondary" className="text-xs rounded-full bg-background/70 backdrop-blur">
          {cards.length}
        </Badge>
      </div>
      <div className="flex-1 p-2 space-y-2 min-h-[200px] max-h-[calc(100vh-260px)] overflow-y-auto">
        {loading
          ? Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
          : cards.map((c) => <CardItem key={c.id} card={c} members={members} />)}
        {!loading && cards.length === 0 && (
          <div className="text-xs text-muted-foreground text-center py-6">Sem cards</div>
        )}
      </div>
    </div>
  );
}

function CardItem({ card, members }: { card: KanbanCard; members: Member[] }) {
  const assignee = members.find((m) => m.id === card.assignee_id);
  const overdue = card.due_date && new Date(card.due_date) < new Date();

  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/card-id", card.id)}
      className={cn(
        "block rounded-lg border bg-card p-3 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-grab active:cursor-grabbing",
        overdue && "border-rose-500/40",
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <h4 className="text-sm font-medium line-clamp-2 flex-1">{card.title}</h4>
        <span
          className={cn(
            "text-[10px] uppercase font-bold tracking-wide px-1.5 py-0.5 rounded",
            PRIORITY_TONE[card.priority] ?? PRIORITY_TONE.media,
          )}
        >
          {card.priority}
        </span>
      </div>

      {card.client_name_snapshot && (
        <div className="text-xs text-muted-foreground truncate mb-1.5">
          {card.client_name_snapshot}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1 mb-2">
        {card.practice_area && (
          <Badge variant="outline" className="text-[10px] py-0">
            {card.practice_area}
          </Badge>
        )}
        {card.demand_type && (
          <Badge variant="outline" className="text-[10px] py-0">
            {card.demand_type}
          </Badge>
        )}
      </div>

      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1 truncate">
          <User className="h-3 w-3" />
          {assignee?.name ?? "—"}
        </span>
        {card.due_date ? (
          <span
            className={cn(
              "flex items-center gap-1",
              overdue && "text-rose-600 dark:text-rose-400 font-medium",
            )}
          >
            {overdue && <AlertCircle className="h-3 w-3" />}
            <Calendar className="h-3 w-3" />
            {formatDistanceToNow(new Date(card.due_date), { locale: ptBR, addSuffix: true })}
          </span>
        ) : null}
      </div>
    </div>
  );
}
