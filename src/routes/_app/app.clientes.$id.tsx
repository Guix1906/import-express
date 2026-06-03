import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Building2,
  User as UserIcon,
  Mail,
  Phone,
  MapPin,
  FileText,
  Briefcase,
  ListTodo,
  Calendar,
  DollarSign,
  Trash2,
  Pencil,
  Sparkles,
  MessageSquare,
  FileSignature,
  History,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/use-active-company";
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

export const Route = createFileRoute("/_app/app/clientes/$id")({
  component: ClienteDetalhePage,
});

const fmtBRL = (v: number | null | undefined) =>
  v == null ? "—" : `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const fmtDate = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleDateString("pt-BR") : "—";

function ClienteDetalhePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { companyId } = useActiveCompany();
  const [editOpen, setEditOpen] = useState(false);

  const { data: client, isLoading } = useQuery({
    queryKey: ["client", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: cases = [] } = useQuery({
    queryKey: ["client-cases", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("cases")
        .select("id, title, cnj_number, status, practice_area, case_value, created_at")
        .eq("client_id", id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const caseIds = cases.map((c) => c.id);

  const { data: tasks = [] } = useQuery({
    queryKey: ["client-tasks", id, caseIds.length],
    enabled: caseIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select("id, title, status, priority, due_date, case_id")
        .in("case_id", caseIds)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: events = [] } = useQuery({
    queryKey: ["client-events", id, caseIds.length],
    enabled: caseIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("id, title, starts_at, event_type, case_id")
        .in("case_id", caseIds)
        .order("starts_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: documents = [] } = useQuery({
    queryKey: ["client-documents", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("documents")
        .select("id, name, category, created_at")
        .eq("client_id", id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: finances = [] } = useQuery({
    queryKey: ["client-finances", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("financial_entries")
        .select("id, description, entry_type, amount, status, due_date")
        .eq("client_id", id)
        .order("due_date", { ascending: false });
      return data ?? [];
    },
  });

  const { data: triagens = [] } = useQuery({
    queryKey: ["client-triagens", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("triagens")
        .select(
          "id, contact_name, practice_area, status, ai_classification, raw_description, created_at",
        )
        .eq("converted_client_id", id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: atendimentos = [] } = useQuery({
    queryKey: ["client-atendimentos", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("atendimentos")
        .select("id, subject, summary, channel, status, scheduled_at, duration_minutes, created_at")
        .eq("client_id", id)
        .order("scheduled_at", { ascending: false, nullsFirst: false });
      return data ?? [];
    },
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ["client-contracts", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("contracts")
        .select(
          "id, title, contract_type, status, value, signed_at, start_date, end_date, file_url, created_at",
        )
        .eq("client_id", id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const deleteMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cliente excluído");
      qc.invalidateQueries({ queryKey: ["clients"] });
      navigate({ to: "/app/clientes" });
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

  if (!client) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="rounded-xl border bg-card p-12 text-center">
          <p className="text-sm text-muted-foreground">Cliente não encontrado.</p>
          <Button asChild variant="outline" className="mt-4" size="sm">
            <Link to="/app/clientes">Voltar</Link>
          </Button>
        </div>
      </div>
    );
  }

  const totalReceitas = finances
    .filter((f) => f.entry_type === "receita" && f.status === "pago")
    .reduce((s, f) => s + Number(f.amount), 0);
  const totalDespesas = finances
    .filter((f) => f.entry_type === "despesa" && f.status === "pago")
    .reduce((s, f) => s + Number(f.amount), 0);

  const isCompany = client.client_type === "company";

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/app/clientes">
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Clientes
          </Link>
        </Button>
      </div>

      <header className="rounded-xl border bg-card p-6 shadow-soft">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-4 min-w-0 flex-1">
            <ClientPhoto photoRef={client.photo_url} fallbackIsCompany={isCompany} />

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-semibold truncate">{client.name}</h1>
                <Badge variant="secondary">{isCompany ? "Pessoa jurídica" : "Pessoa física"}</Badge>
              </div>
              {client.document && (
                <p className="text-sm text-muted-foreground mt-1 tabular-nums">{client.document}</p>
              )}
              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                {client.email && <Info icon={Mail} value={client.email} />}
                {client.phone && <Info icon={Phone} value={client.phone} />}
                {client.address && <Info icon={MapPin} value={client.address} />}
              </div>
              {client.notes && (
                <p className="mt-4 text-sm text-foreground/80 whitespace-pre-wrap">
                  {client.notes}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <EditClientDialog
              open={editOpen}
              onOpenChange={setEditOpen}
              client={client}
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
                  <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
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

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <StatCard icon={Sparkles} label="Triagens" value={triagens.length} />
        <StatCard icon={MessageSquare} label="Atendimentos" value={atendimentos.length} />
        <StatCard icon={FileSignature} label="Contratos" value={contracts.length} />
        <StatCard icon={Briefcase} label="Processos" value={cases.length} />
        <StatCard icon={ListTodo} label="Tarefas" value={tasks.length} />
        <StatCard icon={FileText} label="Documentos" value={documents.length} />
        <StatCard icon={DollarSign} label="Saldo" value={fmtBRL(totalReceitas - totalDespesas)} />
      </div>

      <Tabs defaultValue="processos">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="triagens">Triagens ({triagens.length})</TabsTrigger>
          <TabsTrigger value="atendimentos">Atendimentos ({atendimentos.length})</TabsTrigger>
          <TabsTrigger value="contratos">Contratos ({contracts.length})</TabsTrigger>
          <TabsTrigger value="processos">Processos ({cases.length})</TabsTrigger>
          <TabsTrigger value="tarefas">Tarefas ({tasks.length})</TabsTrigger>
          <TabsTrigger value="agenda">Agenda ({events.length})</TabsTrigger>
          <TabsTrigger value="documentos">Documentos ({documents.length})</TabsTrigger>
          <TabsTrigger value="financeiro">Financeiro ({finances.length})</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="triagens" className="mt-4">
          {triagens.length === 0 ? (
            <EmptyBox label="Nenhuma triagem vinculada." />
          ) : (
            <ul className="rounded-xl border bg-card divide-y">
              {triagens.map((t) => {
                const ai = (t.ai_classification ?? null) as {
                  practice_area?: string;
                  urgency?: string;
                  summary?: string;
                } | null;
                return (
                  <li key={t.id} className="p-4 hover:bg-muted/30 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium truncate">
                            {t.practice_area ?? ai?.practice_area ?? "Triagem"}
                          </p>
                          <Badge variant="secondary" className="text-[10px]">
                            {t.status}
                          </Badge>
                          {ai?.urgency && (
                            <Badge variant="outline" className="text-[10px]">
                              {ai.urgency}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {ai?.summary || t.raw_description}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                        {fmtDate(t.created_at)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="atendimentos" className="mt-4">
          {atendimentos.length === 0 ? (
            <EmptyBox label="Nenhum atendimento registrado." />
          ) : (
            <ul className="rounded-xl border bg-card divide-y">
              {atendimentos.map((a) => (
                <li key={a.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{a.subject}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {a.channel} · {a.status}
                        {a.duration_minutes ? ` · ${a.duration_minutes} min` : ""}
                      </p>
                      {a.summary && (
                        <p className="text-sm text-foreground/80 mt-2 line-clamp-2">{a.summary}</p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                      {fmtDate(a.scheduled_at ?? a.created_at)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="contratos" className="mt-4">
          {contracts.length === 0 ? (
            <EmptyBox label="Nenhum contrato." />
          ) : (
            <ul className="rounded-xl border bg-card divide-y">
              {contracts.map((c) => (
                <li key={c.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium truncate">{c.title}</p>
                      <Badge variant="secondary" className="text-[10px]">
                        {c.status}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {c.contract_type}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {c.signed_at
                        ? `Assinado em ${fmtDate(c.signed_at)}`
                        : `Criado em ${fmtDate(c.created_at)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-semibold tabular-nums">{fmtBRL(c.value)}</span>
                    {c.file_url && (
                      <a
                        href={c.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:text-primary/80"
                        title="Abrir contrato"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="processos" className="mt-4">
          {cases.length === 0 ? (
            <EmptyBox label="Nenhum processo vinculado." />
          ) : (
            <ul className="rounded-xl border bg-card divide-y">
              {cases.map((c) => (
                <li key={c.id} className="p-4 hover:bg-muted/30 transition-colors">
                  <Link
                    to="/app/processos/$id"
                    params={{ id: c.id }}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{c.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                        {c.cnj_number ?? "Sem nº CNJ"} · {c.practice_area ?? "—"} · {c.status}
                      </p>
                    </div>
                    <span className="text-sm tabular-nums shrink-0">{fmtBRL(c.case_value)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="tarefas" className="mt-4">
          {tasks.length === 0 ? (
            <EmptyBox label="Nenhuma tarefa." />
          ) : (
            <ul className="rounded-xl border bg-card divide-y">
              {tasks.map((t) => (
                <li key={t.id} className="p-4">
                  <p className="font-medium truncate">{t.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t.status} · {t.priority} · {fmtDate(t.due_date)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="agenda" className="mt-4">
          {events.length === 0 ? (
            <EmptyBox label="Nenhum evento." />
          ) : (
            <ul className="rounded-xl border bg-card divide-y">
              {events.map((e) => (
                <li key={e.id} className="p-4 flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium truncate">{e.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {e.event_type} · {fmtDate(e.starts_at)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="documentos" className="mt-4">
          {documents.length === 0 ? (
            <EmptyBox label="Nenhum documento." />
          ) : (
            <ul className="rounded-xl border bg-card divide-y">
              {documents.map((d) => (
                <li key={d.id} className="p-4">
                  <p className="font-medium truncate">{d.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {d.category ?? "—"} · {fmtDate(d.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="financeiro" className="mt-4">
          {finances.length === 0 ? (
            <EmptyBox label="Nenhum lançamento." />
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

        <TabsContent value="historico" className="mt-4">
          <Timeline
            triagens={triagens}
            atendimentos={atendimentos}
            contracts={contracts}
            cases={cases}
            events={events}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Info({ icon: Icon, value }: { icon: React.ElementType; value: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-foreground/80 min-w-0">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="truncate">{value}</span>
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

function EditClientDialog({
  open,
  onOpenChange,
  client,
  companyId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  client: any;
  companyId: string | null;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: client.name ?? "",
    client_type: client.client_type ?? "individual",
    document: client.document ?? "",
    email: client.email ?? "",
    phone: client.phone ?? "",
    address: client.address ?? "",
    notes: client.notes ?? "",
  });

  const mut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("clients")
        .update({
          name: form.name.trim(),
          client_type: form.client_type as any,
          document: form.document || null,
          email: form.email || null,
          phone: form.phone || null,
          address: form.address || null,
          notes: form.notes || null,
        })
        .eq("id", client.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cliente atualizado");
      qc.invalidateQueries({ queryKey: ["client", client.id] });
      qc.invalidateQueries({ queryKey: ["clients", companyId] });
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
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Editar cliente</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select
                value={form.client_type}
                onValueChange={(v) => setForm({ ...form, client_type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Pessoa física</SelectItem>
                  <SelectItem value="company">Pessoa jurídica</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{form.client_type === "company" ? "CNPJ" : "CPF"}</Label>
              <Input
                value={form.document}
                onChange={(e) => setForm({ ...form, document: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Endereço</Label>
            <Input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
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

type TimelineItem = {
  date: string;
  icon: React.ElementType;
  label: string;
  description?: string;
  tone?: string;
};

function Timeline({
  triagens,
  atendimentos,
  contracts,
  cases,
  events,
}: {
  triagens: any[];
  atendimentos: any[];
  contracts: any[];
  cases: any[];
  events: any[];
}) {
  const items: TimelineItem[] = [];
  for (const t of triagens)
    items.push({
      date: t.created_at,
      icon: Sparkles,
      label: "Triagem criada",
      description: t.practice_area ?? "—",
      tone: "text-violet-600",
    });
  for (const a of atendimentos)
    items.push({
      date: a.scheduled_at ?? a.created_at,
      icon: MessageSquare,
      label: `Atendimento: ${a.subject}`,
      description: `${a.channel} · ${a.status}`,
      tone: "text-sky-600",
    });
  for (const c of contracts)
    items.push({
      date: c.signed_at ?? c.created_at,
      icon: FileSignature,
      label: `Contrato: ${c.title}`,
      description: c.status,
      tone: "text-emerald-600",
    });
  for (const c of cases)
    items.push({
      date: c.created_at,
      icon: Briefcase,
      label: `Processo: ${c.title}`,
      description: c.cnj_number ?? c.practice_area ?? "—",
      tone: "text-amber-600",
    });
  for (const e of events)
    items.push({
      date: e.starts_at,
      icon: Calendar,
      label: e.title,
      description: e.event_type,
      tone: "text-rose-600",
    });

  items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (items.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">
        Sem histórico ainda.
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <ol className="relative border-l ml-3 space-y-4">
        {items.map((it, i) => {
          const Icon = it.icon;
          return (
            <li key={i} className="ml-6">
              <span
                className={`absolute -left-3 grid h-6 w-6 place-items-center rounded-full bg-background border ${it.tone ?? ""}`}
              >
                <Icon className="h-3 w-3" />
              </span>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">{it.label}</p>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {new Date(it.date).toLocaleDateString("pt-BR")}
                </span>
              </div>
              {it.description && (
                <p className="text-xs text-muted-foreground mt-0.5">{it.description}</p>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function ClientPhoto({
  photoRef,
  fallbackIsCompany,
}: {
  photoRef: string | null | undefined;
  fallbackIsCompany: boolean;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    if (!photoRef) return;
    // Compat: valores antigos eram URLs públicas completas.
    if (/^https?:\/\//i.test(photoRef)) {
      setUrl(photoRef);
      return;
    }
    (async () => {
      const { data } = await supabase.storage
        .from("client-photos")
        .createSignedUrl(photoRef, 60 * 60);
      if (!cancelled && data?.signedUrl) setUrl(data.signedUrl);
    })();
    return () => {
      cancelled = true;
    };
  }, [photoRef]);

  if (url) {
    return (
      <img
        src={url}
        alt="Foto do cliente"
        className="h-12 w-12 rounded-lg object-cover shrink-0 border"
      />
    );
  }
  return (
    <div className="grid h-12 w-12 place-items-center rounded-lg bg-primary-soft text-primary shrink-0">
      {fallbackIsCompany ? <Building2 className="h-6 w-6" /> : <UserIcon className="h-6 w-6" />}
    </div>
  );
}
