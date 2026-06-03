import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Plus,
  Search,
  Phone,
  Video,
  Mail,
  Building2,
  MessageCircle,
  Calendar as CalIcon,
  Clock,
  DollarSign,
  Trash2,
  Pencil,
  Settings2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/use-active-company";
import { PageHeader, EmptyState } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  upsertAtendimento,
  upsertFeeSchedule,
  deleteFeeSchedule,
} from "@/lib/atendimentos.functions";

export const Route = createFileRoute("/_app/app/atendimentos")({ component: AtendimentosPage });

const ATENDIMENTOS_ENABLED = false;

type Channel = "presencial" | "video" | "telefone" | "whatsapp" | "email";
type Status =
  | "agendado"
  | "confirmado"
  | "em_atendimento"
  | "aguardando_retorno"
  | "concluido"
  | "cancelado"
  | "nao_compareceu";
type ConsultationType = "consulta_inicial" | "processo_existente" | "retorno" | "pos_atendimento";

type FeeSchedule = {
  id: string;
  service_type: string;
  description: string | null;
  default_amount: number;
  active: boolean;
};

type Atendimento = {
  id: string;
  subject: string;
  summary: string | null;
  channel: Channel;
  status: Status;
  consultation_type: ConsultationType;
  scheduled_at: string | null;
  duration_minutes: number | null;
  billable: boolean;
  hourly_rate: number | null;
  amount: number | null;
  client_id: string | null;
  case_id: string | null;
  fee_schedule_id: string | null;
  created_at: string;
  client?: { name: string } | null;
  case?: { title: string } | null;
};

const STATUS_META: Record<Status, { label: string; tone: string }> = {
  agendado: { label: "Agendado", tone: "bg-primary-soft text-primary" },
  confirmado: { label: "Confirmado", tone: "bg-sky-100 text-sky-700" },
  em_atendimento: { label: "Em atendimento", tone: "bg-amber-100 text-amber-700" },
  aguardando_retorno: { label: "Aguardando retorno", tone: "bg-violet-100 text-violet-700" },
  concluido: { label: "Concluído", tone: "bg-emerald-100 text-emerald-700" },
  cancelado: { label: "Cancelado", tone: "bg-rose-100 text-rose-700" },
  nao_compareceu: { label: "Não compareceu", tone: "bg-zinc-200 text-zinc-700" },
};

const CONSULTATION_META: Record<ConsultationType, string> = {
  consulta_inicial: "Consulta inicial",
  processo_existente: "Processo existente",
  retorno: "Retorno",
  pos_atendimento: "Pós-atendimento",
};

const CHANNEL_META: Record<Channel, { label: string; icon: typeof Phone }> = {
  presencial: { label: "Presencial", icon: Building2 },
  video: { label: "Vídeo", icon: Video },
  telefone: { label: "Telefone", icon: Phone },
  whatsapp: { label: "WhatsApp", icon: MessageCircle },
  email: { label: "E-mail", icon: Mail },
};

