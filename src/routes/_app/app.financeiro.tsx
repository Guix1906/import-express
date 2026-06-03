import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Plus,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Pencil,
  Wallet,
  Calendar,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { format, parseISO, isBefore, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/activity-log.functions";
import {
  deleteFinancialEntryAdmin,
  listClientsAdmin,
  listFinancialEntriesAdmin,
  markFinancialEntryPaidAdmin,
  saveFinancialEntryAdmin,
} from "@/lib/core-persistence.functions";
import { useAuth } from "@/hooks/use-auth";
import { useActiveCompany } from "@/hooks/use-active-company";
import { usePermissions } from "@/hooks/use-permissions";
import { PageHeader, EmptyState } from "@/components/app/page-header";
import { PermissionDenied } from "@/components/shared/premium";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

export const Route = createFileRoute("/_app/app/financeiro")({
  component: FinanceiroPage,
});

type EntryType = "receita" | "despesa" | "honorario";
type EntryStatus = "pendente" | "pago" | "atrasado" | "cancelado";
type EntrySubtype = "geral" | "honorario" | "parcela" | "repasse" | "reembolso" | "imposto";

type Entry = {
  id: string;
  entry_type: EntryType;
  subtype: EntrySubtype;
  category: string | null;
  description: string;
  amount: number;
  due_date: string | null;
  paid_at: string | null;
  status: EntryStatus;
  payment_method: string | null;
  case_id: string | null;
  client_id: string | null;
  notes: string | null;
};

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const TYPE_LABEL: Record<EntryType, string> = {
  receita: "Receita",
  despesa: "Despesa",
  honorario: "Honorário",
};

const STATUS_STYLE: Record<EntryStatus, string> = {
  pendente: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  pago: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  atrasado: "bg-rose-500/10 text-rose-700 border-rose-500/20",
  cancelado: "bg-muted text-muted-foreground border-border",
};

function FinanceiroPage() {
  const { companyId } = useActiveCompany();
  const { canViewFinance, isLoading: permissionsLoading } = usePermissions();
  const { user } = useAuth();
  const qc = useQueryClient();
  const logActivityFn = useServerFn(logActivity);
  const listClientsFn = useServerFn(listClientsAdmin);
  const listEntriesFn = useServerFn(listFinancialEntriesAdmin);
  const saveEntryFn = useServerFn(saveFinancialEntryAdmin);
  const markPaidFn = useServerFn(markFinancialEntryPaidAdmin);
  const deleteEntryFn = useServerFn(deleteFinancialEntryAdmin);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | EntryType>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | EntryStatus>("all");
  const [subtypeTab, setSubtypeTab] = useState<"all" | EntrySubtype>("all");
  const [editing, setEditing] = useState<Entry | null>(null);
  const [open, setOpen] = useState(false);

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-list", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const data = await listClientsFn({ data: { companyId: companyId! } });
      return data.map((client) => ({ id: client.id, name: client.name }));
    },
  });

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["financial-entries", companyId],
    enabled: !!companyId,
    staleTime: 60_000,
    queryFn: async () => {
      return (await listEntriesFn({ data: { companyId: companyId! } })) as unknown as Entry[];
    },
  });

  const clientNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of clients) map.set(c.id, c.name);
    return map;
  }, [clients]);

  const kpis = useMemo(() => {
    const today = new Date();
    const mStart = startOfMonth(today);
    const mEnd = endOfMonth(today);
    let aReceber = 0;
    let aPagar = 0;
    let recebidoMes = 0;
    let atrasados = 0;
    for (const e of entries) {
      if (e.status === "cancelado") continue;
      const isIncome = e.entry_type !== "despesa";
      const due = e.due_date ? parseISO(e.due_date) : null;
      const paid = e.paid_at ? parseISO(e.paid_at) : null;
      if (e.status !== "pago") {
        if (isIncome) aReceber += Number(e.amount);
        else aPagar += Number(e.amount);
        if (due && isBefore(due, today)) atrasados += 1;
      }
      if (e.status === "pago" && isIncome && paid && paid >= mStart && paid <= mEnd) {
        recebidoMes += Number(e.amount);
      }
    }
    return { aReceber, aPagar, recebidoMes, atrasados };
  }, [entries]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (subtypeTab !== "all" && (e.subtype ?? "geral") !== subtypeTab) return false;
      if (typeFilter !== "all" && e.entry_type !== typeFilter) return false;
      if (statusFilter !== "all" && e.status !== statusFilter) return false;
      const cname = e.client_id ? (clientNameById.get(e.client_id) ?? "") : "";
      if (q && !`${e.description} ${e.category ?? ""} ${cname}`.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [entries, search, typeFilter, statusFilter, subtypeTab, clientNameById]);

  const saveMut = useMutation({
    mutationFn: async (payload: Partial<Entry> & { id?: string }) => {
      if (!companyId) throw new Error("Empresa não selecionada");
      const saved = await saveEntryFn({
        data: {
          companyId,
          id: payload.id,
          entry_type: payload.entry_type ?? "receita",
          subtype: payload.subtype ?? "geral",
          category: payload.category ?? null,
          description: payload.description ?? "",
          amount: Number(payload.amount ?? 0),
          due_date: payload.due_date ?? null,
          paid_at: payload.paid_at ?? null,
          status: payload.status ?? "pendente",
          payment_method: payload.payment_method ?? null,
          case_id: payload.case_id ?? null,
          client_id: payload.client_id ?? null,
          notes: payload.notes ?? null,
        },
      });
      await logActivityFn({
        data: {
          action: payload.id ? "finance_updated" : "finance_created",
          entity_type: "financeiro",
          entity_id: saved.id,
          entity_label: payload.description ?? editing?.description ?? null,
          metadata: {
            status: payload.status ?? null,
            amount: payload.amount ?? null,
            entry_type: payload.entry_type ?? null,
          },
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financial-entries"] });
      toast.success(editing ? "Lançamento atualizado" : "Lançamento criado");
      setOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error("Erro ao salvar", { description: e.message }),
  });

  const markPaidMut = useMutation({
    mutationFn: async (id: string) => {
      if (!companyId) throw new Error("Empresa não selecionada");
      const entry = entries.find((e) => e.id === id);
      await markPaidFn({ data: { companyId, id } });
      await logActivityFn({
        data: {
          action: "finance_marked_paid",
          entity_type: "financeiro",
          entity_id: id,
          entity_label: entry?.description ?? null,
          metadata: { amount: entry?.amount ?? null, entry_type: entry?.entry_type ?? null },
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financial-entries"] });
      toast.success("Marcado como pago");
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      if (!companyId) throw new Error("Empresa não selecionada");
      const entry = entries.find((e) => e.id === id);
      await deleteEntryFn({ data: { companyId, id } });
      await logActivityFn({
        data: {
          action: "finance_deleted",
          entity_type: "financeiro",
          entity_id: id,
          entity_label: entry?.description ?? null,
          metadata: { amount: entry?.amount ?? null, entry_type: entry?.entry_type ?? null },
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financial-entries"] });
      toast.success("Lançamento excluído");
    },
    onError: (e: Error) => toast.error("Erro ao excluir", { description: e.message }),
  });

  if (!permissionsLoading && !canViewFinance) {
    return (
      <div className="mx-auto max-w-5xl">
        <PermissionDenied message="O financeiro contém dados sensíveis. Peça acesso a um administrador do escritório." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Financeiro"
        subtitle="Honorários, receitas, despesas e fluxo do escritório."
        actions={
          <Dialog
            open={open}
            onOpenChange={(v) => {
              setOpen(v);
              if (!v) setEditing(null);
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" /> Novo lançamento
              </Button>
            </DialogTrigger>
            <EntryDialog
              entry={editing}
              clients={clients}
              onSubmit={(p) => saveMut.mutate(p)}
              saving={saveMut.isPending}
            />
          </Dialog>
        }
      />

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-6">
        <KpiCard
          icon={TrendingUp}
          label="A receber"
          value={fmtBRL(kpis.aReceber)}
          tone="text-emerald-600"
          bg="bg-emerald-500/10"
        />
        <KpiCard
          icon={TrendingDown}
          label="A pagar"
          value={fmtBRL(kpis.aPagar)}
          tone="text-rose-600"
          bg="bg-rose-500/10"
        />
        <KpiCard
          icon={Wallet}
          label="Recebido no mês"
          value={fmtBRL(kpis.recebidoMes)}
          tone="text-primary"
          bg="bg-primary/10"
        />
        <KpiCard
          icon={AlertTriangle}
          label="Atrasados"
          value={String(kpis.atrasados)}
          tone="text-amber-600"
          bg="bg-amber-500/10"
        />
      </div>

      <Tabs
        value={subtypeTab}
        onValueChange={(v) => setSubtypeTab(v as typeof subtypeTab)}
        className="mb-4"
      >
        <TabsList>
          <TabsTrigger value="all">Todos</TabsTrigger>
          <TabsTrigger value="honorario">Honorários</TabsTrigger>
          <TabsTrigger value="parcela">Parcelas</TabsTrigger>
          <TabsTrigger value="repasse">Repasses</TabsTrigger>
          <TabsTrigger value="reembolso">Reembolsos</TabsTrigger>
          <TabsTrigger value="imposto">Impostos</TabsTrigger>
          <TabsTrigger value="geral">Geral</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por descrição, categoria ou cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="receita">Receitas</SelectItem>
            <SelectItem value="honorario">Honorários</SelectItem>
            <SelectItem value="despesa">Despesas</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="pago">Pago</SelectItem>
            <SelectItem value="atrasado">Atrasado</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Nenhum lançamento"
          description="Cadastre receitas, honorários ou despesas para acompanhar o fluxo financeiro."
          action={
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> Novo lançamento
            </Button>
          }
        />
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descrição</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[140px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((e) => {
                const overdue =
                  e.status === "pendente" &&
                  e.due_date &&
                  isBefore(parseISO(e.due_date), new Date());
                const effectiveStatus: EntryStatus = overdue ? "atrasado" : e.status;
                return (
                  <TableRow key={e.id}>
                    <TableCell>
                      <div className="font-medium">{e.description}</div>
                      {e.category && (
                        <div className="text-xs text-muted-foreground">{e.category}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{TYPE_LABEL[e.entry_type]}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {e.client_id ? (clientNameById.get(e.client_id) ?? "—") : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {e.due_date ? (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {format(parseISO(e.due_date), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-medium tabular-nums",
                        e.entry_type === "despesa" ? "text-rose-600" : "text-emerald-600",
                      )}
                    >
                      {e.entry_type === "despesa" ? "-" : "+"}
                      {fmtBRL(Number(e.amount))}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_STYLE[effectiveStatus]}>
                        {effectiveStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {e.status !== "pago" && e.status !== "cancelado" && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => markPaidMut.mutate(e.id)}
                            title="Marcar como pago"
                          >
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setEditing(e);
                            setOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost">
                              <Trash2 className="h-4 w-4 text-rose-600" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir lançamento?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteMut.mutate(e.id)}>
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  tone,
  bg,
}: {
  icon: typeof DollarSign;
  label: string;
  value: string;
  tone: string;
  bg: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-soft">
      <div className="flex items-center gap-3">
        <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", bg)}>
          <Icon className={cn("h-5 w-5", tone)} />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={cn("text-lg font-semibold tabular-nums truncate", tone)}>{value}</p>
        </div>
      </div>
    </div>
  );
}

function EntryDialog({
  entry,
  clients,
  onSubmit,
  saving,
}: {
  entry: Entry | null;
  clients: { id: string; name: string }[];
  onSubmit: (p: Partial<Entry> & { id?: string }) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState({
    entry_type: (entry?.entry_type ?? "honorario") as EntryType,
    subtype: (entry?.subtype ?? "honorario") as EntrySubtype,
    description: entry?.description ?? "",
    category: entry?.category ?? "",
    amount: entry?.amount ? String(entry.amount) : "",
    due_date: entry?.due_date ?? "",
    paid_at: entry?.paid_at ?? "",
    status: (entry?.status ?? "pendente") as EntryStatus,
    payment_method: entry?.payment_method ?? "",
    client_id: entry?.client_id ?? "",
    notes: entry?.notes ?? "",
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.description.trim()) return toast.error("Informe a descrição");
    const amt = Number(form.amount);
    if (!amt || amt <= 0) return toast.error("Informe um valor válido");
    onSubmit({
      ...(entry?.id ? { id: entry.id } : {}),
      entry_type: form.entry_type,
      subtype: form.subtype,
      description: form.description.trim(),
      category: form.category.trim() || null,
      amount: amt,
      due_date: form.due_date || null,
      paid_at: form.paid_at || null,
      status: form.status,
      payment_method: form.payment_method.trim() || null,
      client_id: form.client_id || null,
      notes: form.notes.trim() || null,
    });
  };

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>{entry ? "Editar lançamento" : "Novo lançamento"}</DialogTitle>
        <DialogDescription>Receitas, honorários e despesas do escritório.</DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Tipo</Label>
            <Select
              value={form.entry_type}
              onValueChange={(v) => setForm({ ...form, entry_type: v as EntryType })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="honorario">Honorário</SelectItem>
                <SelectItem value="receita">Receita</SelectItem>
                <SelectItem value="despesa">Despesa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select
              value={form.status}
              onValueChange={(v) => setForm({ ...form, status: v as EntryStatus })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="atrasado">Atrasado</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label>Subtipo</Label>
          <Select
            value={form.subtype}
            onValueChange={(v) => setForm({ ...form, subtype: v as EntrySubtype })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="honorario">Honorário</SelectItem>
              <SelectItem value="parcela">Parcela</SelectItem>
              <SelectItem value="repasse">Repasse</SelectItem>
              <SelectItem value="reembolso">Reembolso</SelectItem>
              <SelectItem value="imposto">Imposto</SelectItem>
              <SelectItem value="geral">Geral</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Descrição *</Label>
          <Input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Ex.: Honorários iniciais — Caso João"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Valor (R$) *</Label>
            <Input
              type="number"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </div>
          <div>
            <Label>Categoria</Label>
            <Input
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              placeholder="Ex.: Sucesso, Mensal"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Vencimento</Label>
            <Input
              type="date"
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
            />
          </div>
          <div>
            <Label>Pago em</Label>
            <Input
              type="date"
              value={form.paid_at}
              onChange={(e) => setForm({ ...form, paid_at: e.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Cliente</Label>
            <Select
              value={form.client_id || "none"}
              onValueChange={(v) => setForm({ ...form, client_id: v === "none" ? "" : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sem cliente" />
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
          <div>
            <Label>Forma de pagamento</Label>
            <Input
              value={form.payment_method}
              onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
              placeholder="PIX, boleto, cartão..."
            />
          </div>
        </div>

        <div>
          <Label>Observações</Label>
          <Textarea
            rows={2}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>

        <DialogFooter>
          <Button type="submit" disabled={saving}>
            {saving ? "Salvando..." : entry ? "Salvar alterações" : "Criar lançamento"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
