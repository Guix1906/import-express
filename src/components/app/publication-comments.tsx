import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";

type Comment = {
  id: string;
  author_id: string;
  content: string;
  created_at: string;
};

export function PublicationComments({
  publicationId,
  companyId,
  members,
}: {
  publicationId: string;
  companyId: string;
  members: Map<string, string>;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState("");

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ["publication-comments", publicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("publication_comments")
        .select("id, author_id, content, created_at")
        .eq("publication_id", publicationId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Comment[];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`pub-comments-${publicationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "publication_comments",
          filter: `publication_id=eq.${publicationId}`,
        },
        () => qc.invalidateQueries({ queryKey: ["publication-comments", publicationId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [publicationId, qc]);

  const addMut = useMutation({
    mutationFn: async () => {
      const trimmed = text.trim();
      if (!trimmed) throw new Error("Mensagem vazia");
      if (!user) throw new Error("Sem usuário");
      const { error } = await supabase.from("publication_comments").insert({
        company_id: companyId,
        publication_id: publicationId,
        author_id: user.id,
        content: trimmed.slice(0, 2000),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["publication-comments", publicationId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("publication_comments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["publication-comments", publicationId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mt-5 rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold">Comentários internos</p>
        <span className="text-xs text-muted-foreground">({comments.length})</span>
      </div>

      {isLoading ? (
        <div className="space-y-2 mb-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : comments.length === 0 ? (
        <p className="text-xs text-muted-foreground mb-3">
          Nenhum comentário ainda. Use este espaço para alinhar com a equipe.
        </p>
      ) : (
        <ul className="space-y-2 mb-3 max-h-64 overflow-y-auto pr-1">
          {comments.map((c) => {
            const author = members.get(c.author_id) ?? "Membro";
            const isMine = c.author_id === user?.id;
            return (
              <li key={c.id} className="rounded-md border bg-muted/30 p-2.5 text-sm">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-xs font-medium">
                    {author}
                    <span className="ml-2 text-muted-foreground font-normal">
                      {new Date(c.created_at).toLocaleString("pt-BR")}
                    </span>
                  </p>
                  {isMine && (
                    <button
                      type="button"
                      onClick={() => delMut.mutate(c.id)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Excluir"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <p className="whitespace-pre-wrap leading-relaxed">{c.content}</p>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex gap-2 items-end">
        <Textarea
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escreva um comentário para a equipe..."
          className="text-sm"
          maxLength={2000}
        />
        <Button
          size="sm"
          onClick={() => addMut.mutate()}
          disabled={addMut.isPending || !text.trim()}
        >
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
