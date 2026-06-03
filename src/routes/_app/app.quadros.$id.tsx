import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/use-active-company";
import { PageHeader } from "@/components/app/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/app/quadros/$id")({
  component: CustomBoardPage,
});

function CustomBoardPage() {
  const { id } = Route.useParams();
  const { companyId } = useActiveCompany();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: board, isLoading: loadingBoard } = useQuery({
    queryKey: ["board", id],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase.from("boards").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: columns = [], isLoading: loadingCols } = useQuery({
    queryKey: ["board-columns", id],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("board_columns")
        .select("*")
        .eq("board_id", id)
        .order("position");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: cards = [] } = useQuery({
    queryKey: ["board-cards", id],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_cards")
        .select(
          "id, title, description, priority, due_date, column_key, board_id, assignee_id, client_name_snapshot",
        )
        .eq("board_id", id)
        .order("position");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Realtime
  useEffect(() => {
    if (!companyId) return;
    const ch = supabase
      .channel(`board-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "production_cards", filter: `board_id=eq.${id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["board-cards", id] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "board_columns", filter: `board_id=eq.${id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["board-columns", id] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [id, companyId, qc]);

  const deleteBoard = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("boards").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Quadro excluído");
      qc.invalidateQueries({ queryKey: ["meu-quadro-boards"] });
      navigate({ to: "/app/meu-quadro", search: { card_id: undefined } });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Falha ao excluir"),
  });

  if (loadingBoard) return <Skeleton className="h-64 w-full" />;
  if (!board) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        Quadro não encontrado.
        <div className="mt-4">
          <Button asChild variant="outline">
            <Link to="/app/meu-quadro" search={{ card_id: undefined }}>
              Voltar
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const gradient = board.gradient ?? "from-blue-600 via-indigo-600 to-sky-600";

  return (
    <div className="space-y-6">
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl p-6 text-white bg-gradient-to-br shadow-xl",
          gradient,
        )}
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/20" />
        <div className="relative flex items-start justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/20 -ml-2"
            >
              <Link to="/app/meu-quadro" search={{ card_id: undefined }}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Quadros
              </Link>
            </Button>
            <div className="h-14 w-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-3xl shrink-0">
              {board.icon ?? "📋"}
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold truncate">{board.name}</h1>
              <p className="text-sm text-white/85 truncate">
                {board.role_label ?? board.board_type}
                {board.description && ` · ${board.description}`}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-red-500/30"
            onClick={() => {
              if (confirm("Excluir este quadro? Os cartões ficarão sem quadro."))
                deleteBoard.mutate();
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loadingCols ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map((col) => {
            const colCards = cards.filter((c) => c.column_key === col.key);
            return (
              <div
                key={col.id}
                className="min-w-[300px] w-[300px] rounded-2xl bg-muted/40 border p-3 flex flex-col"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="font-semibold text-sm">{col.title}</div>
                  <Badge variant="secondary" className="h-5 text-xs">
                    {colCards.length}
                  </Badge>
                </div>
                <QuickAdd boardId={id} columnKey={col.key} companyId={companyId} />
                <div className="space-y-2 mt-3 flex-1">
                  {colCards.map((card) => (
                    <div
                      key={card.id}
                      className="rounded-lg bg-background border p-3 text-sm shadow-sm hover:shadow-md transition"
                    >
                      <div className="font-medium">{card.title}</div>
                      {card.client_name_snapshot && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {card.client_name_snapshot}
                        </div>
                      )}
                    </div>
                  ))}
                  {colCards.length === 0 && (
                    <div className="text-xs text-muted-foreground text-center py-6">
                      Nenhum cartão
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function QuickAdd({
  boardId,
  columnKey,
  companyId,
}: {
  boardId: string;
  columnKey: string;
  companyId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const qc = useQueryClient();

  const add = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("Sem empresa ativa");
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) throw new Error("Sessão inválida");
      const { error } = await supabase.from("production_cards").insert({
        company_id: companyId,
        board_id: boardId,
        column_key: columnKey,
        assignee_id: uid,
        created_by: uid,
        title: title.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setTitle("");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["board-cards", boardId] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Falha"),
  });

  if (!open) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start"
        onClick={() => setOpen(true)}
      >
        <Plus className="h-4 w-4 mr-1" /> Adicionar cartão
      </Button>
    );
  }
  return (
    <div className="space-y-2">
      <Input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Título do cartão"
        onKeyDown={(e) => {
          if (e.key === "Enter" && title.trim()) add.mutate();
          if (e.key === "Escape") setOpen(false);
        }}
      />
      <div className="flex gap-1">
        <Button size="sm" onClick={() => title.trim() && add.mutate()} disabled={add.isPending}>
          Adicionar
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
