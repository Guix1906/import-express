import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useActiveCompany } from "@/hooks/use-active-company";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CardDrawer } from "@/components/quadros/CardDrawer";
import { Plus, ChevronLeft, ChevronRight, Layers, Filter, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { CreateBoardDialog } from "@/components/app/create-board-dialog";
import { toast } from "sonner";
import { KanbanColumn } from "@/components/meu-quadro/KanbanColumn";
import { AddColumnButton } from "@/components/meu-quadro/AddColumnButton";
import {
  ROLE_LABEL,
  DEFAULT_COLUMNS,
  initials,
  paletteFor,
  type AppRole,
  type MemberLite,
  type Card,
  type MemberColumn,
  type BoardLite,
} from "@/components/meu-quadro/shared";

export const Route = createFileRoute("/_app/app/meu-quadro")({
  component: QuadrosPage,
  validateSearch: (s: Record<string, unknown>) => ({
    card_id: typeof s.card_id === "string" ? s.card_id : undefined,
  }),
});

function QuadrosPage() {
  const { user } = useAuth();
  const { companyId } = useActiveCompany();
  const qc = useQueryClient();

  const { card_id: deepLinkCardId } = Route.useSearch();

  const [search] = useState("");
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [openCard, setOpenCard] = useState<Card | null>(null);
  const [memberScrollRef, setMemberScrollRef] = useState<HTMLDivElement | null>(null);
  const [highlightCardId, setHighlightCardId] = useState<string | null>(null);
  const consumedDeepLinkRef = useRef<string | null>(null);
  const openedDeepLinkRef = useRef<string | null>(null);

  // Fetch the target card from the deep link to discover its assignee/column
  const { data: targetCard } = useQuery({
    queryKey: ["meu-quadro-target-card", deepLinkCardId],
    enabled: !!deepLinkCardId && !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_cards")
        .select("id, assignee_id, column_key")
        .eq("id", deepLinkCardId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!targetCard?.assignee_id) return;
    if (consumedDeepLinkRef.current === targetCard.id) return;
    consumedDeepLinkRef.current = targetCard.id;
    setSelectedMember(targetCard.assignee_id);
    setHighlightCardId(targetCard.id);
  }, [targetCard]);

  const { data: members = [], isLoading: loadingMembers } = useQuery({
    queryKey: ["quadros-members", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const [membersRes, cardsRes, rolesRes] = await Promise.all([
        supabase.from("company_members").select("user_id").eq("company_id", companyId!),
        supabase
          .from("production_cards")
          .select("assignee_id")
          .eq("company_id", companyId!)
          .limit(2000),
        supabase.from("user_roles").select("user_id, role").eq("company_id", companyId!),
      ]);
      if (membersRes.error) throw membersRes.error;
      const userIds = (membersRes.data ?? []).map((m) => m.user_id);
      const profilesRes = userIds.length
        ? await supabase.from("profiles").select("id, full_name").in("id", userIds)
        : { data: [] as Array<{ id: string; full_name: string | null }>, error: null };
      const profileById = new Map<string, string>();
      (profilesRes.data ?? []).forEach((p) => profileById.set(p.id, p.full_name ?? "Membro"));
      const cards = cardsRes.data ?? [];
      const rolesByUser = new Map<string, AppRole>();
      const order: AppRole[] = ["owner", "admin", "lawyer", "assistant", "viewer"];
      (rolesRes.data ?? []).forEach((r: { user_id: string; role: AppRole }) => {
        const cur = rolesByUser.get(r.user_id);
        if (!cur || order.indexOf(r.role) < order.indexOf(cur)) rolesByUser.set(r.user_id, r.role);
      });
      const list: MemberLite[] = userIds.map((uid: string) => ({
        user_id: uid,
        full_name: profileById.get(uid) ?? "Membro",
        role: rolesByUser.get(uid) ?? null,
        total: cards.filter((c) => c.assignee_id === uid).length,
      }));
      return list.sort((a, b) => {
        if (a.user_id === user?.id) return -1;
        if (b.user_id === user?.id) return 1;
        return b.total - a.total;
      });
    },
  });

  useEffect(() => {
    if (!selectedMember && members.length > 0) {
      setSelectedMember(
        user?.id && members.some((m) => m.user_id === user.id) ? user.id : members[0].user_id,
      );
    }
  }, [members, selectedMember, user?.id]);

  const activeMember = members.find((m) => m.user_id === selectedMember) ?? null;
  const activeMemberIndex = members.findIndex((m) => m.user_id === selectedMember);
  const activePalette = paletteFor(activeMemberIndex >= 0 ? activeMemberIndex : 0);

  const { data: boards = [] } = useQuery({
    queryKey: ["meu-quadro-boards", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("boards")
        .select("id,name,description,board_type,color,gradient,icon,owner_id,role_label,created_at")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as BoardLite[];
    },
  });

  const _boards = boards;

  const { data: memberColumns = [], isLoading: loadingColumns } = useQuery({
    queryKey: ["quadros-columns", companyId, selectedMember],
    enabled: !!companyId && !!selectedMember,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("member_board_columns")
        .select("id,key,title,color,position")
        .eq("company_id", companyId!)
        .eq("owner_user_id", selectedMember!)
        .order("position", { ascending: true });
      if (error) throw error;
      if ((data ?? []).length === 0) {
        const seed = DEFAULT_COLUMNS.map((c, i) => ({
          company_id: companyId!,
          owner_user_id: selectedMember!,
          key: c.key,
          title: c.title,
          color: c.color,
          position: i,
        }));
        const { data: inserted, error: insErr } = await supabase
          .from("member_board_columns")
          .insert(seed)
          .select("id,key,title,color,position");
        if (insErr) throw insErr;
        return ((inserted ?? []) as MemberColumn[]).sort((a, b) => a.position - b.position);
      }
      return data as MemberColumn[];
    },
  });

  const { data: cards = [], isLoading: loadingCards } = useQuery({
    queryKey: ["quadros-cards", companyId, selectedMember, search],
    enabled: !!companyId && !!selectedMember,
    staleTime: 15_000,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      let q = supabase
        .from("production_cards")
        .select(
          "id,title,client_id,client_name_snapshot,priority,operational_status,column_key,due_date,assignee_id,practice_area,process_number,description,observations,category,created_at",
        )
        .eq("company_id", companyId!)
        .eq("assignee_id", selectedMember!)
        .is("board_id", null)
        .order("updated_at", { ascending: false })
        .limit(500);
      if (search.trim()) q = q.ilike("title", `%${search.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Card[];
    },
  });

  // Realtime — debounced to avoid invalidation storms
  useEffect(() => {
    if (!companyId) return;
    let cardsT: ReturnType<typeof setTimeout> | null = null;
    let boardsT: ReturnType<typeof setTimeout> | null = null;
    const scheduleCards = () => {
      if (cardsT) clearTimeout(cardsT);
      cardsT = setTimeout(() => {
        qc.invalidateQueries({ queryKey: ["quadros-cards"] });
      }, 400);
    };
    const scheduleBoards = () => {
      if (boardsT) clearTimeout(boardsT);
      boardsT = setTimeout(() => {
        qc.invalidateQueries({ queryKey: ["meu-quadro-boards"] });
      }, 400);
    };
    const ch = supabase
      .channel(`quadros-${companyId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "production_cards" },
        scheduleCards,
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "boards" }, scheduleBoards)
      .subscribe();
    return () => {
      if (cardsT) clearTimeout(cardsT);
      if (boardsT) clearTimeout(boardsT);
      supabase.removeChannel(ch);
    };
  }, [companyId, qc]);

  const moveCard = useMutation({
    mutationFn: async ({
      cardId,
      toColumn,
      fromColumn,
    }: {
      cardId: string;
      toColumn: string;
      fromColumn: string;
    }) => {
      const { error } = await supabase
        .from("production_cards")
        .update({
          column_key: toColumn,
          operational_status_changed_at: new Date().toISOString(),
        })
        .eq("id", cardId);
      if (error) throw error;
      if (companyId && user?.id && fromColumn !== toColumn) {
        await supabase.from("production_card_events").insert({
          company_id: companyId,
          card_id: cardId,
          actor_id: user.id,
          event_type: "card_moved",
          payload: { from: fromColumn, to: toColumn },
        });
      }
    },
    onMutate: async ({ cardId, toColumn }) => {
      const key = ["quadros-cards", companyId, selectedMember, search];
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Card[]>(key);
      if (prev) {
        qc.setQueryData<Card[]>(
          key,
          prev.map((c) => (c.id === cardId ? { ...c, column_key: toColumn } : c)),
        );
      }
      return { prev, key };
    },
    onError: (e: Error, _v, ctx) => {
      if (ctx?.prev && ctx?.key) qc.setQueryData(ctx.key, ctx.prev);
      toast.error(e.message ?? "Falha ao mover");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["quadros-cards"] }),
  });

  const colsKey = ["quadros-columns", companyId, selectedMember];

  const addColumn = useMutation({
    mutationFn: async ({ title, color }: { title: string; color: string }) => {
      const key = `col_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const position = memberColumns.length;
      const { error } = await supabase.from("member_board_columns").insert({
        company_id: companyId!,
        owner_user_id: selectedMember!,
        key,
        title,
        color,
        position,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: colsKey }),
    onError: (e: Error) => toast.error(e.message ?? "Falha ao criar coluna"),
  });

  const updateColumn = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<MemberColumn> }) => {
      const { error } = await supabase.from("member_board_columns").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: colsKey }),
    onError: (e: Error) => toast.error(e.message ?? "Falha ao atualizar coluna"),
  });

  const deleteColumn = useMutation({
    mutationFn: async ({ col }: { col: MemberColumn }) => {
      const fallback = memberColumns.find((c) => c.id !== col.id);
      if (fallback) {
        await supabase
          .from("production_cards")
          .update({ column_key: fallback.key })
          .eq("company_id", companyId!)
          .eq("assignee_id", selectedMember!)
          .eq("column_key", col.key);
      }
      const { error } = await supabase.from("member_board_columns").delete().eq("id", col.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: colsKey });
      qc.invalidateQueries({ queryKey: ["quadros-cards"] });
    },
    onError: (e: Error) => toast.error(e.message ?? "Falha ao excluir coluna"),
  });

  const moveColumn = useMutation({
    mutationFn: async ({ id, direction }: { id: string; direction: -1 | 1 }) => {
      const sorted = [...memberColumns].sort((a, b) => a.position - b.position);
      const idx = sorted.findIndex((c) => c.id === id);
      const swapIdx = idx + direction;
      if (idx < 0 || swapIdx < 0 || swapIdx >= sorted.length) return;
      const a = sorted[idx];
      const b = sorted[swapIdx];
      await Promise.all([
        supabase.from("member_board_columns").update({ position: b.position }).eq("id", a.id),
        supabase.from("member_board_columns").update({ position: a.position }).eq("id", b.id),
      ]);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: colsKey }),
    onError: (e: Error) => toast.error(e.message ?? "Falha ao reordenar"),
  });

  const addCard = useMutation({
    mutationFn: async ({ title, columnKey }: { title: string; columnKey: string }) => {
      if (!companyId || !user || !selectedMember) throw new Error("Sessão inválida");
      const { error } = await supabase.from("production_cards").insert({
        company_id: companyId,
        assignee_id: selectedMember,
        created_by: user.id,
        title: title.trim(),
        column_key: columnKey,
        priority: "media",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quadros-cards"] });
      qc.invalidateQueries({ queryKey: ["quadros-members"] });
      toast.success("Processo adicionado");
    },
    onError: (e: Error) => toast.error(e.message ?? "Falha ao adicionar processo"),
  });

  const cardsByColumn = useMemo(() => {
    const map: Record<string, Card[]> = {};
    for (const col of memberColumns) map[col.key] = [];
    const firstKey = memberColumns[0]?.key;
    for (const c of cards) {
      const target = memberColumns.find((co) => co.key === c.column_key);
      const bucket = target?.key ?? firstKey;
      if (bucket) (map[bucket] ||= []).push(c);
    }
    return map;
  }, [cards, memberColumns]);

  const drawerMembers = useMemo(
    () => members.map((m) => ({ user_id: m.user_id, full_name: m.full_name })),
    [members],
  );
  const drawerColumns = useMemo(
    () => memberColumns.map((c) => ({ key: c.key, title: c.title })),
    [memberColumns],
  );

  useEffect(() => {
    if (!highlightCardId) return;
    const found = cards.find((c) => c.id === highlightCardId);
    if (!found) return;
    if (openedDeepLinkRef.current !== highlightCardId) {
      openedDeepLinkRef.current = highlightCardId;
      setOpenCard(found);
    }
    const t = setTimeout(() => setHighlightCardId(null), 3500);
    return () => clearTimeout(t);
  }, [highlightCardId, cards]);

  const scrollMembers = (dir: 1 | -1) => {
    memberScrollRef?.scrollBy({ left: dir * 320, behavior: "smooth" });
  };

  return (
    <div className="space-y-5 pb-8">
      {/* HEADER */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="h-11 w-11 rounded-xl bg-[#1E293B] text-[#4F46E5] flex items-center justify-center shadow-sm">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[#1E293B]">Quadros</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Organize e acompanhe os processos por etapa e responsável.
            </p>
          </div>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="h-11 rounded-xl px-5 gap-2 bg-[#1E293B] hover:bg-[#1E293B]/90 text-white shadow-md"
        >
          <Plus className="h-4 w-4" />
          Novo quadro geral
        </Button>
      </header>

      <CreateBoardDialog open={createOpen} onOpenChange={setCreateOpen} />

      {/* MEMBROS */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-end justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-[#1E293B]">
              Membros / quadros por responsável
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Selecione um membro para visualizar e gerenciar seus quadros.
            </p>
          </div>
        </div>
        <div className="relative">
          {loadingMembers ? (
            <div className="flex gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-[110px] w-[210px] rounded-2xl shrink-0" />
              ))}
            </div>
          ) : (
            <>
              <div
                ref={setMemberScrollRef}
                className="flex gap-3 overflow-x-auto scroll-smooth pb-1 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {members.map((m, i) => {
                  const p = paletteFor(i);
                  const isActive = m.user_id === selectedMember;
                  return (
                    <button
                      key={m.user_id}
                      onClick={() => setSelectedMember(m.user_id)}
                      className={cn(
                        "group relative shrink-0 w-[210px] rounded-2xl border text-left p-4 transition-all duration-200",
                        p.bg,
                        isActive
                          ? cn("ring-2 ring-offset-2 shadow-md -translate-y-0.5", p.ring)
                          : "border-transparent hover:-translate-y-0.5 hover:shadow-md",
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 ring-2 ring-white shadow-sm">
                          <AvatarFallback
                            className={cn("text-white font-semibold text-xs", p.avatar)}
                          >
                            {initials(m.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="font-semibold text-sm text-[#1E293B] truncate">
                            {m.full_name}
                          </div>
                          <div className="text-[11px] text-slate-600 truncate">
                            {m.role ? ROLE_LABEL[m.role] : "Membro"}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-white/60 text-center">
                        <span className={cn("text-sm font-semibold", p.text)}>{m.total}</span>
                        <span className="text-xs text-slate-600 ml-1">
                          {m.total === 1 ? "processo" : "processos"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
              {members.length > 4 && (
                <>
                  <button
                    onClick={() => scrollMembers(-1)}
                    className="absolute -left-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-white border border-slate-200 shadow-md hover:shadow-lg flex items-center justify-center text-slate-600 hover:text-[#1E293B] transition-all"
                    aria-label="Anterior"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => scrollMembers(1)}
                    className="absolute -right-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-white border border-slate-200 shadow-md hover:shadow-lg flex items-center justify-center text-slate-600 hover:text-[#1E293B] transition-all"
                    aria-label="Próximo"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </section>

      {/* QUADRO DO MEMBRO */}
      {activeMember && (
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 p-5 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  const idx = members.findIndex((m) => m.user_id === selectedMember);
                  if (idx > 0) setSelectedMember(members[idx - 1].user_id);
                }}
                className="h-9 w-9 rounded-full bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 transition-all"
                aria-label="Membro anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <Avatar className="h-12 w-12 ring-2 ring-white shadow-sm">
                <AvatarFallback className={cn("text-white font-semibold", activePalette.avatar)}>
                  {initials(activeMember.full_name)}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="text-[11px] text-slate-500 uppercase tracking-wide">Quadro de</div>
                <div className="text-xl font-bold text-[#1E293B] leading-tight">
                  {activeMember.full_name}
                </div>
                <div className="text-xs text-slate-500">
                  {activeMember.role ? ROLE_LABEL[activeMember.role] : "Membro"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-9 rounded-lg gap-2 border-slate-200">
                <Layers className="h-3.5 w-3.5" />
                Visão Kanban
              </Button>
              <Button variant="outline" size="sm" className="h-9 rounded-lg gap-2 border-slate-200">
                <Filter className="h-3.5 w-3.5" />
                Filtros
              </Button>
            </div>
          </div>

          {/* KANBAN */}
          <div className="p-5">
            <div className="flex gap-4 overflow-x-auto pb-3 items-start">
              {loadingColumns && memberColumns.length === 0
                ? Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-[360px] w-[280px] rounded-2xl shrink-0" />
                  ))
                : memberColumns.map((col, idx) => (
                    <KanbanColumn
                      key={col.id}
                      column={col}
                      isFirst={idx === 0}
                      isLast={idx === memberColumns.length - 1}
                      canDelete={memberColumns.length > 1}
                      cards={cardsByColumn[col.key] ?? []}
                      loading={loadingCards}
                      onDropCard={(cardId) => {
                        const c = cards.find((x) => x.id === cardId);
                        moveCard.mutate({
                          cardId,
                          toColumn: col.key,
                          fromColumn: c?.column_key ?? col.key,
                        });
                      }}
                      onCardClick={(c) => setOpenCard(c)}
                      onRename={(title) => updateColumn.mutate({ id: col.id, patch: { title } })}
                      onChangeColor={(color) =>
                        updateColumn.mutate({ id: col.id, patch: { color } })
                      }
                      onMove={(dir) => moveColumn.mutate({ id: col.id, direction: dir })}
                      onDelete={() => deleteColumn.mutate({ col })}
                      onAddCard={(title) => addCard.mutate({ title, columnKey: col.key })}
                      assigneePalette={activePalette}
                      highlightCardId={highlightCardId}
                    />
                  ))}
              <AddColumnButton onAdd={(title, color) => addColumn.mutate({ title, color })} />
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-slate-500 bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
              <AlertCircle className="h-4 w-4 text-slate-400" />
              Dica: arraste os processos entre as etapas para atualizar o andamento.
            </div>
          </div>
        </section>
      )}

      {/* CARD DRAWER */}
      <CardDrawer
        card={openCard}
        onOpenChange={(o) => !o && setOpenCard(null)}
        companyId={companyId}
        userId={user?.id ?? null}
        members={drawerMembers}
        columns={drawerColumns}
      />
    </div>
  );
}
