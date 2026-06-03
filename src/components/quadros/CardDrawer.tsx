import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { confirmDialog } from "@/components/app/confirm-dialog";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  Search,
  Upload,
  Download,
  Eye,
  Trash2,
  FileText,
  Loader2,
  X,
  User,
  Check,
} from "lucide-react";

export type QuadroCard = {
  id: string;
  title: string;
  client_id: string | null;
  client_name_snapshot: string | null;
  priority: string;
  operational_status: string;
  column_key: string;
  due_date: string | null;
  assignee_id: string;
  practice_area: string | null;
  process_number: string | null;
  description: string | null;
  observations: string | null;
  category?: string | null;
  created_at: string;
};

export type MemberOption = { user_id: string; full_name: string };
export type ColumnOption = { key: string; title: string };

type Props = {
  card: QuadroCard | null;
  onOpenChange: (o: boolean) => void;
  companyId: string | null;
  userId: string | null;
  members: MemberOption[];
  columns: ColumnOption[];
};

const PRIORITIES = [
  { v: "baixa", label: "Baixa" },
  { v: "media", label: "Média" },
  { v: "alta", label: "Alta" },
  { v: "urgente", label: "Urgente" },
];

const CATEGORIES = [
  "Declaração de hipossuficiência",
  "Manifestação",
  "Recurso",
  "Contrato",
  "Petição",
  "Procuração",
  "Comprovante",
  "Decisão",
  "Documento pessoal",
  "Outro",
];

