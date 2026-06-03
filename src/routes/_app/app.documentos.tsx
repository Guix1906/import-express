import { confirmDialog } from "@/components/app/confirm-dialog";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  createDocumentRecordAdmin,
  createDocumentSignedUrlAdmin,
  deleteDocumentAdmin,
  listClientsAdmin,
  listDocumentsAdmin,
} from "@/lib/core-persistence.functions";
import { useAuth } from "@/hooks/use-auth";
import { useActiveCompany } from "@/hooks/use-active-company";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Upload,
  Download,
  Trash2,
  FileText,
  Loader2,
  FileImage,
  FileSpreadsheet,
  File as FileIcon,
  Check,
  ChevronsUpDown,
  Eye,
  Search,
  User,
} from "lucide-react";

export const Route = createFileRoute("/_app/app/documentos")({
  component: DocumentosPage,
});

const CATEGORIES = [
  "Contrato",
  "Petição",
  "Procuração",
  "Comprovante",
  "Decisão",
  "Documento pessoal",
  "Outro",
] as const;

type DocRow = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  scope: string | null;
  subcategory: string | null;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  client_id: string | null;
  uploaded_by: string;
  created_at: string;
};

type ClientLite = { id: string; name: string };

function formatBytes(b: number | null) {
  if (!b) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}

function iconFor(mime: string | null) {
  if (!mime) return FileIcon;
  if (mime.startsWith("image/")) return FileImage;
  if (mime.includes("sheet") || mime.includes("excel") || mime.includes("csv"))
    return FileSpreadsheet;
  if (mime.includes("pdf") || mime.startsWith("text/")) return FileText;
  return FileIcon;
}

