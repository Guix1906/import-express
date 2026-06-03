import { confirmDialog } from "@/components/app/confirm-dialog";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import type { CardDocument } from "./types";

export function CardDocuments({
  cardId,
  companyId,
  userId,
}: {
  cardId: string;
  companyId: string | null;
  userId: string;
}) {
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["card-documents", cardId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("card_id", cardId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as CardDocument[];
    },
  });

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !companyId) return;
    setUploading(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${companyId}/cards/${cardId}/${Date.now()}-${safeName}`;
      const up = await supabase.storage.from("documents").upload(path, file, {
        contentType: file.type || undefined,
      });
      if (up.error) throw up.error;
      const { error } = await supabase.from("documents").insert({
        company_id: companyId,
        uploaded_by: userId,
        card_id: cardId,
        name: file.name,
        storage_path: path,
        mime_type: file.type || null,
        size_bytes: file.size,
      });
      if (error) throw error;
      toast.success("Arquivo enviado");
      qc.invalidateQueries({ queryKey: ["card-documents", cardId] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha no upload";
      toast.error(msg);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function openDoc(path: string) {
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(path, 60);
    if (error || !data) {
      toast.error("Não foi possível abrir o arquivo");
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  async function deleteDoc(id: string, path: string) {
    if (
      !(await confirmDialog({
        title: "Excluir documento",
        description: "Deseja realmente excluir este documento do cartão?",
        confirmText: "Excluir",
      }))
    )
      return;
    await supabase.storage.from("documents").remove([path]);
    const { error } = await supabase.from("documents").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao remover");
      return;
    }
    qc.invalidateQueries({ queryKey: ["card-documents", cardId] });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {docs.length} {docs.length === 1 ? "arquivo anexado" : "arquivos anexados"}
        </p>
        <label className="inline-flex">
          <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors",
              uploading ? "opacity-60 cursor-not-allowed" : "hover:bg-accent",
            )}
          >
            <Plus className="h-3.5 w-3.5" />
            {uploading ? "Enviando..." : "Anexar arquivo"}
          </span>
        </label>
      </div>
      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-6">Carregando...</p>
      ) : docs.length === 0 ? (
        <div className="border border-dashed rounded-lg py-10 text-center text-sm text-muted-foreground">
          <FileText className="h-6 w-6 mx-auto opacity-40 mb-2" />
          Nenhum documento anexado a este cartão.
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map((d) => (
            <div
              key={d.id}
              className="flex items-center gap-3 rounded-lg border p-2.5 hover:bg-accent/30 transition-colors group"
            >
              <div className="h-9 w-9 rounded-md bg-primary/10 text-primary grid place-items-center shrink-0">
                <FileText className="h-4 w-4" />
              </div>
              <button onClick={() => openDoc(d.storage_path)} className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium truncate">{d.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {d.size_bytes ? `${(Number(d.size_bytes) / 1024).toFixed(1)} KB · ` : ""}
                  {formatDistanceToNow(new Date(d.created_at), { addSuffix: true, locale: ptBR })}
                </p>
              </button>
              <button
                onClick={() => deleteDoc(d.id, d.storage_path)}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-rose-500 transition-opacity"
                title="Remover"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