export function CardDrawer({ card, onOpenChange, companyId, userId, members, columns }: Props) {
  return (
    <Sheet open={!!card} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto p-0">
        {card && (
          <CardDrawerBody
            card={card}
            onClose={() => onOpenChange(false)}
            companyId={companyId}
            userId={userId}
            members={members}
            columns={columns}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function CardDrawerBody({
  card,
  onClose,
  companyId,
  userId,
  members,
  columns,
}: {
  card: QuadroCard;
  onClose: () => void;
  companyId: string | null;
  userId: string | null;
  members: MemberOption[];
  columns: ColumnOption[];
}) {
  const qc = useQueryClient();

  // Always fetch fresh card data on open so the drawer never shows a stale snapshot
  const { data: freshCard } = useQuery({
    queryKey: ["card-detail", card.id],
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_cards")
        .select(
          "id,title,client_id,client_name_snapshot,priority,operational_status,column_key,due_date,assignee_id,practice_area,process_number,description,observations,category,created_at",
        )
        .eq("id", card.id)
        .maybeSingle();
      if (error) throw error;
      return data as QuadroCard | null;
    },
  });

  const effective = freshCard ?? card;

  const [form, setForm] = useState({
    title: effective.title,
    client_id: effective.client_id,
    client_name_snapshot: effective.client_name_snapshot,
    description: effective.description ?? "",
    observations: effective.observations ?? "",
    priority: effective.priority,
    assignee_id: effective.assignee_id,
    column_key: effective.column_key,
    category: effective.category ?? "",
    due_date: effective.due_date ? effective.due_date.slice(0, 10) : "",
  });

  // Re-sync form when fresh data arrives or card changes
  useEffect(() => {
    setForm({
      title: effective.title,
      client_id: effective.client_id,
      client_name_snapshot: effective.client_name_snapshot,
      description: effective.description ?? "",
      observations: effective.observations ?? "",
      priority: effective.priority,
      assignee_id: effective.assignee_id,
      column_key: effective.column_key,
      category: effective.category ?? "",
      due_date: effective.due_date ? effective.due_date.slice(0, 10) : "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id, freshCard]);

  const dirty = useMemo(() => {
    return (
      form.title !== effective.title ||
      form.client_id !== effective.client_id ||
      form.description !== (effective.description ?? "") ||
      form.observations !== (effective.observations ?? "") ||
      form.priority !== effective.priority ||
      form.assignee_id !== effective.assignee_id ||
      form.column_key !== effective.column_key ||
      form.category !== (effective.category ?? "") ||
      (form.due_date || "") !== (effective.due_date ? effective.due_date.slice(0, 10) : "")
    );
  }, [form, effective]);

  const save = useMutation({
    mutationFn: async () => {
      const patch: any = {
        title: form.title.trim(),
        client_id: form.client_id,
        client_name_snapshot: form.client_name_snapshot,
        description: form.description || null,
        observations: form.observations || null,
        priority: form.priority,
        assignee_id: form.assignee_id,
        column_key: form.column_key,
        category: form.category || null,
        due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
      };
      const { error } = await supabase.from("production_cards").update(patch).eq("id", card.id);
      if (error) throw error;
      // log event
      if (companyId && userId) {
        await supabase.from("production_card_events").insert({
          company_id: companyId,
          card_id: card.id,
          actor_id: userId,
          event_type: "card_updated",
          payload: { fields: Object.keys(patch) },
        });
      }
    },
    onSuccess: () => {
      toast.success("Cartão atualizado");
      qc.invalidateQueries({ queryKey: ["quadros-cards"] });
      qc.invalidateQueries({ queryKey: ["card-detail", card.id] });
      qc.invalidateQueries({ queryKey: ["card-events", card.id] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("production_cards").delete().eq("id", card.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cartão excluído");
      qc.invalidateQueries({ queryKey: ["quadros-cards"] });
      qc.invalidateQueries({ queryKey: ["quadros-members"] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao excluir"),
  });

  const handleDelete = async () => {
    const ok = await confirmDialog({
      title: "Excluir cartão",
      description: "Esta ação não pode ser desfeita.",
      confirmText: "Excluir",
    });
    if (ok) del.mutate();
  };

  return (
    <div className="flex flex-col h-full">
      <SheetHeader className="px-6 pt-6 pb-4 border-b">
        <SheetTitle className="text-xl text-[#1E293B]">{card.title}</SheetTitle>
        <SheetDescription>{form.client_name_snapshot ?? "Sem cliente vinculado"}</SheetDescription>
      </SheetHeader>

      <Tabs defaultValue="info" className="flex-1 flex flex-col">
        <TabsList className="mx-6 mt-4 grid w-[calc(100%-3rem)] grid-cols-3">
          <TabsTrigger value="info">Informações</TabsTrigger>
          <TabsTrigger value="docs">Documentos</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="flex-1 px-6 py-5 space-y-4">
          <div className="space-y-2">
            <Label>Título</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>

          <ClientPicker
            companyId={companyId}
            clientId={form.client_id}
            clientName={form.client_name_snapshot}
            onSelect={(c) =>
              setForm((f) => ({
                ...f,
                client_id: c?.id ?? null,
                client_name_snapshot: c?.name ?? null,
              }))
            }
          />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select
                value={form.priority}
                onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.v} value={p.v}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Coluna / Status</Label>
              <Select
                value={form.column_key}
                onValueChange={(v) => setForm((f) => ({ ...f, column_key: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {columns.map((c) => (
                    <SelectItem key={c.key} value={c.key}>
                      {c.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Responsável</Label>
              <Select
                value={form.assignee_id}
                onValueChange={(v) => setForm((f) => ({ ...f, assignee_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {m.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Prazo</Label>
              <Input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Categoria</Label>
              <Select
                value={form.category || "__none__"}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, category: v === "__none__" ? "" : v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar categoria…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem categoria</SelectItem>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              rows={3}
              value={form.observations}
              onChange={(e) => setForm((f) => ({ ...f, observations: e.target.value }))}
            />
          </div>

          <div className="text-xs text-slate-400 pt-2">
            Criado em {format(new Date(card.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </div>
        </TabsContent>

        <TabsContent value="docs" className="flex-1 px-6 py-5">
          <ClientDocuments
            companyId={companyId}
            userId={userId}
            clientId={form.client_id}
            cardId={card.id}
          />
        </TabsContent>

        <TabsContent value="history" className="flex-1 px-6 py-5">
          <CardHistory cardId={card.id} />
        </TabsContent>
      </Tabs>

      <div className="border-t bg-white px-6 py-4 flex items-center justify-between gap-2">
        <Button
          variant="outline"
          onClick={handleDelete}
          className="text-rose-600 border-rose-200 hover:bg-rose-50"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Excluir
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => save.mutate()}
            disabled={!dirty || save.isPending}
            className="bg-[#1E293B] hover:bg-[#1E293B]/90 text-white"
          >
            {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar alterações
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Client picker (autocomplete) ---------------- */

function ClientPicker({
  companyId,
  clientId,
  clientName,
  onSelect,
}: {
  companyId: string | null;
  clientId: string | null;
  clientName: string | null;
  onSelect: (c: { id: string; name: string } | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const { data: allClients = [], isLoading } = useQuery({
    queryKey: ["company-clients", companyId],
    enabled: !!companyId && open,
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .eq("company_id", companyId!)
        .order("name", { ascending: true })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return allClients;
    return allClients.filter((c) => c.name.toLowerCase().includes(term));
  }, [allClients, q]);

  return (
    <div className="space-y-2">
      <Label>Cliente vinculado</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="w-full flex items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent/30 transition"
          >
            <span className="flex items-center gap-2 truncate">
              <User className="h-4 w-4 text-slate-400" />
              {clientName ?? <span className="text-slate-400">Selecionar cliente…</span>}
            </span>
            {clientId && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.stopPropagation();
                    onSelect(null);
                  }
                }}
                className="text-slate-400 hover:text-rose-600 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-2" align="start">
          <div className="relative mb-2">
            <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              autoFocus
              placeholder="Buscar cliente..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-7 h-8 text-sm"
            />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {isLoading ? (
              <div className="px-3 py-4 text-center text-xs text-slate-400">
                Carregando clientes…
              </div>
            ) : results.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-slate-400">
                {q.trim()
                  ? "Nenhum cliente encontrado para esta busca."
                  : "Nenhum cliente cadastrado."}
              </div>
            ) : (
              <>
                <div className="px-2 py-1 text-[10px] text-slate-400 uppercase tracking-wide">
                  {results.length} {results.length === 1 ? "cliente" : "clientes"}
                </div>
                {results.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      onSelect(c);
                      setOpen(false);
                      setQ("");
                    }}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-accent text-left rounded-md"
                  >
                    <span className="truncate">{c.name}</span>
                    {c.id === clientId && <Check className="h-3.5 w-3.5 text-indigo-600" />}
                  </button>
                ))}
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

/* ---------------- Client documents tab ---------------- */

type DocRow = {
  id: string;
  name: string;
  category: string | null;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
};

function ClientDocuments({
  companyId,
  userId,
  clientId,
  cardId,
}: {
  companyId: string | null;
  userId: string | null;
  clientId: string | null;
  cardId: string;
}) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [downloadingAll, setDownloadingAll] = useState(false);

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["card-documents", cardId, clientId],
    enabled: !!cardId,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      let q = supabase
        .from("documents")
        .select("id, name, category, storage_path, mime_type, size_bytes, created_at")
        .order("created_at", { ascending: false });
      if (clientId) {
        q = q.or(`card_id.eq.${cardId},client_id.eq.${clientId}`);
      } else {
        q = q.eq("card_id", cardId);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as DocRow[];
    },
  });

  if (!clientId) {
    return (
      <div className="border border-dashed rounded-xl py-12 text-center">
        <FileText className="h-8 w-8 mx-auto opacity-30 mb-3" />
        <p className="text-sm font-medium text-slate-700">
          Vincule um cliente ao cartão antes de adicionar documentos.
        </p>
        <p className="text-xs text-slate-500 mt-1">
          Vá até a aba “Informações” e selecione o cliente.
        </p>
      </div>
    );
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length || !companyId || !userId || !clientId) return;
    setUploading(true);
    try {
      const uploadedDocs: any[] = [];
      const events: any[] = [];

      await Promise.all(
        files.map(async (file) => {
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
          const path = `${companyId}/clients/${clientId}/${Date.now()}-${safeName}`;
          const up = await supabase.storage.from("documents").upload(path, file, {
            contentType: file.type || undefined,
          });
          if (up.error) throw up.error;
          uploadedDocs.push({
            company_id: companyId,
            uploaded_by: userId,
            client_id: clientId,
            card_id: cardId,
            name: file.name,
            storage_path: path,
            mime_type: file.type || null,
            size_bytes: file.size,
            scope: "cliente",
          });
          events.push({
            company_id: companyId,
            card_id: cardId,
            actor_id: userId,
            event_type: "document_uploaded",
            payload: { name: file.name },
          });
        }),
      );

      if (uploadedDocs.length) {
        const { error } = await supabase.from("documents").insert(uploadedDocs);
        if (error) throw error;
      }
      if (events.length) {
        await supabase.from("production_card_events").insert(events);
      }

      toast.success(
        `${uploadedDocs.length} documento${uploadedDocs.length > 1 ? "s" : ""} enviado${uploadedDocs.length > 1 ? "s" : ""}`,
      );
      qc.invalidateQueries({ queryKey: ["card-documents", cardId, clientId] });
      qc.invalidateQueries({ queryKey: ["card-events", cardId] });
    } catch (err: any) {
      toast.error(err.message ?? "Falha no upload");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function openSigned(d: DocRow, mode: "view" | "download") {
    const { data, error } = await supabase.storage
      .from("documents")
      .createSignedUrl(
        d.storage_path,
        60 * 5,
        mode === "download" ? { download: d.name } : undefined,
      );
    if (error || !data) {
      toast.error("Não foi possível acessar o arquivo");
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  async function deleteDoc(d: DocRow) {
    const ok = await confirmDialog({
      title: "Excluir documento",
      description: `Excluir “${d.name}”?`,
      confirmText: "Excluir",
    });
    if (!ok) return;
    await supabase.storage.from("documents").remove([d.storage_path]);
    const { error } = await supabase.from("documents").delete().eq("id", d.id);
    if (error) {
      toast.error("Falha ao excluir");
      return;
    }
    toast.success("Documento removido");
    qc.invalidateQueries({ queryKey: ["card-documents", cardId, clientId] });
  }

  async function downloadAll() {
    if (!docs.length) return;
    setDownloadingAll(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const used = new Set<string>();
      const results = await Promise.all(
        docs.map(async (d) => {
          const { data, error } = await supabase.storage
            .from("documents")
            .createSignedUrl(d.storage_path, 60 * 10);
          if (error || !data) return { d, blob: null as Blob | null };
          const res = await fetch(data.signedUrl);
          if (!res.ok) return { d, blob: null };
          return { d, blob: await res.blob() };
        }),
      );
      let added = 0;
      for (const { d, blob } of results) {
        if (!blob) continue;
        let name = d.name || "documento";
        if (used.has(name)) {
          const dot = name.lastIndexOf(".");
          const base = dot > 0 ? name.slice(0, dot) : name;
          const ext = dot > 0 ? name.slice(dot) : "";
          let i = 2;
          while (used.has(`${base} (${i})${ext}`)) i++;
          name = `${base} (${i})${ext}`;
        }
        used.add(name);
        zip.file(name, blob);
        added++;
      }
      if (!added) {
        toast.error("Não foi possível baixar os documentos");
        return;
      }
      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = `documentos-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`${added} documento${added === 1 ? "" : "s"} baixado${added === 1 ? "" : "s"}`);
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao baixar documentos");
    } finally {
      setDownloadingAll(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {docs.length} {docs.length === 1 ? "documento" : "documentos"} vinculado
          {docs.length === 1 ? "" : "s"} ao cliente
        </p>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={downloadAll}
            disabled={downloadingAll || docs.length === 0}
          >
            {downloadingAll ? (
              <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5 mr-2" />
            )}
            Baixar todos
          </Button>
          <Button
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="bg-[#1E293B] hover:bg-[#1E293B]/90 text-white"
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5 mr-2" />
            )}
            Adicionar documentos
          </Button>
        </div>
        <input ref={fileRef} type="file" multiple className="hidden" onChange={handleUpload} />
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-400 text-center py-8">Carregando…</p>
      ) : docs.length === 0 ? (
        <div className="border border-dashed rounded-xl py-12 text-center text-sm text-slate-500">
          <FileText className="h-8 w-8 mx-auto opacity-30 mb-3" />
          Nenhum documento vinculado a este cliente.
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map((d) => (
            <div
              key={d.id}
              className="flex items-center gap-3 rounded-lg border bg-white p-3 hover:bg-slate-50 transition group"
            >
              <div className="h-10 w-10 rounded-md bg-indigo-50 text-indigo-600 grid place-items-center shrink-0">
                <FileText className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{d.name}</p>
                <p className="text-[11px] text-slate-500 flex items-center gap-2">
                  {d.category && <span className="capitalize">{d.category}</span>}
                  {d.size_bytes ? <span>{(Number(d.size_bytes) / 1024).toFixed(1)} KB</span> : null}
                  <span>{format(new Date(d.created_at), "dd/MM/yyyy")}</span>
                </p>
              </div>
              <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition">
                <button
                  onClick={() => openSigned(d, "view")}
                  className="h-8 w-8 rounded-md hover:bg-slate-100 grid place-items-center text-slate-600"
                  title="Visualizar"
                >
                  <Eye className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => openSigned(d, "download")}
                  className="h-8 w-8 rounded-md hover:bg-slate-100 grid place-items-center text-slate-600"
                  title="Baixar"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => deleteDoc(d)}
                  className="h-8 w-8 rounded-md hover:bg-rose-50 grid place-items-center text-slate-500 hover:text-rose-600"
                  title="Excluir"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- History tab ---------------- */

function CardHistory({ cardId }: { cardId: string }) {
  const { data: events = [], isLoading } = useQuery({
    queryKey: ["card-events", cardId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_card_events")
        .select("id, event_type, payload, created_at, actor_id")
        .eq("card_id", cardId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const labelFor = (t: string) => {
    switch (t) {
      case "card_updated":
        return "Cartão editado";
      case "card_moved":
        return "Cartão movido";
      case "document_uploaded":
        return "Documento enviado";
      case "client_linked":
        return "Cliente vinculado";
      default:
        return t;
    }
  };

  if (isLoading) return <p className="text-sm text-slate-400 text-center py-8">Carregando…</p>;
  if (events.length === 0) {
    return (
      <div className="border border-dashed rounded-xl py-12 text-center text-sm text-slate-500">
        Sem eventos registrados ainda.
      </div>
    );
  }

  return (
    <ol className="relative border-l border-slate-200 pl-4 space-y-4">
      {events.map((e: any) => (
        <li key={e.id} className="relative">
          <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-indigo-500 ring-2 ring-white" />
          <div className="text-sm font-medium text-slate-800">{labelFor(e.event_type)}</div>
          <div className="text-[11px] text-slate-500">
            {format(new Date(e.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </div>
          {e.payload && Object.keys(e.payload).length > 0 && (
            <div className="text-[11px] text-slate-500 mt-0.5 truncate">
              {Object.entries(e.payload)
                .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
                .join(" · ")}
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}