function DocumentosPage() {
  const { user } = useAuth();
  const { companyId, isLoading: loadingCompany } = useActiveCompany();
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const listDocumentsFn = useServerFn(listDocumentsAdmin);
  const listClientsFn = useServerFn(listClientsAdmin);
  const createDocumentRecordFn = useServerFn(createDocumentRecordAdmin);
  const deleteDocumentFn = useServerFn(deleteDocumentAdmin);
  const createDocumentSignedUrlFn = useServerFn(createDocumentSignedUrlAdmin);

  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [scopeFilter, setScopeFilter] = useState<"all" | "cliente" | "processo" | "financeiro">(
    "all",
  );
  const [searchDraft, setSearchDraft] = useState("");
  const [clientDraft, setClientDraft] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    category: "Contrato",
    scope: "cliente" as "cliente" | "processo" | "financeiro",
    subcategory: "",
    client_id: "none",
    file: null as File | null,
  });

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["documents", companyId],
    enabled: !!companyId,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<DocRow[]> => {
      return (await listDocumentsFn({ data: { companyId: companyId! } })) as DocRow[];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients", companyId, "lite"],
    enabled: !!companyId,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<ClientLite[]> => {
      return (await listClientsFn({ data: { companyId: companyId! } })) as ClientLite[];
    },
  });

  const clientNameById = useMemo(() => {
    const m = new Map<string, string>();
    clients.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [clients]);

  const norm = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

  const filtered = useMemo(() => {
    const q = norm(search.trim());
    return docs
      .map((d, i) => ({ d, num: docs.length - i }))
      .filter(({ d, num }) => {
        if (clientFilter !== "all" && d.client_id !== clientFilter) return false;
        if (scopeFilter !== "all" && (d.scope ?? "cliente") !== scopeFilter) return false;
        if (!q) return true;
        return (
          norm(d.name).includes(q) ||
          norm(d.description ?? "").includes(q) ||
          String(num) === q.replace(/^#/, "")
        );
      })
      .map(({ d }) => d);
  }, [docs, search, clientFilter, scopeFilter]);

  const upload = useMutation({
    mutationFn: async () => {
      if (!companyId || !user) throw new Error("Sessão inválida");
      if (!form.file) throw new Error("Selecione um arquivo");
      const file = form.file;
      const safeName = file.name.replace(/[^\w.-]+/g, "_");
      const path = `${companyId}/${crypto.randomUUID()}-${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("documents")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;

      try {
        await createDocumentRecordFn({
          data: {
            companyId,
            client_id: form.client_id === "none" ? null : form.client_id,
            name: form.name.trim() || file.name,
            description: form.description.trim() || null,
            category: form.category,
            scope: form.scope,
            subcategory: form.subcategory.trim() || null,
            storage_path: path,
            mime_type: file.type || null,
            size_bytes: file.size,
          },
        });
      } catch (insErr) {
        await supabase.storage.from("documents").remove([path]);
        throw insErr;
      }
    },
    onSuccess: () => {
      toast.success("Documento salvo com sucesso");
      setDialogOpen(false);
      setForm({
        name: "",
        description: "",
        category: "Contrato",
        scope: "cliente",
        subcategory: "",
        client_id: "none",
        file: null,
      });
      if (fileInput.current) fileInput.current.value = "";
      qc.invalidateQueries({ queryKey: ["documents", companyId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao enviar"),
  });

  const remove = useMutation({
    mutationFn: async (doc: DocRow) => {
      if (!companyId) throw new Error("Empresa nao selecionada");
      await deleteDocumentFn({ data: { companyId, id: doc.id, storage_path: doc.storage_path } });
    },
    onSuccess: () => {
      toast.success("Documento excluído");
      qc.invalidateQueries({ queryKey: ["documents", companyId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao remover"),
  });

  async function downloadDoc(doc: DocRow) {
    const { data, error } = await supabase.storage
      .from("documents")
      .createSignedUrl(doc.storage_path, 60);
    if (error || !data?.signedUrl) {
      toast.error("Não foi possível gerar link");
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  async function openDocument(doc: DocRow) {
    if (!companyId) return;
    const data = await createDocumentSignedUrlFn({
      data: { companyId, storage_path: doc.storage_path },
    }).catch((error: Error) => {
      toast.error("Nao foi possivel gerar link", { description: error.message });
      return null;
    });
    if (!data?.signedUrl) {
      toast.error("Nao foi possivel gerar link");
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  const totalSize = useMemo(() => docs.reduce((acc, d) => acc + (d.size_bytes ?? 0), 0), [docs]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documentos"
        subtitle="Envie, organize e baixe arquivos do escritório com segurança."
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Upload className="h-4 w-4 mr-2" />
                Enviar documento
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Novo documento</DialogTitle>
                <DialogDescription>
                  O arquivo fica armazenado de forma privada e só pode ser acessado por membros do
                  escritório.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Arquivo</Label>
                  <Input
                    ref={fileInput}
                    type="file"
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        file: e.target.files?.[0] ?? null,
                        name: f.name || (e.target.files?.[0]?.name ?? ""),
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Ex: Contrato de honorários — João Silva"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select
                      value={form.category}
                      onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Cliente</Label>
                    <ClientCombobox
                      value={form.client_id}
                      onChange={(v) => setForm((f) => ({ ...f, client_id: v }))}
                      clients={clients}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Textarea
                    rows={3}
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Notas internas sobre o documento (opcional)"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={() => upload.mutate()} disabled={upload.isPending || !form.file}>
                  {upload.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Enviar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <Card className="border-dashed">
        <CardContent className="pt-6 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-primary/20 bg-primary/5 text-primary text-xs font-semibold uppercase tracking-wider">
            <Search className="h-3.5 w-3.5" />
            Pesquisar arquivos
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Cliente / contato</Label>
            <ClientSearchCombobox value={clientDraft} onChange={setClientDraft} clients={clients} />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Nome do arquivo ou #ID</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Pesquisar por nome ou #ID..."
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setSearch(searchDraft);
                    setClientFilter(clientDraft);
                  }
                }}
              />
            </div>
          </div>
          <Button
            onClick={() => {
              setSearch(searchDraft);
              setClientFilter(clientDraft);
            }}
            className="bg-amber-500 hover:bg-amber-600 text-white"
          >
            <Search className="h-4 w-4 mr-2" />
            Pesquisar
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-16 text-xs uppercase tracking-wide">#</TableHead>
                <TableHead className="text-xs uppercase tracking-wide">Arquivo</TableHead>
                <TableHead className="text-xs uppercase tracking-wide">Cliente / Contato</TableHead>
                <TableHead className="text-xs uppercase tracking-wide">Tamanho</TableHead>
                <TableHead className="text-xs uppercase tracking-wide">Enviado</TableHead>
                <TableHead className="text-xs uppercase tracking-wide">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(loadingCompany || isLoading) && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                    Carregando…
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                    Nenhum documento encontrado
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((d) => {
                const Icon = iconFor(d.mime_type);
                const clientName = d.client_id ? clientNameById.get(d.client_id) : null;
                const num = docs.length - docs.indexOf(d);
                const uploaderName =
                  d.uploaded_by === user?.id
                    ? ((user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? "")
                    : "";
                return (
                  <TableRow
                    key={d.id}
                    onClick={() => openDocument(d)}
                    className="cursor-pointer hover:bg-muted/40"
                  >
                    <TableCell className="text-muted-foreground">#{num}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 grid place-items-center rounded-md bg-muted shrink-0">
                          <Icon className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="font-medium">{d.name}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{clientName ?? "—"}</TableCell>
                    <TableCell className="text-sm">{formatBytes(d.size_bytes)}</TableCell>
                    <TableCell className="text-sm">
                      <div>{new Date(d.created_at).toLocaleDateString("pt-BR")}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(d.created_at).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                      {uploaderName && (
                        <div className="text-xs text-muted-foreground mt-1">{uploaderName}</div>
                      )}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => openDocument(d)}>
                          <Eye className="h-4 w-4 mr-1" />
                          Abrir
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => openDocument(d)}>
                          <Download className="h-4 w-4 text-emerald-600" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            confirmDialog({
                              title: "Excluir documento",
                              description: `Deseja realmente excluir "${d.name}"?`,
                              confirmText: "Excluir",
                            }).then((ok) => {
                              if (ok) remove.mutate(d);
                            });
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function ClientCombobox({
  value,
  onChange,
  clients,
}: {
  value: string;
  onChange: (v: string) => void;
  clients: ClientLite[];
}) {
  const [open, setOpen] = useState(false);
  const selected =
    value === "none" ? "Sem cliente" : (clients.find((c) => c.id === value)?.name ?? "Selecione…");
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal",
            value === "none" && "text-muted-foreground",
          )}
        >
          {selected}
          <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
        <Command>
          <CommandInput placeholder="Digitar nome do cliente…" />
          <CommandList>
            <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="sem cliente"
                onSelect={() => {
                  onChange("none");
                  setOpen(false);
                }}
              >
                <Check
                  className={cn("mr-2 h-4 w-4", value === "none" ? "opacity-100" : "opacity-0")}
                />
                Sem cliente
              </CommandItem>
              {clients.map((c) => (
                <CommandItem
                  key={c.id}
                  value={c.name}
                  onSelect={() => {
                    onChange(c.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn("mr-2 h-4 w-4", value === c.id ? "opacity-100" : "opacity-0")}
                  />
                  {c.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function ClientSearchCombobox({
  value,
  onChange,
  clients,
}: {
  value: string;
  onChange: (v: string) => void;
  clients: ClientLite[];
}) {
  const [open, setOpen] = useState(false);
  const selected =
    value === "all"
      ? "Pesquisar cliente / contato existente"
      : (clients.find((c) => c.id === value)?.name ?? "Pesquisar cliente / contato existente");
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-start font-normal h-11",
            value === "all" && "text-muted-foreground",
          )}
        >
          <User className="h-4 w-4 mr-2 opacity-60 shrink-0" />
          <span className="truncate">{selected}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
        <Command>
          <CommandInput placeholder="Digitar nome do cliente…" />
          <CommandList>
            <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="todos"
                onSelect={() => {
                  onChange("all");
                  setOpen(false);
                }}
              >
                <Check
                  className={cn("mr-2 h-4 w-4", value === "all" ? "opacity-100" : "opacity-0")}
                />
                Todos os clientes
              </CommandItem>
              {clients.map((c) => (
                <CommandItem
                  key={c.id}
                  value={c.name}
                  onSelect={() => {
                    onChange(c.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn("mr-2 h-4 w-4", value === c.id ? "opacity-100" : "opacity-0")}
                  />
                  {c.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
