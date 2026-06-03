import { confirmDialog } from "@/components/app/confirm-dialog";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Plus,
  Search,
  Newspaper,
  CheckCircle2,
  XCircle,
  Inbox,
  Clock,
  Trash2,
  CalendarPlus,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  AlertTriangle,
  Download,
  UserCheck,
  Bell,
  RefreshCw,
} from "lucide-react";
import { analyzePublication } from "@/lib/legal-ai.functions";
import { addBusinessDays, getAlertLevel, alertLabel, alertToneClass } from "@/lib/legal-deadlines";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useActiveCompany } from "@/hooks/use-active-company";
import { useCompanyMembers } from "@/hooks/use-company-members";
import { PageHeader, EmptyState } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PublicationComments } from "@/components/app/publication-comments";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export const Route = createFileRoute("/_app/app/publicacoes")({
  component: PublicacoesPage,
});

type PubStatus = "not_handled" | "handled" | "discarded";

type Publication = {
  id: string;
  process_number: string | null;
  process_subject: string | null;
  court: string | null;
  court_branch: string | null;
  diary: string | null;
  publication_date: string | null;
  availability_date: string | null;
  communication_type: string | null;
  lawyer_name: string | null;
  oab_number: string | null;
  oab_state: string | null;
  client_name: string | null;
  content: string | null;
  status: PubStatus;
  handled_at: string | null;

  created_at: string;
  ai_analysis: AIAnalysis | null;
  assigned_to: string | null;
};

type AIAnalysis = {
  summary?: string;
  urgency?: "baixa" | "media" | "alta" | "critica";
  petition_type?: string;
  deadline_days?: number;
  deadline_title?: string;
  key_points?: string[];
  confidence?: "baixa" | "media" | "alta";
  is_double_term?: boolean;
  analyzed_at?: string;
};

const PAGE_SIZE = 15;

const UFs = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
];

const statusLabels: Record<PubStatus, string> = {
  not_handled: "Não tratada",
  handled: "Tratada",
  discarded: "Descartada",
};

const statusVariants: Record<PubStatus, "secondary" | "default" | "outline"> = {
  not_handled: "secondary",
  handled: "default",
  discarded: "outline",
};

const pubSchema = z.object({
  process_number: z.string().trim().max(40).optional().or(z.literal("")),
  process_subject: z.string().trim().max(200).optional().or(z.literal("")),
  court: z.string().trim().max(120).optional().or(z.literal("")),
  diary: z.string().trim().max(120).optional().or(z.literal("")),
  publication_date: z.string().optional().or(z.literal("")),
  communication_type: z.string().trim().max(80).optional().or(z.literal("")),
  lawyer_name: z.string().trim().max(120).optional().or(z.literal("")),
  oab_number: z.string().trim().max(20).optional().or(z.literal("")),
  oab_state: z.string().trim().max(2).optional().or(z.literal("")),
  client_name: z.string().trim().max(160).optional().or(z.literal("")),
  content: z.string().trim().min(1, "Conteúdo é obrigatório").max(10000),
});

const emptyForm = {
  process_number: "",
  process_subject: "",
  court: "",
  diary: "",
  publication_date: "",
  communication_type: "",
  lawyer_name: "",
  oab_number: "",
  oab_state: "",
  client_name: "",
  content: "",
};

const deadlineSchema = z.object({
  title: z.string().trim().min(2, "Título obrigatório").max(160),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  due_date: z.string().min(1, "Data obrigatória"),
});

const fmtDate = (d: string | null) => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("pt-BR", { timeZone: "UTC" });
  } catch {
    return d;
  }
};

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

