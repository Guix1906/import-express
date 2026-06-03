import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Check,
  ChevronsUpDown,
  Clock,
  FileText,
  Pencil,
  Plus,
  Search,
  Send,
  Trash2,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import {
  createTriagemWithFlow,
  deleteTriageAdmin,
  listTriagensAdmin,
  updateTriageAdmin,
} from "@/lib/triagem-flow.functions";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/use-active-company";
import { useCompanyMembers } from "@/hooks/use-company-members";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { PageHeader, EmptyState } from "@/components/app/page-header";
import type { TriageListItem, TriagePriority, TriageTab } from "@/features/triagem/types";
import {
  demandTypeOptionsByArea,
  elapsedLabel,
  practiceAreaOptions,
  triageOriginOptions,
  triagePriorityClass,
  triagePriorityLabels,
  triageStatusClass,
  triageStatusLabels,
  onlyDigits,
  validateCpfOnly,
} from "@/features/triagem/utils";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/app/triagem")({
  component: TriagemRoute,
});

const tabs: Array<{ value: TriageTab; label: string }> = [
  { value: "all", label: "Todas" },
  { value: "waiting_lawyer", label: "Aguardando advogado" },
  { value: "mine", label: "Minhas triagens" },
  { value: "in_attendance", label: "Em atendimento" },
  { value: "attendance_finished", label: "Atendimento finalizado" },
  { value: "waiting_documents", label: "Aguardando documentos" },
  { value: "converted", label: "Convertidas" },
  { value: "archived", label: "Arquivadas" },
];

const emptyForm = {
  client_id: "",
  contact_name: "",
  contact_phone: "",
  document: "",
  contact_email: "",
  city: "",
  address: "",
  practice_area: "",
  demand_type: "",
  priority: "medium" as TriagePriority,
  origin: "",
  observations: "",
  secretary_notes: "",
  assigned_to: "",
};

type TriageListRow = TriageListItem & {
  address: string | null;
  raw_description: string | null;
  observations: string | null;
  secretary_notes: string | null;
};

function TriagemRoute() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const normalizedPath = pathname.replace(/\/$/, "");
  const isDetailRoute =
    normalizedPath !== "/app/triagem" && normalizedPath.startsWith("/app/triagem/");

  return isDetailRoute ? <Outlet /> : <TriagemPage />;
}

