import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Briefcase, Search, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useActiveCompany } from "@/hooks/use-active-company";
import {
  createCaseAdmin,
  listCasesAdmin,
  listClientsAdmin,
} from "@/lib/core-persistence.functions";
import { PageHeader, EmptyState } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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

export const Route = createFileRoute("/_app/app/processos")({ component: ProcessosPage });

type CaseRow = {
  id: string;
  cnj_number: string | null;
  title: string;
  practice_area: string | null;
  court: string | null;
  status: string;
  case_value: number | null;
  client_id: string | null;
  created_at: string;
  client?: { name: string } | null;
};

const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  active: { label: "Ativo", tone: "bg-emerald-50 text-emerald-700" },
  paused: { label: "Pausado", tone: "bg-amber-50 text-amber-700" },
  archived: { label: "Arquivado", tone: "bg-muted text-muted-foreground" },
  won: { label: "Ganho", tone: "bg-emerald-50 text-emerald-700" },
  lost: { label: "Perdido", tone: "bg-rose-50 text-rose-700" },
  settled: { label: "Acordo", tone: "bg-primary-soft text-primary" },
};

function ProcessosPage() {
  const { user } = useAuth();
  const { companyId } = useActiveCompany();
  const qc = useQueryClient();
  const listClientsFn = useServerFn(listClientsAdmin);
  const listCasesFn = useServerFn(listCasesAdmin);
  const createCaseFn = useServerFn(createCaseAdmin);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [form, setForm] = useState({
    title: "",
    cnj_number: "",
    internal_number: "",
    practice_area: "",
    court: "",
    instance: "",
    case_value: "",
    client_id: "",
    polo_ativo: "",
    polo_passivo: "",
    priority: "media",
    procedural_status: "",
    description: "",
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-mini", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const data = await listClientsFn({ data: { companyId: companyId! } });
      return data.map((client) => ({ id: client.id, name: client.name }));
    },
  });

  const { data: cases = [], isLoading } = useQuery({
    queryKey: ["cases", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      return (await listCasesFn({ data: { companyId: companyId! } })) as CaseRow[];
    },
  });

  const createMut = useMutation({
    mutationFn: async () => {
      if (!companyId || !user) throw new Error("Empresa não selecionada");
      if (!form.title.trim()) throw new Error("Informe o título");
      await createCaseFn({
        data: {
          companyId: companyId!,
          title: form.title.trim(),
          cnj_number: form.cnj_number || null,
          internal_number: form.internal_number || null,
          practice_area: form.practice_area || null,
          court: form.court || null,
          instance: form.instance || null,
          case_value: form.case_value ? Number(form.case_value) : null,
          client_id: form.client_id || null,
          polo_ativo: form.polo_ativo || null,
          polo_passivo: form.polo_passivo || null,
          priority: form.priority || "media",
          procedural_status: form.procedural_status || null,
          description: form.description || null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Processo criado");
      setOpen(false);
      setForm({
        title: "",
        cnj_number: "",
        internal_number: "",
        practice_area: "",
        court: "",
        instance: "",
        case_value: "",
        client_id: "",
        polo_ativo: "",
        polo_passivo: "",
        priority: "media",
        procedural_status: "",
        description: "",
      });
      qc.invalidateQueries({ queryKey: ["cases"] });
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const filtered = cases.filter(
    (c) =>
      !q ||
      c.title.toLowerCase().includes(q.toLowerCase()) ||
      (c.cnj_number ?? "").toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title="Processos"
        subtitle="Acompanhe todos os processos jurídicos do escritório."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1.5" /> Novo processo
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo processo</DialogTitle>
                <DialogDescription>Cadastre um novo processo no escritório.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4">
                <div className="space-y-1.5">
                  <Label>Título</Label>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Nº CNJ</Label>
                    <Input
                      value={form.cnj_number}
                      onChange={(e) => setForm({ ...form, cnj_number: e.target.value })}
                      placeholder="0000000-00.0000.0.00.0000"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Cliente</Label>
                    <Select
                      value={form.client_id}
                      onValueChange={(v) => setForm({ ...form, client_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar" />
                      </SelectTrigger>
                      <SelectContent>
                        {clients.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Área</Label>
                    <Input
                      value={form.practice_area}
                      onChange={(e) => setForm({ ...form, practice_area: e.target.value })}
                      placeholder="Cível, Trabalhista..."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Vara/Tribunal</Label>
                    <Input
                      value={form.court}
                      onChange={(e) => setForm({ ...form, court: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label>Instância</Label>
                    <Select
                      value={form.instance}
                      onValueChange={(v) => setForm({ ...form, instance: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1a">1ª instância</SelectItem>
                        <SelectItem value="2a">2ª instância</SelectItem>
                        <SelectItem value="superior">Tribunal Superior</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Nº interno</Label>
                    <Input
                      value={form.internal_number}
                      onChange={(e) => setForm({ ...form, internal_number: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Prioridade</Label>
                    <Select
                      value={form.priority}
                      onValueChange={(v) => setForm({ ...form, priority: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="baixa">Baixa</SelectItem>
                        <SelectItem value="media">Média</SelectItem>
                        <SelectItem value="alta">Alta</SelectItem>
                        <SelectItem value="urgente">Urgente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Polo ativo</Label>
                    <Input
                      value={form.polo_ativo}
                      onChange={(e) => setForm({ ...form, polo_ativo: e.target.value })}
                      placeholder="Autor / Requerente"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Polo passivo</Label>
                    <Input
                      value={form.polo_passivo}
                      onChange={(e) => setForm({ ...form, polo_passivo: e.target.value })}
                      placeholder="Réu / Requerido"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Valor da causa (R$)</Label>
                    <Input
                      type="number"
                      value={form.case_value}
                      onChange={(e) => setForm({ ...form, case_value: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Status processual</Label>
                    <Input
                      value={form.procedural_status}
                      onChange={(e) => setForm({ ...form, procedural_status: e.target.value })}
                      placeholder="Aguardando citação..."
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Descrição</Label>
                  <Textarea
                    rows={3}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={() => createMut.mutate()} disabled={createMut.isPending}>
                  {createMut.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar por título ou CNJ..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="rounded-xl border bg-card p-12 text-center text-sm text-muted-foreground">
          Carregando...
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Nenhum processo cadastrado"
          description="Cadastre seu primeiro processo para começar."
          action={
            <Button onClick={() => setOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-1.5" /> Novo processo
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3">
          {filtered.map((c) => {
            const st = STATUS_LABEL[c.status] ?? STATUS_LABEL.active;
            return (
              <article
                key={c.id}
                className="rounded-xl border bg-card p-5 shadow-soft hover:shadow-elevated transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <Link
                    to="/app/processos/$id"
                    params={{ id: c.id }}
                    className="flex items-start gap-3 min-w-0 flex-1 group"
                  >
                    <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary-soft text-primary shrink-0">
                      <Briefcase className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold truncate group-hover:text-primary transition-colors">
                          {c.title}
                        </h3>
                        <Badge className={`${st.tone} border-transparent`}>{st.label}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 tabular-nums">
                        {c.cnj_number ?? "Sem nº CNJ"}
                      </p>
                      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        {c.client?.name && (
                          <span>
                            Cliente: <span className="text-foreground">{c.client.name}</span>
                          </span>
                        )}
                        {c.practice_area && <span>· {c.practice_area}</span>}
                        {c.court && <span>· {c.court}</span>}
                        {c.case_value != null && (
                          <span>
                            · R${" "}
                            {Number(c.case_value).toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground"
                    asChild
                  >
                    <Link to="/app/processos/$id" params={{ id: c.id }}>
                      <MoreHorizontal className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