function PublicacoesPage() {
  const { user } = useAuth();
  const { companyId } = useActiveCompany();
  const qc = useQueryClient();

  const [openCreate, setOpenCreate] = useState(false);

  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | PubStatus>("not_handled");
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [courtFilter, setCourtFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [detail, setDetail] = useState<Publication | null>(null);
  const [deadlineOpen, setDeadlineOpen] = useState(false);
  const [deadlineForm, setDeadlineForm] = useState({
    title: "",
    description: "",
    due_date: "",
    is_double_term: false,
  });
  const [deadlineErrors, setDeadlineErrors] = useState<Record<string, string>>({});

  const { byId: membersById, members: companyMembers } = useCompanyMembers(companyId);

  const analyzeFn = useServerFn(analyzePublication);
  const analyzeMut = useMutation({
    mutationFn: async (publicationId: string) => analyzeFn({ data: { publicationId } }),
    onSuccess: ({ analysis }) => {
      toast.success("Análise concluída");
      setDetail((d) => (d ? { ...d, ai_analysis: analysis as AIAnalysis } : d));
    },
    onError: (e: Error) => toast.error(e.message ?? "Falha ao analisar"),
  });

  // ---- list ----
  const { data: publications = [], isLoading } = useQuery({
    queryKey: ["publications", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("publications")
        .select("*")
        .eq("company_id", companyId!)
        .order("publication_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as Publication[];
    },
  });

  // ---- realtime + new pub toast ----
  const firstLoadRef = useRef(true);
  useEffect(() => {
    firstLoadRef.current = true;
  }, [companyId]);
  useEffect(() => {
    if (!companyId) return;
    const ch = supabase
      .channel(`publications-${companyId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "publications",
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          if (!firstLoadRef.current) {
            const row = payload.new as Partial<Publication>;
            if (row.status === "not_handled") {
              toast(
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-primary" />
                  <span>Nova publicação recebida</span>
                </div>,
                { description: row.process_number ?? "Sem número" },
              );
            }
          }
          qc.invalidateQueries({ queryKey: ["publications", companyId] });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "publications",
          filter: `company_id=eq.${companyId}`,
        },
        () => qc.invalidateQueries({ queryKey: ["publications", companyId] }),
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "publications",
          filter: `company_id=eq.${companyId}`,
        },
        () => qc.invalidateQueries({ queryKey: ["publications", companyId] }),
      )
      .subscribe((s) => {
        if (s === "SUBSCRIBED") firstLoadRef.current = false;
      });
    return () => {
      supabase.removeChannel(ch);
    };
  }, [companyId, qc]);

  // ---- counters ----
  const counters = useMemo(() => {
    const { start, end } = todayRange();
    let notHandledToday = 0;
    let handledToday = 0;
    let discardedToday = 0;
    let totalNotHandled = 0;
    for (const p of publications) {
      if (p.status === "not_handled") totalNotHandled++;
      const created = p.created_at;
      if (created >= start && created < end) {
        if (p.status === "not_handled") notHandledToday++;
      }
      if (p.handled_at && p.handled_at >= start && p.handled_at < end) {
        if (p.status === "handled") handledToday++;
        if (p.status === "discarded") discardedToday++;
      }
    }
    return { notHandledToday, handledToday, discardedToday, totalNotHandled };
  }, [publications]);

  const courts = useMemo(() => {
    const set = new Set<string>();
    publications.forEach((p) => p.court && set.add(p.court));
    return Array.from(set).sort();
  }, [publications]);

  // ---- filtered ----
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return publications.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (stateFilter !== "all" && p.oab_state !== stateFilter) return false;
      if (courtFilter !== "all" && p.court !== courtFilter) return false;
      if (!term) return true;
      return (
        (p.process_number ?? "").toLowerCase().includes(term) ||
        (p.client_name ?? "").toLowerCase().includes(term) ||
        (p.lawyer_name ?? "").toLowerCase().includes(term) ||
        (p.content ?? "").toLowerCase().includes(term) ||
        (p.diary ?? "").toLowerCase().includes(term) ||
        (p.court ?? "").toLowerCase().includes(term)
      );
    });
  }, [publications, q, statusFilter, stateFilter, courtFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // ---- mutations ----
  const createMut = useMutation({
    mutationFn: async () => {
      if (!companyId || !user) throw new Error("Empresa não selecionada");
      const parsed = pubSchema.safeParse(form);
      if (!parsed.success) {
        const errs: Record<string, string> = {};
        parsed.error.issues.forEach((i) => {
          errs[i.path[0] as string] = i.message;
        });
        setErrors(errs);
        throw new Error("Verifique os campos");
      }
      setErrors({});
      const d = parsed.data;
      const { error } = await supabase.from("publications").insert({
        company_id: companyId,
        created_by: user.id,
        process_number: d.process_number || null,
        process_subject: d.process_subject || null,
        court: d.court || null,
        diary: d.diary || null,
        publication_date: d.publication_date || null,
        communication_type: d.communication_type || null,
        lawyer_name: d.lawyer_name || null,
        oab_number: d.oab_number || null,
        oab_state: d.oab_state || null,
        client_name: d.client_name || null,
        content: d.content,
        status: "not_handled",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Publicação salva com sucesso");
      setOpenCreate(false);
      setForm(emptyForm);
      qc.invalidateQueries({ queryKey: ["publications", companyId] });
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const setStatusMut = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: PubStatus }) => {
      const patch: Partial<Publication> & { handled_by?: string | null } = { status };
      if (status === "not_handled") {
        patch.handled_at = null;
        patch.handled_by = null;
      } else {
        patch.handled_at = new Date().toISOString();
        patch.handled_by = user?.id ?? null;
      }
      const { error } = await supabase.from("publications").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success(
        vars.status === "handled"
          ? "Marcada como tratada"
          : vars.status === "discarded"
            ? "Publicação descartada"
            : "Restaurada para não tratada",
      );
      qc.invalidateQueries({ queryKey: ["publications", companyId] });
      setDetail((prev) => (prev && prev.id === vars.id ? { ...prev, status: vars.status } : prev));
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("publications").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Publicação excluída");
      qc.invalidateQueries({ queryKey: ["publications", companyId] });
      setDetail(null);
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const createDeadlineMut = useMutation({
    mutationFn: async () => {
      if (!companyId || !user || !detail) throw new Error("Dados insuficientes");
      const parsed = deadlineSchema.safeParse(deadlineForm);
      if (!parsed.success) {
        const errs: Record<string, string> = {};
        parsed.error.issues.forEach((i) => {
          errs[i.path[0] as string] = i.message;
        });
        setDeadlineErrors(errs);
        throw new Error("Verifique os campos");
      }
      setDeadlineErrors({});
      const { error } = await supabase.from("deadlines").insert({
        company_id: companyId,
        created_by: user.id,
        publication_id: detail.id,
        title: parsed.data.title,
        description: parsed.data.description || null,
        due_date: parsed.data.due_date,
        status: "pending",
        is_double_term: deadlineForm.is_double_term,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Prazo criado");
      setDeadlineOpen(false);
      setDeadlineForm({ title: "", description: "", due_date: "", is_double_term: false });
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  // ---- bulk + assign ----
  const bulkMut = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: PubStatus }) => {
      const patch: {
        status: PubStatus;
        handled_at: string | null;
        handled_by: string | null;
      } = {
        status,
        handled_at: status === "not_handled" ? null : new Date().toISOString(),
        handled_by: status === "not_handled" ? null : (user?.id ?? null),
      };
      const { error } = await supabase.from("publications").update(patch).in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success(`${vars.ids.length} publicação(ões) atualizada(s)`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["publications", companyId] });
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const bulkDeleteMut = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("publications").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_d, ids) => {
      toast.success(`${ids.length} publicação(ões) excluída(s)`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["publications", companyId] });
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const assignMut = useMutation({
    mutationFn: async ({ id, userId }: { id: string; userId: string | null }) => {
      const { error } = await supabase
        .from("publications")
        .update({ assigned_to: userId })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.userId ? "Advogado atribuído" : "Atribuição removida");
      setDetail((p) => (p && p.id === vars.id ? { ...p, assigned_to: vars.userId } : p));
      qc.invalidateQueries({ queryKey: ["publications", companyId] });
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  function exportCsv(rows: Publication[]) {
    if (rows.length === 0) {
      toast.info("Nada para exportar");
      return;
    }
    const headers = [
      "Data publicação",
      "Processo",
      "Tribunal",
      "Diário",
      "Tipo",
      "OAB",
      "UF",
      "Advogado",
      "Cliente",
      "Status",
      "Responsável",
      "Conteúdo",
    ];
    const esc = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return `"${s.replace(/"/g, '""').replace(/\n/g, " ")}"`;
    };
    const lines = [headers.join(";")];
    for (const p of rows) {
      lines.push(
        [
          p.publication_date ?? "",
          p.process_number ?? "",
          p.court ?? "",
          p.diary ?? "",
          p.communication_type ?? "",
          p.oab_number ?? "",
          p.oab_state ?? "",
          p.lawyer_name ?? "",
          p.client_name ?? "",
          statusLabels[p.status],
          p.assigned_to ? (membersById.get(p.assigned_to) ?? "") : "",
          p.content ?? "",
        ]
          .map(esc)
          .join(";"),
      );
    }
    const blob = new Blob(["\uFEFF" + lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `publicacoes-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${rows.length} linha(s) exportada(s)`);
  }

  // ---- render ----
  const cards = [
    {
      label: "Não tratadas hoje",
      value: counters.notHandledToday,
      icon: Inbox,
      tone: "text-amber-600",
    },
    {
      label: "Tratadas hoje",
      value: counters.handledToday,
      icon: CheckCircle2,
      tone: "text-emerald-600",
    },
    {
      label: "Descartadas hoje",
      value: counters.discardedToday,
      icon: XCircle,
      tone: "text-muted-foreground",
    },
    {
      label: "Total não tratadas",
      value: counters.totalNotHandled,
      icon: Clock,
      tone: "text-primary",
    },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader
        title="Publicações"
        subtitle="Monitore publicações e intimações dos diários oficiais."
        actions={
          <>
            <Dialog
              open={openCreate}
              onOpenChange={(v) => {
                setOpenCreate(v);
                if (!v) {
                  setErrors({});
                  setForm(emptyForm);
                }
              }}
            >
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1.5" /> Nova publicação
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Nova publicação</DialogTitle>
                  <DialogDescription>
                    Cadastre manualmente uma publicação ou intimação.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-3 py-2 max-h-[70vh] overflow-y-auto pr-1">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Nº do processo</Label>
                      <Input
                        value={form.process_number}
                        onChange={(e) => setForm({ ...form, process_number: e.target.value })}
                        placeholder="0000000-00.0000.0.00.0000"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Tipo de comunicação</Label>
                      <Input
                        value={form.communication_type}
                        onChange={(e) => setForm({ ...form, communication_type: e.target.value })}
                        placeholder="Intimação / Despacho / Sentença"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Tribunal</Label>
                      <Input
                        value={form.court}
                        onChange={(e) => setForm({ ...form, court: e.target.value })}
                        placeholder="TJSP / TRF3 / STJ..."
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Diário</Label>
                      <Input
                        value={form.diary}
                        onChange={(e) => setForm({ ...form, diary: e.target.value })}
                        placeholder="DJe / DOU"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label>Data da publicação</Label>
                      <Input
                        type="date"
                        value={form.publication_date}
                        onChange={(e) => setForm({ ...form, publication_date: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>OAB</Label>
                      <Input
                        value={form.oab_number}
                        onChange={(e) => setForm({ ...form, oab_number: e.target.value })}
                        placeholder="123456"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>UF</Label>
                      <Select
                        value={form.oab_state || undefined}
                        onValueChange={(v) => setForm({ ...form, oab_state: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="UF" />
                        </SelectTrigger>
                        <SelectContent>
                          {UFs.map((uf) => (
                            <SelectItem key={uf} value={uf}>
                              {uf}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Advogado pesquisado</Label>
                      <Input
                        value={form.lawyer_name}
                        onChange={(e) => setForm({ ...form, lawyer_name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Cliente</Label>
                      <Input
                        value={form.client_name}
                        onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>
                      Inteiro teor <span className="text-destructive">*</span>
                    </Label>
                    <Textarea
                      rows={6}
                      value={form.content}
                      onChange={(e) => setForm({ ...form, content: e.target.value })}
                      placeholder="Cole aqui o conteúdo da publicação..."
                    />
                    {errors.content && <p className="text-xs text-destructive">{errors.content}</p>}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpenCreate(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={() => createMut.mutate()} disabled={createMut.isPending}>
                    {createMut.isPending ? "Salvando..." : "Salvar publicação"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      {/* Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div
              key={c.label}
              className="rounded-xl border bg-card p-4 shadow-soft transition-shadow hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{c.label}</p>
                <Icon className={`h-4 w-4 ${c.tone}`} />
              </div>
              <div className="mt-2 text-2xl font-semibold tabular-nums">
                {isLoading ? <Skeleton className="h-7 w-12" /> : c.value}
              </div>
            </div>
          );
        })}
      </div>

      {/* Status tabs */}
      <Tabs
        value={statusFilter}
        onValueChange={(v) => {
          setStatusFilter(v as typeof statusFilter);
          setSelected(new Set());
          setPage(1);
        }}
        className="mb-4"
      >
        <TabsList>
          <TabsTrigger value="not_handled">
            Não tratadas
            <span className="ml-1.5 text-[10px] tabular-nums opacity-70">
              {publications.filter((p) => p.status === "not_handled").length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="handled">
            Tratadas
            <span className="ml-1.5 text-[10px] tabular-nums opacity-70">
              {publications.filter((p) => p.status === "handled").length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="discarded">
            Descartadas
            <span className="ml-1.5 text-[10px] tabular-nums opacity-70">
              {publications.filter((p) => p.status === "discarded").length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="all">Todas</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar processo, cliente, advogado, conteúdo..."
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Button variant="outline" size="default" onClick={() => exportCsv(filtered)}>
          <Download className="h-4 w-4 mr-1.5" /> Exportar CSV
        </Button>
        <Select
          value={courtFilter}
          onValueChange={(v) => {
            setCourtFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full lg:w-[170px]">
            <SelectValue placeholder="Tribunal" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tribunais</SelectItem>
            {courts.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={stateFilter}
          onValueChange={(v) => {
            setStateFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full lg:w-[120px]">
            <SelectValue placeholder="UF" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas UFs</SelectItem>
            {UFs.map((uf) => (
              <SelectItem key={uf} value={uf}>
                {uf}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="rounded-xl border bg-card overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="border-b last:border-0 p-4">
              <Skeleton className="h-5 w-2/3 mb-2" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={
            q || statusFilter !== "all" || stateFilter !== "all" || courtFilter !== "all"
              ? "Nenhuma publicação encontrada"
              : "Nenhuma publicação cadastrada"
          }
          description={
            q || statusFilter !== "all" || stateFilter !== "all" || courtFilter !== "all"
              ? "Ajuste a busca ou os filtros."
              : "Cadastre manualmente ou aguarde a sincronização automática."
          }
          action={
            <Button onClick={() => setOpenCreate(true)} size="sm">
              <Plus className="h-4 w-4 mr-1.5" /> Nova publicação
            </Button>
          }
        />
      ) : (
        <>
          {selected.size > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border bg-primary/5 px-3 py-2">
              <p className="text-sm font-medium mr-2">{selected.size} selecionada(s)</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => bulkMut.mutate({ ids: Array.from(selected), status: "handled" })}
                disabled={bulkMut.isPending}
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Marcar tratadas
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => bulkMut.mutate({ ids: Array.from(selected), status: "discarded" })}
                disabled={bulkMut.isPending}
              >
                <XCircle className="h-3.5 w-3.5 mr-1.5" /> Descartar
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => bulkMut.mutate({ ids: Array.from(selected), status: "not_handled" })}
                disabled={bulkMut.isPending}
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Restaurar
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => exportCsv(filtered.filter((p) => selected.has(p.id)))}
              >
                <Download className="h-3.5 w-3.5 mr-1.5" /> Exportar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                Desmarcar
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  const ids = Array.from(selected);
                  if (ids.length === 0) return;
                  confirmDialog({
                    title: `Excluir ${ids.length} publicação(ões)`,
                    description: "Esta ação não pode ser desfeita.",
                    confirmText: "Excluir",
                  }).then((ok) => {
                    if (ok) bulkDeleteMut.mutate(ids);
                  });
                }}
                disabled={bulkDeleteMut.isPending}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Excluir
              </Button>
            </div>
          )}
          <div className="rounded-xl border bg-card shadow-soft overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="w-[40px] px-3 py-2.5">
                    <Checkbox
                      checked={paged.length > 0 && paged.every((p) => selected.has(p.id))}
                      onCheckedChange={(v) => {
                        const next = new Set(selected);
                        if (v) paged.forEach((p) => next.add(p.id));
                        else paged.forEach((p) => next.delete(p.id));
                        setSelected(next);
                      }}
                      aria-label="Selecionar página"
                    />
                  </th>
                  <th className="text-left font-medium px-4 py-2.5 w-[110px]">Data</th>
                  <th className="text-left font-medium px-4 py-2.5">Processo</th>
                  <th className="text-left font-medium px-4 py-2.5 hidden md:table-cell">
                    Diário / Tribunal
                  </th>
                  <th className="text-left font-medium px-4 py-2.5 hidden lg:table-cell">
                    OAB pesquisada
                  </th>
                  <th className="text-left font-medium px-4 py-2.5 hidden xl:table-cell w-[140px]">
                    Responsável
                  </th>
                  <th className="text-left font-medium px-4 py-2.5 w-[130px]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {paged.map((p) => {
                  const isChecked = selected.has(p.id);
                  return (
                    <tr
                      key={p.id}
                      className={cn(
                        "hover:bg-muted/30 transition-colors cursor-pointer",
                        isChecked && "bg-primary/5",
                      )}
                      onClick={() => setDetail(p)}
                    >
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={(v) => {
                            const next = new Set(selected);
                            if (v) next.add(p.id);
                            else next.delete(p.id);
                            setSelected(next);
                          }}
                          aria-label="Selecionar"
                        />
                      </td>
                      <td className="px-4 py-3 tabular-nums text-muted-foreground">
                        {fmtDate(p.publication_date)}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{p.process_number ?? "Sem número"}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {p.process_subject ?? p.content?.slice(0, 80) ?? "—"}
                        </p>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <p className="text-sm">{p.diary ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{p.court ?? "—"}</p>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                        {p.oab_number ? `${p.oab_number}/${p.oab_state ?? "—"}` : "—"}
                        {p.lawyer_name && <p className="text-xs">{p.lawyer_name}</p>}
                      </td>
                      <td className="px-4 py-3 hidden xl:table-cell text-xs">
                        {p.assigned_to ? (
                          <span className="inline-flex items-center gap-1">
                            <UserCheck className="h-3 w-3 text-primary" />
                            {membersById.get(p.assigned_to) ?? "Membro"}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusVariants[p.status]} className="text-[10px]">
                          {statusLabels[p.status]}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
              <p>
                {filtered.length} {filtered.length === 1 ? "publicação" : "publicações"}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={currentPage === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="tabular-nums">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={currentPage === totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Detail Sheet */}
      <Sheet open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {detail && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-2">
                  <Newspaper className="h-4 w-4 text-primary" />
                  <Badge variant={statusVariants[detail.status]} className="text-[10px]">
                    {statusLabels[detail.status]}
                  </Badge>
                </div>
                <SheetTitle className="text-base">
                  {detail.process_number ?? "Publicação sem número"}
                </SheetTitle>
                <SheetDescription>
                  {detail.process_subject ?? detail.communication_type ?? "Detalhes da publicação"}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <Field label="Tribunal" value={detail.court} />
                <Field label="Vara / Órgão" value={detail.court_branch} />
                <Field label="Diário" value={detail.diary} />
                <Field label="Tipo" value={detail.communication_type} />
                <Field label="Data publicação" value={fmtDate(detail.publication_date)} />
                <Field label="Data disponibilização" value={fmtDate(detail.availability_date)} />
                <Field
                  label="OAB pesquisada"
                  value={
                    detail.oab_number ? `${detail.oab_number}/${detail.oab_state ?? "—"}` : null
                  }
                />
                <Field label="Advogado" value={detail.lawyer_name} />
                <Field label="Cliente" value={detail.client_name} />
              </div>

              <div className="mt-5">
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Inteiro teor</p>
                <div className="rounded-lg border bg-muted/30 p-3 text-sm whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto">
                  {detail.content ?? "—"}
                </div>
              </div>

              <AIAnalysisPanel
                analysis={detail.ai_analysis}
                isAnalyzing={analyzeMut.isPending}
                onAnalyze={() => analyzeMut.mutate(detail.id)}
                onApplyDeadline={(a) => {
                  const isDouble = !!a.is_double_term;
                  setDeadlineForm({
                    title: a.deadline_title || a.petition_type || "Prazo",
                    description: a.summary ?? "",
                    due_date: addBusinessDays(
                      new Date(),
                      Math.max(1, a.deadline_days ?? 5),
                      isDouble,
                    )
                      .toISOString()
                      .slice(0, 10),
                    is_double_term: isDouble,
                  });
                  setDeadlineErrors({});
                  setDeadlineOpen(true);
                }}
              />

              {/* Atribuir advogado */}
              <div className="mt-5 rounded-lg border bg-card p-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-primary" />
                    <p className="text-sm font-medium">Advogado responsável</p>
                  </div>
                  <Select
                    value={detail.assigned_to ?? "none"}
                    onValueChange={(v) =>
                      assignMut.mutate({
                        id: detail.id,
                        userId: v === "none" ? null : v,
                      })
                    }
                  >
                    <SelectTrigger className="w-[210px] h-8 text-xs">
                      <SelectValue placeholder="Atribuir..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem responsável</SelectItem>
                      {companyMembers.map((m) => (
                        <SelectItem key={m.user_id} value={m.user_id}>
                          {m.full_name ?? "Membro"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {companyId && (
                <PublicationComments
                  publicationId={detail.id}
                  companyId={companyId}
                  members={membersById}
                />
              )}

              <div className="mt-6 flex flex-wrap gap-2">
                {detail.status !== "handled" && (
                  <Button
                    size="sm"
                    onClick={() => setStatusMut.mutate({ id: detail.id, status: "handled" })}
                    disabled={setStatusMut.isPending}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1.5" /> Marcar tratada
                  </Button>
                )}
                {detail.status !== "discarded" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setStatusMut.mutate({ id: detail.id, status: "discarded" })}
                    disabled={setStatusMut.isPending}
                  >
                    <XCircle className="h-4 w-4 mr-1.5" /> Descartar
                  </Button>
                )}
                {detail.status !== "not_handled" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setStatusMut.mutate({ id: detail.id, status: "not_handled" })}
                    disabled={setStatusMut.isPending}
                  >
                    <RotateCcw className="h-4 w-4 mr-1.5" /> Restaurar
                  </Button>
                )}
                <Button size="sm" variant="secondary" onClick={() => setDeadlineOpen(true)}>
                  <CalendarPlus className="h-4 w-4 mr-1.5" /> Adicionar prazo
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => {
                    confirmDialog({
                      title: "Excluir publicação",
                      description: "Deseja realmente excluir esta publicação?",
                      confirmText: "Excluir",
                    }).then((ok) => {
                      if (ok) deleteMut.mutate(detail.id);
                    });
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-1.5" /> Excluir
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Deadline Dialog */}
      <Dialog
        open={deadlineOpen}
        onOpenChange={(v) => {
          setDeadlineOpen(v);
          if (!v) {
            setDeadlineErrors({});
            setDeadlineForm({ title: "", description: "", due_date: "", is_double_term: false });
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo prazo</DialogTitle>
            <DialogDescription>Crie um prazo vinculado a esta publicação.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1.5">
              <Label>
                Título <span className="text-destructive">*</span>
              </Label>
              <Input
                value={deadlineForm.title}
                onChange={(e) => setDeadlineForm({ ...deadlineForm, title: e.target.value })}
                placeholder="Ex: Contestação"
              />
              {deadlineErrors.title && (
                <p className="text-xs text-destructive">{deadlineErrors.title}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>
                Data limite <span className="text-destructive">*</span>
              </Label>
              <Input
                type="date"
                value={deadlineForm.due_date}
                onChange={(e) => setDeadlineForm({ ...deadlineForm, due_date: e.target.value })}
              />
              {deadlineErrors.due_date && (
                <p className="text-xs text-destructive">{deadlineErrors.due_date}</p>
              )}
              {deadlineForm.due_date && (
                <div className="pt-1">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px]",
                      alertToneClass(getAlertLevel(deadlineForm.due_date)),
                    )}
                  >
                    {alertLabel(getAlertLevel(deadlineForm.due_date))}
                  </Badge>
                </div>
              )}
            </div>
            <label className="flex items-start gap-2 rounded-lg border bg-muted/30 p-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={deadlineForm.is_double_term}
                onChange={(e) =>
                  setDeadlineForm({ ...deadlineForm, is_double_term: e.target.checked })
                }
              />
              <div className="text-xs">
                <p className="font-medium">Prazo em dobro</p>
                <p className="text-muted-foreground">
                  Fazenda Pública, Ministério Público, Defensoria Pública (CPC art. 183/186/180).
                </p>
              </div>
            </label>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea
                rows={3}
                value={deadlineForm.description}
                onChange={(e) => setDeadlineForm({ ...deadlineForm, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeadlineOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => createDeadlineMut.mutate()}
              disabled={createDeadlineMut.isPending}
            >
              {createDeadlineMut.isPending ? "Salvando..." : "Criar prazo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value || "—"}</p>
    </div>
  );
}

const urgencyStyle: Record<NonNullable<AIAnalysis["urgency"]>, string> = {
  baixa: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  media: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  alta: "bg-orange-500/10 text-orange-700 border-orange-500/30",
  critica: "bg-destructive/10 text-destructive border-destructive/30",
};

function AIAnalysisPanel({
  analysis,
  isAnalyzing,
  onAnalyze,
  onApplyDeadline,
}: {
  analysis: AIAnalysis | null;
  isAnalyzing: boolean;
  onAnalyze: () => void;
  onApplyDeadline: (a: AIAnalysis) => void;
}) {
  return (
    <div className="mt-5 rounded-lg border bg-gradient-to-br from-primary/5 to-transparent p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold">Análise jurídica por IA</p>
          {analysis?.urgency && (
            <Badge
              variant="outline"
              className={`text-[10px] uppercase ${urgencyStyle[analysis.urgency]}`}
            >
              {analysis.urgency === "critica" && <AlertTriangle className="h-3 w-3 mr-1" />}
              {analysis.urgency}
            </Badge>
          )}
        </div>
        <Button
          size="sm"
          variant={analysis ? "outline" : "default"}
          onClick={onAnalyze}
          disabled={isAnalyzing}
        >
          <Sparkles className="h-3.5 w-3.5 mr-1.5" />
          {isAnalyzing ? "Analisando..." : analysis ? "Reanalisar" : "Analisar com IA"}
        </Button>
      </div>

      {!analysis && !isAnalyzing && (
        <p className="text-xs text-muted-foreground">
          Use IA para resumir, classificar urgência e sugerir prazo desta publicação.
        </p>
      )}

      {analysis && (
        <div className="space-y-3 text-sm">
          {analysis.summary && <p className="leading-relaxed">{analysis.summary}</p>}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-muted-foreground">Tipo de peça</p>
              <p className="font-medium">{analysis.petition_type ?? "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Prazo sugerido</p>
              <p className="font-medium">
                {analysis.deadline_days ? `${analysis.deadline_days} dia(s) úteis` : "Sem prazo"}
              </p>
            </div>
          </div>
          {analysis.key_points && analysis.key_points.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Pontos-chave</p>
              <ul className="list-disc pl-4 space-y-0.5 text-xs">
                {analysis.key_points.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
          )}
          {analysis.deadline_days && analysis.deadline_days > 0 && (
            <Button size="sm" variant="secondary" onClick={() => onApplyDeadline(analysis)}>
              <CalendarPlus className="h-3.5 w-3.5 mr-1.5" />
              Criar prazo a partir da sugestão
            </Button>
          )}
          {analysis.confidence && (
            <p className="text-[10px] text-muted-foreground">
              Confiança: {analysis.confidence}
              {analysis.analyzed_at &&
                ` · ${new Date(analysis.analyzed_at).toLocaleString("pt-BR")}`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
