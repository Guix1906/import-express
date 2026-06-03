import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  ArrowLeft,
  Briefcase,
  Calendar,
  FileText,
  DollarSign,
  ListTodo,
  Trash2,
  Pencil,
  Plus,
  Activity,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/use-active-company";
import { addProcessMovement, listProcessMovements } from "@/lib/process.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_app/app/processos/$id")({
  component: ProcessoDetalhePage,
});

const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  active: { label: "Ativo", tone: "bg-emerald-50 text-emerald-700" },
  paused: { label: "Pausado", tone: "bg-amber-50 text-amber-700" },
  archived: { label: "Arquivado", tone: "bg-muted text-muted-foreground" },
  won: { label: "Ganho", tone: "bg-emerald-50 text-emerald-700" },
  lost: { label: "Perdido", tone: "bg-rose-50 text-rose-700" },
  settled: { label: "Acordo", tone: "bg-primary-soft text-primary" },
};

const fmtBRL = (v: number | null | undefined) =>
  v == null ? "—" : `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const fmtDate = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleDateString("pt-BR") : "—";

function ProcessoDetalhePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { companyId } = useActiveCompany();
  const [editOpen, setEditOpen] = useState(false);

  const { data: caseRow, isLoading } = useQuery({
    queryKey: ["case", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cases")
        .select("*, client:clients(id, name)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["case-tasks", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select("id, title, status, priority, due_date")
        .eq("case_id", id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: deadlines = [] } = useQuery({
    queryKey: ["case-deadlines", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("deadlines")
        .select("id, title, due_date, status, is_double_term")
        .eq("case_id", id)
        .order("due_date", { ascending: true });
      return data ?? [];
    },
  });

  const { data: documents = [] } = useQuery({
    queryKey: ["case-documents", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("documents")
        .select("id, name, category, created_at")
        .eq("case_id", id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: finances = [] } = useQuery({
    queryKey: ["case-finances", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("financial_entries")
        .select("id, description, entry_type, amount, status, due_date")
        .eq("case_id", id)
        .order("due_date", { ascending: false });
      return data ?? [];
    },
  });

  const listMovementsFn = useServerFn(listProcessMovements);
  const addMovementFn = useServerFn(addProcessMovement);
  const { data: movementsData } = useQuery({
    queryKey: ["case-movements", id],
    queryFn: () => listMovementsFn({ data: { case_id: id } }),
  });
  const movements = movementsData?.movements ?? [];

  const addMovementMut = useMutation({
    mutationFn: (input: {
      title: string;
      description?: string;
      movement_type: string;
      movement_date: string;
    }) => addMovementFn({ data: { case_id: id, ...input } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["case-movements", id] });
      toast.success("Andamento registrado");
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const addDeadlineMut = useMutation({
    mutationFn: async (input: { title: string; due_date: string; is_double_term: boolean }) => {
      if (!companyId) throw new Error("Empresa não selecionada");
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("deadlines").insert({
        company_id: companyId,
        created_by: u.user!.id,
        case_id: id,
        title: input.title,
        due_date: input.due_date,
        is_double_term: input.is_double_term,
        status: "pending",
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["case-deadlines", id] });
      toast.success("Prazo adicionado");
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const deleteMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("cases").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Processo excluído");
      qc.invalidateQueries({ queryKey: ["cases"] });
      navigate({ to: "/app/processos" });
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!caseRow) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="rounded-xl border bg-card p-12 text-center">
          <p className="text-sm text-muted-foreground">Processo não encontrado.</p>
          <Button asChild variant="outline" className="mt-4" size="sm">
            <Link to="/app/processos">Voltar</Link>
          </Button>
        </div>
      </div>
    );
  }

  const st = STATUS_LABEL[caseRow.status] ?? STATUS_LABEL.active;
  const totalReceitas = finances
    .filter((f) => f.entry_type === "receita" && f.status === "pago")
    .reduce((s, f) => s + Number(f.amount), 0);
  const totalDespesas = finances
    .filter((f) => f.entry_type === "despesa" && f.status === "pago")
    .reduce((s, f) => s + Number(f.amount), 0);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/app/processos">
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Processos
          </Link>
        </Button>
      </div>

      <header className="rounded-xl border bg-card p-6 shadow-soft">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-4 min-w-0 flex-1">
            <div className="grid h-12 w-12 place-items-center rounded-lg bg-primary-soft text-primary shrink-0">
              <Briefcase className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-semibold truncate">{caseRow.title}</h1>
                <Badge className={`${st.tone} border-transparent`}>{st.label}</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1 tabular-nums">
                {caseRow.cnj_number ?? "Sem nº CNJ"}
              </p>
              <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <Field label="Cliente" value={caseRow.client?.name ?? "—"} />
                <Field label="Área" value={caseRow.practice_area ?? "—"} />
                <Field label="Vara/Tribunal" value={caseRow.court ?? "—"} />
                <Field label="Valor da causa" value={fmtBRL(caseRow.case_value)} />
              </div>
              {caseRow.description && (
                <p className="mt-4 text-sm text-foreground/80 whitespace-pre-wrap">
                  {caseRow.description}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <EditCaseDialog
              open={editOpen}
              onOpenChange={setEditOpen}
              caseRow={caseRow}
              companyId={companyId}
            />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir processo?</AlertDialogTitle>
                  <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => deleteMut.mutate()}>Excluir</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={ListTodo} label="Tarefas" value={tasks.length} />
        <StatCard icon={Calendar} label="Prazos" value={deadlines.length} />
        <StatCard icon={FileText} label="Documentos" value={documents.length} />
        <StatCard icon={DollarSign} label="Saldo" value={fmtBRL(totalReceitas - totalDespesas)} />
      </div>

      <Tabs defaultValue="andamentos">
        <TabsList>
          <TabsTrigger value="andamentos">Andamentos ({movements.length})</TabsTrigger>
          <TabsTrigger value="prazos">Prazos ({deadlines.length})</TabsTrigger>
          <TabsTrigger value="tarefas">Tarefas ({tasks.length})</TabsTrigger>
          <TabsTrigger value="documentos">Documentos ({documents.length})</TabsTrigger>
          <TabsTrigger value="financeiro">Financeiro ({finances.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="andamentos" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <AddMovementDialog
              onSubmit={(p) => addMovementMut.mutate(p)}
              saving={addMovementMut.isPending}
            />
          </div>
          {movements.length === 0 ? (
            <EmptyBox label="Nenhum andamento registrado." />
          ) : (
            <ol className="relative border-l-2 border-border ml-3 space-y-4">
              {movements.map((m) => (
                <li key={m.id} className="ml-6">
                  <span className="absolute -left-[7px] mt-1.5 h-3 w-3 rounded-full bg-primary" />
                  <div className="rounded-lg border bg-card p-4 shadow-soft">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="font-medium">{m.title}</p>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {format(new Date(m.movement_date + "T00:00:00"), "dd/MM/yyyy", {
                          locale: ptBR,
                        })}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="secondary" className="text-[10px] capitalize">
                        {m.movement_type}
                      </Badge>
                      {m.source && <span>· {m.source}</span>}
                    </div>
                    {m.description && (
                      <p className="mt-2 text-sm whitespace-pre-wrap text-foreground/80">
                        {m.description}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </TabsContent>

        <TabsContent value="tarefas" className="mt-4">
          {tasks.length === 0 ? (
            <EmptyBox label="Nenhuma tarefa neste processo." />
          ) : (
            <ul className="rounded-xl border bg-card divide-y">
              {tasks.map((t) => (
                <li key={t.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{t.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t.status} · {t.priority} · {fmtDate(t.due_date)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="prazos" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <AddDeadlineDialog
              onSubmit={(p) => addDeadlineMut.mutate(p)}
              saving={addDeadlineMut.isPending}
            />
          </div>
          {deadlines.length === 0 ? (
            <EmptyBox label="Nenhum prazo cadastrado." />
          ) : (
            <ul className="rounded-xl border bg-card divide-y">
              {deadlines.map((d) => (
                <li key={d.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{d.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Vence em {fmtDate(d.due_date)} · {d.status}
                      {d.is_double_term ? " · prazo em dobro" : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="documentos" className="mt-4">
          {documents.length === 0 ? (
            <EmptyBox label="Nenhum documento anexado." />
          ) : (
            <ul className="rounded-xl border bg-card divide-y">
              {documents.map((d) => (
                <li key={d.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{d.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {d.category ?? "—"} · {fmtDate(d.created_at)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="financeiro" className="mt-4">
          {finances.length === 0 ? (
            <EmptyBox label="Nenhum lançamento financeiro." />
          ) : (
            <ul className="rounded-xl border bg-card divide-y">
              {finances.map((f) => (
                <li key={f.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{f.description}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {f.entry_type} · {f.status} · {fmtDate(f.due_date)}
                    </p>
                  </div>
                  <span
                    className={`text-sm font-semibold tabular-nums ${
                      f.entry_type === "receita" ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    {f.entry_type === "receita" ? "+" : "−"} {fmtBRL(Number(f.amount))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium truncate">{value}</p>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-soft">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-xs">{label}</span>
      </div>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function EmptyBox({ label }: { label: string }) {
  return (
    <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}

function EditCaseDialog({
  open,
  onOpenChange,
  caseRow,
  companyId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  caseRow: {
    id: string;
    title: string | null;
    cnj_number: string | null;
    practice_area: string | null;
    court: string | null;
    case_value: number | string | null;
    status: string | null;
    description: string | null;
  };
  companyId: string | null;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    title: caseRow.title ?? "",
    cnj_number: caseRow.cnj_number ?? "",
    practice_area: caseRow.practice_area ?? "",
    court: caseRow.court ?? "",
    case_value: caseRow.case_value?.toString() ?? "",
    status: caseRow.status ?? "active",
    description: caseRow.description ?? "",
  });

  const mut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("cases")
        .update({
          title: form.title.trim(),
          cnj_number: form.cnj_number || null,
          practice_area: form.practice_area || null,
          court: form.court || null,
          case_value: form.case_value ? Number(form.case_value) : null,
          status: form.status,
          description: form.description || null,
        } as never)
        .eq("id", caseRow.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Processo atualizado");
      qc.invalidateQueries({ queryKey: ["case", caseRow.id] });
      qc.invalidateQueries({ queryKey: ["cases", companyId] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="h-4 w-4 mr-1.5" /> Editar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar processo</DialogTitle>
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
              />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v.label}
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
          <div className="space-y-1.5">
            <Label>Valor da causa (R$)</Label>
            <Input
              type="number"
              value={form.case_value}
              onChange={(e) => setForm({ ...form, case_value: e.target.value })}
            />
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddMovementDialog({
  onSubmit,
  saving,
}: {
  onSubmit: (p: {
    title: string;
    description?: string;
    movement_type: string;
    movement_date: string;
  }) => void;
  saving: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("andamento");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [desc, setDesc] = useState("");

  const submit = () => {
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      movement_type: type,
      movement_date: date,
      description: desc.trim() || undefined,
    });
    setOpen(false);
    setTitle("");
    setDesc("");
    setType("andamento");
    setDate(new Date().toISOString().slice(0, 10));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1.5" /> <Activity className="h-4 w-4 mr-1" /> Novo andamento
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar andamento</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Título</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Petição protocolada"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="andamento">Andamento</SelectItem>
                  <SelectItem value="peticao">Petição</SelectItem>
                  <SelectItem value="decisao">Decisão</SelectItem>
                  <SelectItem value="audiencia">Audiência</SelectItem>
                  <SelectItem value="intimacao">Intimação</SelectItem>
                  <SelectItem value="recurso">Recurso</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving || !title.trim()}>
            {saving ? "Salvando..." : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddDeadlineDialog({
  onSubmit,
  saving,
}: {
  onSubmit: (p: { title: string; due_date: string; is_double_term: boolean }) => void;
  saving: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [double, setDouble] = useState(false);

  const submit = () => {
    if (!title.trim() || !date) return;
    onSubmit({ title: title.trim(), due_date: date, is_double_term: double });
    setOpen(false);
    setTitle("");
    setDate("");
    setDouble(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1.5" /> Novo prazo
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo prazo</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Título</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Contestação"
            />
          </div>
          <div>
            <Label>Vencimento</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={double} onChange={(e) => setDouble(e.target.checked)} />
            Prazo em dobro (Fazenda Pública / MP / Defensoria)
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving || !title.trim() || !date}>
            {saving ? "Salvando..." : "Adicionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