// Calendly-style time blocks: 8h–20h, every 30 min
const TIME_SLOTS = Array.from({ length: (20 - 8) * 2 + 1 }, (_, i) => {
  const total = 8 * 60 + i * 30;
  const h = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const m = (total % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
});

const EMPTY_FORM = {
  id: undefined as string | undefined,
  subject: "",
  summary: "",
  consultation_type: "consulta_inicial" as ConsultationType,
  channel: "presencial" as Channel,
  status: "agendado" as Status,
  date: undefined as Date | undefined,
  time: "",
  duration_minutes: "60",
  billable: false,
  fee_schedule_id: "",
  amount: "",
  hourly_rate: "",
  client_id: "",
  case_id: "",
};

function AtendimentosPage() {
  const { companyId } = useActiveCompany();
  const qc = useQueryClient();
  const upsertFn = useServerFn(upsertAtendimento);
  const [open, setOpen] = useState(false);
  const [feeOpen, setFeeOpen] = useState(false);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"all" | Status>("all");
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-mini", companyId],
    enabled: !!companyId,
    queryFn: async () =>
      (await supabase.from("clients").select("id, name").eq("company_id", companyId!).order("name"))
        .data ?? [],
  });

  const { data: cases = [] } = useQuery({
    queryKey: ["cases-mini-all", companyId],
    enabled: !!companyId,
    queryFn: async () =>
      (
        await supabase
          .from("cases")
          .select("id, title, client_id")
          .eq("company_id", companyId!)
          .order("created_at", { ascending: false })
      ).data ?? [],
  });

  const { data: fees = [] } = useQuery<FeeSchedule[]>({
    queryKey: ["fee_schedule", companyId],
    enabled: ATENDIMENTOS_ENABLED && !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("fee_schedule")
        .select("*")
        .eq("company_id", companyId!)
        .order("service_type");
      return (data ?? []) as FeeSchedule[];
    },
  });

  const filteredCases = useMemo(
    () => (form.client_id ? cases.filter((c) => c.client_id === form.client_id) : cases),
    [cases, form.client_id],
  );

  const { data: atendimentos = [], isLoading } = useQuery({
    queryKey: ["atendimentos", companyId],
    enabled: ATENDIMENTOS_ENABLED && !!companyId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("atendimentos")
        .select(
          "id, subject, summary, channel, status, consultation_type, scheduled_at, duration_minutes, billable, hourly_rate, amount, client_id, case_id, fee_schedule_id, created_at, client:clients(name), case:cases(title)",
        )
        .eq("company_id", companyId!)
        .order("scheduled_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as Atendimento[];
    },
  });

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: atendimentos.length };
    (Object.keys(STATUS_META) as Status[]).forEach((s) => (c[s] = 0));
    atendimentos.forEach((a) => {
      c[a.status] = (c[a.status] ?? 0) + 1;
    });
    return c;
  }, [atendimentos]);

  const filtered = atendimentos.filter((a) => {
    if (tab !== "all" && a.status !== tab) return false;
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      a.subject.toLowerCase().includes(s) ||
      (a.summary ?? "").toLowerCase().includes(s) ||
      (a.client?.name ?? "").toLowerCase().includes(s)
    );
  });

  const openNew = () => {
    setForm(EMPTY_FORM);
    setOpen(true);
  };
  const openEdit = (a: Atendimento) => {
    const d = a.scheduled_at ? new Date(a.scheduled_at) : undefined;
    setForm({
      id: a.id,
      subject: a.subject,
      summary: a.summary ?? "",
      consultation_type: a.consultation_type,
      channel: a.channel,
      status: a.status,
      date: d,
      time: d ? format(d, "HH:mm") : "",
      duration_minutes: a.duration_minutes?.toString() ?? "60",
      billable: a.billable,
      fee_schedule_id: a.fee_schedule_id ?? "",
      amount: a.amount?.toString() ?? "",
      hourly_rate: a.hourly_rate?.toString() ?? "",
      client_id: a.client_id ?? "",
      case_id: a.case_id ?? "",
    });
    setOpen(true);
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!ATENDIMENTOS_ENABLED) {
        throw new Error("Modulo de atendimentos ainda nao foi criado no banco.");
      }
      if (!form.subject.trim()) throw new Error("Informe o assunto");
      let scheduled_at: string | null = null;
      if (form.date) {
        const d = new Date(form.date);
        if (form.time) {
          const [hh, mm] = form.time.split(":").map(Number);
          d.setHours(hh, mm, 0, 0);
        }
        scheduled_at = d.toISOString();
      }
      await upsertFn({
        data: {
          id: form.id,
          subject: form.subject.trim().slice(0, 200),
          summary: form.summary.trim() || null,
          consultation_type: form.consultation_type,
          channel: form.channel,
          status: form.status,
          scheduled_at,
          duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : null,
          client_id: form.client_id || null,
          case_id: form.case_id || null,
          billable: form.billable,
          fee_schedule_id: form.fee_schedule_id || null,
          amount: form.amount ? Number(form.amount) : null,
          hourly_rate: form.hourly_rate ? Number(form.hourly_rate) : null,
        },
      });
    },
    onSuccess: () => {
      toast.success(form.id ? "Atendimento atualizado" : "Atendimento criado");
      setOpen(false);
      setForm(EMPTY_FORM);
      qc.invalidateQueries({ queryKey: ["atendimentos"] });
      qc.invalidateQueries({ queryKey: ["financial_entries"] });
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      if (!ATENDIMENTOS_ENABLED) {
        throw new Error("Modulo de atendimentos ainda nao foi criado no banco.");
      }
      const { error } = await supabase.from("atendimentos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Atendimento excluído");
      qc.invalidateQueries({ queryKey: ["atendimentos"] });
    },
  });

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title="Central de Consultas"
        subtitle="Consultas iniciais, retornos e pós-atendimento — tudo em um só lugar."
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setFeeOpen(true)}>
              <Settings2 className="h-4 w-4 mr-1.5" /> Honorários
            </Button>
            <Button size="sm" onClick={openNew}>
              <Plus className="h-4 w-4 mr-1.5" /> Nova consulta
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[240px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="all">Todos · {counts.all}</TabsTrigger>
            {(Object.entries(STATUS_META) as [Status, (typeof STATUS_META)[Status]][]).map(
              ([k, v]) => (
                <TabsTrigger key={k} value={k}>
                  {v.label} · {counts[k] ?? 0}
                </TabsTrigger>
              ),
            )}
          </TabsList>
        </Tabs>
      </div>

      {isLoading ? (
        <div className="grid gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={atendimentos.length === 0 ? "Nenhuma consulta registrada" : "Nenhum resultado"}
          description={
            atendimentos.length === 0
              ? "Registre sua primeira consulta para começar."
              : "Ajuste a busca ou filtros."
          }
          action={
            atendimentos.length === 0 ? (
              <Button size="sm" onClick={openNew}>
                <Plus className="h-4 w-4 mr-1.5" /> Nova consulta
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-3">
          {filtered.map((a) => {
            const st = STATUS_META[a.status] ?? {
              label: a.status ?? "—",
              tone: "bg-muted text-muted-foreground",
            };
            const ch = CHANNEL_META[a.channel] ?? { label: a.channel ?? "—", icon: MessageCircle };
            const Icon = ch.icon;
            const when = a.scheduled_at ? new Date(a.scheduled_at) : null;
            return (
              <article
                key={a.id}
                className="group rounded-xl border bg-card p-5 shadow-soft hover:shadow-elevated hover:-translate-y-0.5 transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary-soft text-primary shrink-0">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold truncate">{a.subject}</h3>
                        <Badge className={`${st.tone} border-transparent`}>{st.label}</Badge>
                        <Badge variant="outline">
                          {CONSULTATION_META[a.consultation_type] ?? a.consultation_type ?? "—"}
                        </Badge>
                        <Badge variant="outline">{ch.label}</Badge>
                        {a.billable && (
                          <Badge variant="outline" className="text-emerald-700 border-emerald-200">
                            <DollarSign className="h-3 w-3 mr-0.5" />
                            R$ {a.amount?.toFixed(2) ?? "—"}
                          </Badge>
                        )}
                      </div>
                      {a.summary && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {a.summary}
                        </p>
                      )}
                      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        {a.client?.name && (
                          <span>
                            Cliente: <span className="text-foreground">{a.client.name}</span>
                          </span>
                        )}
                        {a.case?.title && (
                          <span>
                            · Processo: <span className="text-foreground">{a.case.title}</span>
                          </span>
                        )}
                        {when && (
                          <span className="inline-flex items-center gap-1">
                            <CalIcon className="h-3 w-3" />
                            {format(when, "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </span>
                        )}
                        {a.duration_minutes != null && (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {a.duration_minutes} min
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEdit(a)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir consulta?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMut.mutate(a.id)}>
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Atendimento dialog */}
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setForm(EMPTY_FORM);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar consulta" : "Nova consulta"}</DialogTitle>
            <DialogDescription>
              Agende, confirme e acompanhe sessões com seus clientes.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-1.5">
              <Label>Assunto</Label>
              <Input
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder="Ex.: Análise de pedido de aposentadoria"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo de consulta</Label>
                <Select
                  value={form.consultation_type}
                  onValueChange={(v) =>
                    setForm({ ...form, consultation_type: v as ConsultationType })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(CONSULTATION_META) as [ConsultationType, string][]).map(
                      ([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm({ ...form, status: v as Status })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(STATUS_META) as [Status, (typeof STATUS_META)[Status]][]).map(
                      ([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v.label}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Cliente</Label>
                <Select
                  value={form.client_id || "none"}
                  onValueChange={(v) =>
                    setForm({ ...form, client_id: v === "none" ? "" : v, case_id: "" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem cliente</SelectItem>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Processo</Label>
                <Select
                  value={form.case_id || "none"}
                  onValueChange={(v) => setForm({ ...form, case_id: v === "none" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem processo</SelectItem>
                    {filteredCases.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Canal</Label>
                <Select
                  value={form.channel}
                  onValueChange={(v) => setForm({ ...form, channel: v as Channel })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CHANNEL_META).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Duração (min)</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.duration_minutes}
                  onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
                />
              </div>
            </div>

            {/* Calendar + time blocks */}
            <div className="rounded-xl border bg-muted/30 p-3">
              <Label className="text-sm font-medium">Data e horário</Label>
              <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-3 mt-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "justify-start font-normal",
                        !form.date && "text-muted-foreground",
                      )}
                    >
                      <CalIcon className="mr-2 h-4 w-4" />
                      {form.date ? format(form.date, "PPP", { locale: ptBR }) : "Escolher data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={form.date}
                      onSelect={(d) => setForm({ ...form, date: d })}
                      locale={ptBR}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
                <div className="grid grid-cols-5 sm:grid-cols-6 gap-1.5 max-h-40 overflow-y-auto p-1">
                  {TIME_SLOTS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setForm({ ...form, time: t })}
                      className={cn(
                        "rounded-md border px-2 py-1.5 text-xs transition-all hover:border-primary hover:bg-primary-soft",
                        form.time === t &&
                          "border-primary bg-primary text-primary-foreground hover:bg-primary",
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Billable */}
            <div className="rounded-lg border p-3 flex items-center justify-between gap-4">
              <div>
                <Label className="text-sm">Atendimento faturável</Label>
                <p className="text-xs text-muted-foreground">
                  Gera uma conta a receber automaticamente.
                </p>
              </div>
              <Switch
                checked={form.billable}
                onCheckedChange={(v) => setForm({ ...form, billable: v })}
              />
            </div>

            {form.billable && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2">
                  <Label>Serviço (tabela de honorários)</Label>
                  <Select
                    value={form.fee_schedule_id || "none"}
                    onValueChange={(v) => {
                      if (v === "none") return setForm({ ...form, fee_schedule_id: "" });
                      const fee = fees.find((f) => f.id === v);
                      setForm({
                        ...form,
                        fee_schedule_id: v,
                        amount: fee ? String(fee.default_amount) : form.amount,
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um serviço (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Personalizado</SelectItem>
                      {fees
                        .filter((f) => f.active)
                        .map((f) => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.service_type} — R$ {Number(f.default_amount).toFixed(2)}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Valor (R$)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Valor/hora (R$)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.hourly_rate}
                    onChange={(e) => setForm({ ...form, hourly_rate: e.target.value })}
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Resumo / anotações</Label>
              <Textarea
                rows={4}
                value={form.summary}
                onChange={(e) => setForm({ ...form, summary: e.target.value })}
                placeholder="O que foi discutido, próximos passos..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
              {saveMut.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fee schedule manager */}
      <FeeScheduleDialog open={feeOpen} onOpenChange={setFeeOpen} fees={fees} />
    </div>
  );
}

function FeeScheduleDialog({
  open,
  onOpenChange,
  fees,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  fees: FeeSchedule[];
}) {
  const qc = useQueryClient();
  const upsertFn = useServerFn(upsertFeeSchedule);
  const delFn = useServerFn(deleteFeeSchedule);
  const [editing, setEditing] = useState<FeeSchedule | null>(null);
  const [form, setForm] = useState({
    service_type: "",
    description: "",
    default_amount: "",
    active: true,
  });

  const reset = () => {
    setEditing(null);
    setForm({ service_type: "", description: "", default_amount: "", active: true });
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!ATENDIMENTOS_ENABLED) {
        throw new Error("Modulo de atendimentos ainda nao foi criado no banco.");
      }
      if (!form.service_type.trim()) throw new Error("Informe o tipo de serviço");
      await upsertFn({
        data: {
          id: editing?.id,
          service_type: form.service_type.trim(),
          description: form.description.trim() || null,
          default_amount: Number(form.default_amount) || 0,
          active: form.active,
        },
      });
    },
    onSuccess: () => {
      reset();
      qc.invalidateQueries({ queryKey: ["fee_schedule"] });
      toast.success("Salvo");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      if (!ATENDIMENTOS_ENABLED) {
        throw new Error("Modulo de atendimentos ainda nao foi criado no banco.");
      }
      await delFn({ data: { id } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fee_schedule"] });
      toast.success("Removido");
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tabela de honorários</DialogTitle>
          <DialogDescription>
            Cadastre serviços e valores padrão para faturamento automático.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 mb-4">
          {fees.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum serviço cadastrado.</p>
          )}
          {fees.map((f) => (
            <div
              key={f.id}
              className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/30"
            >
              <div className="min-w-0">
                <p className="font-medium truncate">
                  {f.service_type}{" "}
                  {!f.active && (
                    <Badge variant="outline" className="ml-2">
                      inativo
                    </Badge>
                  )}
                </p>
                {f.description && (
                  <p className="text-xs text-muted-foreground truncate">{f.description}</p>
                )}
                <p className="text-sm font-semibold text-emerald-700">
                  R$ {Number(f.default_amount).toFixed(2)}
                </p>
              </div>
              <div className="flex gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => {
                    setEditing(f);
                    setForm({
                      service_type: f.service_type,
                      description: f.description ?? "",
                      default_amount: String(f.default_amount),
                      active: f.active,
                    });
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-rose-600"
                  onClick={() => del.mutate(f.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-lg border p-4 bg-muted/20 grid gap-3">
          <p className="text-sm font-medium">{editing ? "Editar serviço" : "Novo serviço"}</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2">
              <Label>Tipo de serviço</Label>
              <Input
                value={form.service_type}
                onChange={(e) => setForm({ ...form, service_type: e.target.value })}
                placeholder="Ex.: Consulta presencial"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Valor padrão (R$)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.default_amount}
                onChange={(e) => setForm({ ...form, default_amount: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 flex flex-col">
              <Label>Ativo</Label>
              <div className="flex items-center h-10">
                <Switch
                  checked={form.active}
                  onCheckedChange={(v) => setForm({ ...form, active: v })}
                />
              </div>
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Descrição</Label>
              <Textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            {editing && (
              <Button variant="outline" onClick={reset}>
                Cancelar edição
              </Button>
            )}
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {editing ? "Atualizar" : "Adicionar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