function TriagemPage() {
  const { companyId } = useActiveCompany();
  const { members, byId } = useCompanyMembers(companyId);
  const qc = useQueryClient();
  const createFn = useServerFn(createTriagemWithFlow);
  const listFn = useServerFn(listTriagensAdmin);
  const updateFn = useServerFn(updateTriageAdmin);
  const deleteFn = useServerFn(deleteTriageAdmin);
  const [tab, setTab] = useState<TriageTab>("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState("");
  const [editForm, setEditForm] = useState(emptyForm);

  const lawyers = useMemo(
    () => members.filter((m) => ["owner", "admin", "lawyer"].includes(m.role ?? "")),
    [members],
  );

  const { data: clients = [] } = useQuery({
    queryKey: ["triage-client-search", companyId, form.document, form.contact_name],
    enabled:
      !!companyId &&
      (form.document.replace(/\D/g, "").length >= 4 || form.contact_name.length >= 3),
    staleTime: 60_000,
    queryFn: async () => {
      let query = supabase
        .from("clients")
        .select("id, name, document, phone, email, city, address")
        .eq("company_id", companyId!)
        .limit(8);
      const doc = onlyDigits(form.document);
      if (doc.length >= 4) {
        const maskedCpf =
          doc.length === 11
            ? `${doc.slice(0, 3)}.${doc.slice(3, 6)}.${doc.slice(6, 9)}-${doc.slice(9)}`
            : doc;
        query = query.or(`document.ilike.%${doc}%,document.ilike.%${maskedCpf}%`);
      } else {
        query = query.ilike("name", `%${form.contact_name}%`);
      }
      const { data, error } = await query;
      if (error) {
        const message = error.message.toLowerCase();
        if (
          error.code === "42P01" ||
          (message.includes("clients") &&
            (message.includes("schema cache") || message.includes("does not exist")))
        ) {
          return [];
        }
        throw error;
      }
      return data ?? [];
    },
  });

  const { data: triagens = [], isLoading } = useQuery({
    queryKey: ["triagens", companyId, tab, q],
    enabled: !!companyId,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      return (await listFn({ data: { companyId: companyId!, tab, q } })) as TriageListRow[];
    },
  });

  const createMut = useMutation({
    mutationFn: async () => {
      if (!form.assigned_to) throw new Error("Selecione o advogado responsável");
      if (!form.contact_name || !form.contact_phone || !form.observations) {
        throw new Error("Informe nome, telefone e relato inicial");
      }
      const documentValidation = validateCpfOnly(form.document);
      if (!documentValidation.valid) throw new Error(documentValidation.message);
      return createFn({
        data: {
          ...form,
          client_id: form.client_id || null,
          assigned_to: form.assigned_to,
          raw_description: form.observations,
          secretary_notes: form.secretary_notes || form.observations,
        },
      });
    },
    onSuccess: () => {
      toast.success("Triagem feita com sucesso");
      setForm(emptyForm);
      setOpen(false);
      setTab("all");
      setQ("");
      qc.invalidateQueries({ queryKey: ["triagens", companyId] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (e: Error) => toast.error("Erro ao enviar triagem", { description: e.message }),
  });

  const openEdit = (triage: TriageListRow) => {
    setEditId(triage.id);
    setEditForm({
      client_id: triage.client_id ?? "",
      contact_name: triage.contact_name ?? "",
      contact_phone: triage.contact_phone ?? "",
      document: triage.document ?? "",
      contact_email: triage.contact_email ?? "",
      city: triage.city ?? "",
      address: triage.address ?? "",
      practice_area: triage.practice_area ?? "",
      demand_type: triage.demand_type ?? "",
      priority: triage.priority,
      origin: triage.origin ?? "",
      observations: triage.raw_description ?? triage.observations ?? "",
      secretary_notes: triage.secretary_notes ?? "",
      assigned_to: triage.assigned_to ?? "",
    });
    setEditOpen(true);
  };

  const updateMut = useMutation({
    mutationFn: async () => {
      if (!editId) throw new Error("Triagem nao selecionada");
      if (!editForm.contact_name || !editForm.contact_phone || !editForm.observations) {
        throw new Error("Informe nome, telefone e relato inicial");
      }
      const documentValidation = validateCpfOnly(editForm.document);
      if (!documentValidation.valid) throw new Error(documentValidation.message);

      return updateFn({
        data: {
          triagemId: editId,
          contact_name: editForm.contact_name,
          contact_phone: editForm.contact_phone,
          contact_email: editForm.contact_email,
          document: editForm.document,
          city: editForm.city,
          address: editForm.address,
          practice_area: editForm.practice_area,
          demand_type: editForm.demand_type,
          priority: editForm.priority,
          origin: editForm.origin,
          raw_description: editForm.observations,
          observations: editForm.observations,
          secretary_notes: editForm.secretary_notes || editForm.observations,
          assigned_to: editForm.assigned_to || null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Triagem atualizada");
      setEditOpen(false);
      setEditId("");
      setEditForm(emptyForm);
      qc.invalidateQueries({ queryKey: ["triagens", companyId] });
      qc.invalidateQueries({ queryKey: ["triage-detail", companyId] });
    },
    onError: (e: Error) => toast.error("Erro ao editar triagem", { description: e.message }),
  });

  const deleteMut = useMutation({
    mutationFn: (triagemId: string) => deleteFn({ data: { triagemId } }),
    onSuccess: () => {
      toast.success("Triagem excluida do banco");
      qc.invalidateQueries({ queryKey: ["triagens", companyId] });
      qc.invalidateQueries({ queryKey: ["triage-detail", companyId] });
    },
    onError: (e: Error) => toast.error("Erro ao excluir triagem", { description: e.message }),
  });

  const counters = useMemo(() => {
    return {
      waiting: triagens.filter((t) => t.status === "waiting_lawyer").length,
      attendance: triagens.filter((t) => t.status === "in_attendance").length,
      urgent: triagens.filter((t) => t.priority === "urgent").length,
    };
  }, [triagens]);

  const demandOptions = useMemo(
    () => (form.practice_area ? (demandTypeOptionsByArea[form.practice_area] ?? []) : []),
    [form.practice_area],
  );
  const documentValidation = useMemo(() => validateCpfOnly(form.document), [form.document]);
  const editDemandOptions = useMemo(
    () => (editForm.practice_area ? (demandTypeOptionsByArea[editForm.practice_area] ?? []) : []),
    [editForm.practice_area],
  );
  const editDocumentValidation = useMemo(
    () => validateCpfOnly(editForm.document),
    [editForm.document],
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Triagem"
        subtitle="Entrada premium para secretária e advogado, com vínculo de cliente, prioridade e auditoria por empresa."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" /> Nova Triagem
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl">
              <DialogHeader>
                <DialogTitle>Nova triagem</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <Field
                    label="Nome"
                    value={form.contact_name}
                    onChange={(v) => setForm((f) => ({ ...f, contact_name: v }))}
                  />
                  <Field
                    label="Telefone"
                    value={form.contact_phone}
                    onChange={(v) => setForm((f) => ({ ...f, contact_phone: v }))}
                  />
                  <Field
                    label="CPF *"
                    value={form.document}
                    onChange={(v) => setForm((f) => ({ ...f, document: v }))}
                    error={
                      form.document && !documentValidation.valid
                        ? documentValidation.message
                        : undefined
                    }
                  />
                </div>

                {form.client_id ? (
                  <div className="flex items-center justify-between rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm">
                    <div>
                      <p className="font-medium text-emerald-800">Cliente vinculado</p>
                      <p className="text-xs text-emerald-700/80">
                        {form.contact_name}
                        {form.document ? ` - ${form.document}` : ""}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setForm((f) => ({ ...f, client_id: "" }))}
                    >
                      Trocar
                    </Button>
                  </div>
                ) : clients.length > 0 ? (
                  <div className="rounded-lg border bg-muted/25 p-2">
                    <p className="mb-2 text-xs font-semibold text-muted-foreground">
                      Clientes encontrados
                    </p>
                    <div className="grid gap-2">
                      {clients.map((c) => (
                        <button
                          key={c.id}
                          className="rounded-md border bg-background px-3 py-2 text-left text-sm hover:border-primary"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              client_id: c.id,
                              contact_name: c.name ?? f.contact_name,
                              document: c.document ?? f.document,
                              contact_phone: c.phone ?? f.contact_phone,
                              contact_email: c.email ?? f.contact_email,
                              city: c.city ?? f.city,
                              address: c.address ?? f.address,
                            }))
                          }
                        >
                          <span className="font-medium">{c.name}</span>
                          <span className="ml-2 text-xs text-muted-foreground">
                            {c.document || c.phone || c.email}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-3 md:grid-cols-3">
                  <Field
                    label="E-mail"
                    value={form.contact_email}
                    onChange={(v) => setForm((f) => ({ ...f, contact_email: v }))}
                  />
                  <Field
                    label="Cidade"
                    value={form.city}
                    onChange={(v) => setForm((f) => ({ ...f, city: v }))}
                  />
                  <Field
                    label="Endereço"
                    value={form.address}
                    onChange={(v) => setForm((f) => ({ ...f, address: v }))}
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-4">
                  <ComboField
                    label="Área provável"
                    value={form.practice_area}
                    onChange={(v) =>
                      setForm((f) => ({
                        ...f,
                        practice_area: v,
                        demand_type: demandTypeOptionsByArea[v]?.includes(f.demand_type)
                          ? f.demand_type
                          : "",
                      }))
                    }
                    options={[...practiceAreaOptions]}
                    placeholder="Selecionar area"
                    searchPlaceholder="Pesquisar area..."
                  />
                  <ComboField
                    label="Tipo de demanda"
                    value={form.demand_type}
                    onChange={(v) => setForm((f) => ({ ...f, demand_type: v }))}
                    options={demandOptions}
                    placeholder="Selecionar demanda"
                    searchPlaceholder="Pesquisar demanda..."
                  />
                  <SelectField
                    label="Prioridade"
                    value={form.priority}
                    onChange={(v) => setForm((f) => ({ ...f, priority: v as TriagePriority }))}
                    options={[
                      ["low", "Baixa"],
                      ["medium", "Normal"],
                      ["high", "Alta"],
                      ["urgent", "Urgente"],
                    ]}
                  />
                  <ComboField
                    label="Origem"
                    value={form.origin}
                    onChange={(v) => setForm((f) => ({ ...f, origin: v }))}
                    options={[...triageOriginOptions]}
                    placeholder="Selecionar origem"
                    searchPlaceholder="Pesquisar origem..."
                  />
                </div>

                <SelectField
                  label="Advogado responsável *"
                  value={form.assigned_to}
                  onChange={(v) => setForm((f) => ({ ...f, assigned_to: v }))}
                  options={lawyers.map((m) => [m.user_id, m.full_name ?? "Advogado"])}
                />

                <TextBlock
                  label="Relato inicial"
                  value={form.observations}
                  onChange={(v) => setForm((f) => ({ ...f, observations: v }))}
                />
                <TextBlock
                  label="Observações da secretária"
                  value={form.secretary_notes}
                  onChange={(v) => setForm((f) => ({ ...f, secretary_notes: v }))}
                />

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setOpen(false)}>
                    Cancelar
                  </Button>
                  <Button
                    className="gap-2"
                    disabled={createMut.isPending}
                    onClick={() => createMut.mutate()}
                  >
                    <Send className="h-4 w-4" /> Enviar para advogado
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-3 md:grid-cols-3">
        <MiniKpi icon={UserCheck} label="Aguardando advogado" value={counters.waiting} />
        <MiniKpi icon={Clock} label="Em atendimento" value={counters.attendance} />
        <MiniKpi icon={FileText} label="Urgentes" value={counters.urgent} />
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Tabs value={tab} onValueChange={(v) => setTab(v as TriageTab)} className="overflow-x-auto">
          <TabsList className="h-auto flex-wrap justify-start">
            {tabs.map((item) => (
              <TabsTrigger key={item.value} value={item.value}>
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="relative md:w-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
            placeholder="Buscar nome, CPF ou telefone"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        {isLoading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : triagens.length === 0 ? (
          <EmptyState
            title="Nenhuma triagem encontrada"
            description="Crie uma nova triagem para iniciar o atendimento."
          />
        ) : (
          <div className="divide-y">
            {triagens.map((t) => (
              <div key={t.id} className="p-4 transition-colors hover:bg-muted/35">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{t.contact_name || "Cliente sem nome"}</p>
                      <Badge
                        variant="outline"
                        className={cn("text-[10px]", triageStatusClass[t.status])}
                      >
                        {triageStatusLabels[t.status]}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={cn("text-[10px]", triagePriorityClass[t.priority])}
                      >
                        {triagePriorityLabels[t.priority]}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t.practice_area || "Área não definida"} ·{" "}
                      {t.demand_type || "Demanda não definida"} · Advogado:{" "}
                      {t.assigned_to ? byId.get(t.assigned_to) : "Não atribuído"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <span>Aguardando {elapsedLabel(t.created_at)}</span>
                    <Button
                      asChild
                      variant="outline"
                      className="border-primary/20 bg-primary/5 text-primary hover:text-primary"
                    >
                      <Link to="/app/triagem/$id" params={{ id: t.id }}>
                        Abrir triagem
                      </Link>
                    </Button>
                    <Button variant="outline" onClick={() => openEdit(t)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Editar
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" className="text-rose-600 hover:text-rose-700">
                          <Trash2 className="mr-2 h-4 w-4" />
                          Excluir
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir triagem?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta acao remove a triagem definitivamente do banco. Nao sera possivel
                            desfazer.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            disabled={deleteMut.isPending}
                            onClick={() => deleteMut.mutate(t.id)}
                          >
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Editar triagem</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-3">
              <Field
                label="Nome"
                value={editForm.contact_name}
                onChange={(v) => setEditForm((f) => ({ ...f, contact_name: v }))}
              />
              <Field
                label="Telefone"
                value={editForm.contact_phone}
                onChange={(v) => setEditForm((f) => ({ ...f, contact_phone: v }))}
              />
              <Field
                label="CPF *"
                value={editForm.document}
                onChange={(v) => setEditForm((f) => ({ ...f, document: v }))}
                error={
                  editForm.document && !editDocumentValidation.valid
                    ? editDocumentValidation.message
                    : undefined
                }
              />
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <Field
                label="E-mail"
                value={editForm.contact_email}
                onChange={(v) => setEditForm((f) => ({ ...f, contact_email: v }))}
              />
              <Field
                label="Cidade"
                value={editForm.city}
                onChange={(v) => setEditForm((f) => ({ ...f, city: v }))}
              />
              <Field
                label="Endereco"
                value={editForm.address}
                onChange={(v) => setEditForm((f) => ({ ...f, address: v }))}
              />
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <ComboField
                label="Area provavel"
                value={editForm.practice_area}
                onChange={(v) =>
                  setEditForm((f) => ({
                    ...f,
                    practice_area: v,
                    demand_type: demandTypeOptionsByArea[v]?.includes(f.demand_type)
                      ? f.demand_type
                      : "",
                  }))
                }
                options={[...practiceAreaOptions]}
                placeholder="Selecionar area"
                searchPlaceholder="Pesquisar area..."
              />
              <ComboField
                label="Tipo de demanda"
                value={editForm.demand_type}
                onChange={(v) => setEditForm((f) => ({ ...f, demand_type: v }))}
                options={editDemandOptions}
                placeholder="Selecionar demanda"
                searchPlaceholder="Pesquisar demanda..."
              />
              <SelectField
                label="Prioridade"
                value={editForm.priority}
                onChange={(v) => setEditForm((f) => ({ ...f, priority: v as TriagePriority }))}
                options={[
                  ["low", "Baixa"],
                  ["medium", "Normal"],
                  ["high", "Alta"],
                  ["urgent", "Urgente"],
                ]}
              />
              <ComboField
                label="Origem"
                value={editForm.origin}
                onChange={(v) => setEditForm((f) => ({ ...f, origin: v }))}
                options={[...triageOriginOptions]}
                placeholder="Selecionar origem"
                searchPlaceholder="Pesquisar origem..."
              />
            </div>

            <SelectField
              label="Advogado responsavel"
              value={editForm.assigned_to}
              onChange={(v) => setEditForm((f) => ({ ...f, assigned_to: v }))}
              options={lawyers.map((m) => [m.user_id, m.full_name ?? "Advogado"])}
            />

            <TextBlock
              label="Relato inicial"
              value={editForm.observations}
              onChange={(v) => setEditForm((f) => ({ ...f, observations: v }))}
            />
            <TextBlock
              label="Observacoes da secretaria"
              value={editForm.secretary_notes}
              onChange={(v) => setEditForm((f) => ({ ...f, secretary_notes: v }))}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancelar
            </Button>
            <Button disabled={updateMut.isPending} onClick={() => updateMut.mutate()}>
              Salvar alteracoes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={cn(error && "border-rose-400 focus-visible:ring-rose-400")}
      />
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}

function ComboField({
  label,
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder: string;
  searchPlaceholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const normalizedSearch = search.trim();
  const canUseCustom =
    normalizedSearch.length > 0 &&
    !options.some((option) => option.toLowerCase() === normalizedSearch.toLowerCase());

  const selectValue = (nextValue: string) => {
    onChange(nextValue);
    setSearch("");
    setOpen(false);
  };

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="h-9 w-full justify-between bg-background px-3 font-normal"
          >
            <span className={cn("truncate", !value && "text-muted-foreground")}>
              {value || placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput
              value={search}
              onValueChange={setSearch}
              placeholder={searchPlaceholder}
            />
            <CommandList>
              <CommandEmpty className="px-3 py-3 text-left text-sm">
                <button
                  type="button"
                  className="w-full rounded-sm px-2 py-1.5 text-left hover:bg-accent"
                  onClick={() => normalizedSearch && selectValue(normalizedSearch)}
                  disabled={!normalizedSearch}
                >
                  {normalizedSearch ? `Usar "${normalizedSearch}"` : "Nenhuma opcao encontrada"}
                </button>
              </CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem key={option} value={option} onSelect={() => selectValue(option)}>
                    <Check
                      className={cn("mr-2 h-4 w-4", value === option ? "opacity-100" : "opacity-0")}
                    />
                    {option}
                  </CommandItem>
                ))}
                {canUseCustom && (
                  <CommandItem
                    value={normalizedSearch}
                    onSelect={() => selectValue(normalizedSearch)}
                  >
                    <Check className="mr-2 h-4 w-4 opacity-0" />
                    Usar "{normalizedSearch}"
                  </CommandItem>
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[][];
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
      >
        <option value="">Selecione</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </div>
  );
}

function TextBlock({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Textarea rows={4} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function MiniKpi({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof FileText;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
