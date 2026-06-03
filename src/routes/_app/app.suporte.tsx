import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  LifeBuoy,
  MessageCircle,
  Mail,
  BookOpen,
  ChevronDown,
  Send,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Inbox,
  Shield,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useActiveCompany } from "@/hooks/use-active-company";
import { usePermissions } from "@/hooks/use-permissions";
import { useCompanyMembers } from "@/hooks/use-company-members";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/app/suporte")({ component: SuportePage });

type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
type TicketPriority = "low" | "normal" | "high" | "urgent";

type Ticket = {
  id: string;
  subject: string;
  message: string;
  status: TicketStatus;
  priority: TicketPriority;
  response: string | null;
  responded_at: string | null;
  responded_by: string | null;
  user_id: string;
  created_at: string;
};

const FAQ = [
  {
    q: "Como cadastrar um novo cliente?",
    a: "Acesse o menu Clientes e clique em 'Novo cliente'. Preencha os dados e salve. O cliente ficará imediatamente disponível para vincular a processos e tarefas.",
  },
  {
    q: "Como vincular uma tarefa a um processo?",
    a: "No Kanban, ao criar ou editar uma tarefa, selecione o processo no campo 'Processo'. A tarefa aparecerá no histórico do processo.",
  },
  {
    q: "Como funciona a multiempresa?",
    a: "Cada conta possui um escritório ativo. Todos os dados são isolados por escritório, garantindo total privacidade entre organizações.",
  },
  {
    q: "Como gerar uma peça jurídica com IA?",
    a: "Acesse 'Criação de peças', escolha o tipo, descreva o assunto e clique em 'Gerar com IA'. Você pode copiar e ajustar a minuta gerada.",
  },
  {
    q: "Como recebo notificações de prazos?",
    a: "A página 'Alertas' centraliza tarefas atrasadas, prazos próximos e eventos da semana. Visite-a periodicamente.",
  },
];

const STATUS_LABEL: Record<TicketStatus, string> = {
  open: "Aberto",
  in_progress: "Em atendimento",
  resolved: "Resolvido",
  closed: "Fechado",
};

const STATUS_STYLE: Record<TicketStatus, string> = {
  open: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  in_progress: "bg-blue-500/10 text-blue-700 border-blue-500/20",
  resolved: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  closed: "bg-muted text-muted-foreground border-border",
};

const PRIORITY_LABEL: Record<TicketPriority, string> = {
  low: "Baixa",
  normal: "Normal",
  high: "Alta",
  urgent: "Urgente",
};

const PRIORITY_STYLE: Record<TicketPriority, string> = {
  low: "bg-muted text-muted-foreground border-border",
  normal: "bg-muted text-muted-foreground border-border",
  high: "bg-orange-500/10 text-orange-700 border-orange-500/20",
  urgent: "bg-rose-500/10 text-rose-700 border-rose-500/20",
};

const SUPPORT_TICKETS_ENABLED = false;

function SuportePage() {
  const { user } = useAuth();
  const { companyId } = useActiveCompany();
  const { isAdmin } = usePermissions();
  const qc = useQueryClient();
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const [form, setForm] = useState({
    subject: "",
    message: "",
    priority: "normal" as TicketPriority,
  });
  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["support-tickets", user?.id],
    enabled: SUPPORT_TICKETS_ENABLED && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select(
          "id, subject, message, status, priority, response, responded_at, responded_by, user_id, created_at",
        )
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) {
        if (error.code === "PGRST205") return [];
        throw error;
      }
      return (data ?? []) as Ticket[];
    },
  });

  const createMut = useMutation({
    mutationFn: async () => {
      if (!companyId || !user) throw new Error("Empresa não selecionada");
      if (!SUPPORT_TICKETS_ENABLED) {
        throw new Error("Modulo de chamados ainda nao foi criado no banco.");
      }
      if (!form.subject.trim() || !form.message.trim()) {
        throw new Error("Preencha assunto e mensagem");
      }
      const { error } = await supabase.from("support_tickets").insert({
        company_id: companyId,
        user_id: user.id,
        subject: form.subject.trim(),
        message: form.message.trim(),
        priority: form.priority,
      });
      if (error) {
        if (error.code === "PGRST205") {
          throw new Error("Modulo de chamados ainda nao foi criado no banco.");
        }
        throw error;
      }
    },
    onSuccess: () => {
      toast.success("Chamado aberto", {
        description: "Nossa equipe responderá em até 24h úteis.",
      });
      setForm({ subject: "", message: "", priority: "normal" });
      qc.invalidateQueries({ queryKey: ["support-tickets", user?.id] });
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title="Suporte"
        subtitle="Central de ajuda — encontre respostas ou abra um chamado."
      />

      {isAdmin ? (
        <Tabs defaultValue="user" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="user">Minha central</TabsTrigger>
            <TabsTrigger value="admin" className="gap-1.5">
              <Shield className="h-3.5 w-3.5" /> Administração
            </TabsTrigger>
          </TabsList>
          <TabsContent value="user">
            <UserView
              FAQ={FAQ}
              openIdx={openIdx}
              setOpenIdx={setOpenIdx}
              form={form}
              setForm={setForm}
              createMut={createMut}
              tickets={tickets}
              isLoading={isLoading}
            />
          </TabsContent>
          <TabsContent value="admin">
            <AdminPanel companyId={companyId} />
          </TabsContent>
        </Tabs>
      ) : (
        <UserView
          FAQ={FAQ}
          openIdx={openIdx}
          setOpenIdx={setOpenIdx}
          form={form}
          setForm={setForm}
          createMut={createMut}
          tickets={tickets}
          isLoading={isLoading}
        />
      )}
    </div>
  );
}

function UserView({
  FAQ,
  openIdx,
  setOpenIdx,
  form,
  setForm,
  createMut,
  tickets,
  isLoading,
}: {
  FAQ: { q: string; a: string }[];
  openIdx: number | null;
  setOpenIdx: (n: number | null) => void;
  form: { subject: string; message: string; priority: TicketPriority };
  setForm: (f: { subject: string; message: string; priority: TicketPriority }) => void;
  createMut: { mutate: () => void; isPending: boolean };
  tickets: Ticket[];
  isLoading: boolean;
}) {
  return (
    <>
      <div className="grid md:grid-cols-3 gap-3 mb-6">
        <ChannelCard
          icon={MessageCircle}
          title="Chat ao vivo"
          description="Resposta em minutos"
          tone="text-emerald-600 bg-emerald-500/10"
        />
        <ChannelCard
          icon={Mail}
          title="suporte@lexia.app"
          description="Resposta em 24h"
          tone="text-primary bg-primary-soft"
        />
        <ChannelCard
          icon={BookOpen}
          title="Base de conhecimento"
          description="Artigos e tutoriais"
          tone="text-violet-600 bg-violet-500/10"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <section className="rounded-xl border bg-card p-5 shadow-soft">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <LifeBuoy className="h-4 w-4" /> Perguntas frequentes
          </h3>
          <ul className="divide-y">
            {FAQ.map((item, idx) => {
              const open = openIdx === idx;
              return (
                <li key={idx} className="py-2">
                  <button
                    onClick={() => setOpenIdx(open ? null : idx)}
                    className="w-full flex items-center justify-between gap-3 py-1.5 text-left text-sm font-medium hover:text-primary transition"
                  >
                    {item.q}
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 text-muted-foreground transition-transform shrink-0",
                        open && "rotate-180",
                      )}
                    />
                  </button>
                  {open && (
                    <p className="text-sm text-muted-foreground pb-2 pt-1 animate-fade-in">
                      {item.a}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <section className="rounded-xl border bg-card p-5 shadow-soft">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Send className="h-4 w-4" /> Abrir chamado
          </h3>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Assunto</Label>
              <Input
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder="Ex: Dúvida sobre cadastro"
                maxLength={160}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Prioridade</Label>
              <Select
                value={form.priority}
                onValueChange={(v) => setForm({ ...form, priority: v as TicketPriority })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PRIORITY_LABEL) as TicketPriority[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {PRIORITY_LABEL[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Mensagem</Label>
              <Textarea
                rows={5}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder="Descreva sua dúvida ou problema com o máximo de detalhes..."
                maxLength={4000}
              />
            </div>
            <Button
              onClick={() => createMut.mutate()}
              className="w-full"
              disabled={createMut.isPending}
            >
              {createMut.isPending ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-1.5" />
              )}
              Enviar mensagem
            </Button>
          </div>
        </section>
      </div>

      <section className="rounded-xl border bg-card p-5 shadow-soft">
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <Clock className="h-4 w-4" /> Meus chamados
        </h3>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : tickets.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8">
            Você ainda não abriu nenhum chamado.
          </div>
        ) : (
          <ul className="space-y-2">
            {tickets.map((t) => (
              <li key={t.id} className="rounded-lg border p-3 hover:bg-muted/30 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate">{t.subject}</span>
                      <Badge variant="outline" className={STATUS_STYLE[t.status]}>
                        {STATUS_LABEL[t.status]}
                      </Badge>
                      {(t.priority === "high" || t.priority === "urgent") && (
                        <Badge variant="outline" className={PRIORITY_STYLE[t.priority]}>
                          <AlertCircle className="h-3 w-3 mr-1" />
                          {PRIORITY_LABEL[t.priority]}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.message}</p>
                    {t.response && (
                      <div className="mt-2 rounded-md bg-emerald-500/5 border border-emerald-500/20 p-2">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 mb-1">
                          <CheckCircle2 className="h-3 w-3" /> Resposta do suporte
                        </div>
                        <p className="text-xs text-foreground/80 whitespace-pre-wrap">
                          {t.response}
                        </p>
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatDistanceToNow(new Date(t.created_at), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function AdminPanel({ companyId }: { companyId: string | null }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { byId: membersById } = useCompanyMembers(companyId);

  const [statusFilter, setStatusFilter] = useState<"all" | TicketStatus>("open");
  const [priorityFilter, setPriorityFilter] = useState<"all" | TicketPriority>("all");
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [response, setResponse] = useState("");

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["admin-support-tickets", companyId],
    enabled: SUPPORT_TICKETS_ENABLED && !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select(
          "id, subject, message, status, priority, response, responded_at, responded_by, user_id, created_at",
        )
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as Ticket[];
    },
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return tickets.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
      if (!term) return true;
      return (
        t.subject.toLowerCase().includes(term) ||
        t.message.toLowerCase().includes(term) ||
        (membersById.get(t.user_id) ?? "").toLowerCase().includes(term)
      );
    });
  }, [tickets, statusFilter, priorityFilter, search, membersById]);

  const counters = useMemo(() => {
    const c = { open: 0, in_progress: 0, resolved: 0, closed: 0, urgent: 0 };
    for (const t of tickets) {
      c[t.status]++;
      if (t.priority === "urgent" && t.status !== "closed" && t.status !== "resolved") c.urgent++;
    }
    return c;
  }, [tickets]);

  const active = useMemo(() => tickets.find((t) => t.id === activeId) ?? null, [tickets, activeId]);

  const respondMut = useMutation({
    mutationFn: async ({
      id,
      newStatus,
      withResponse,
    }: {
      id: string;
      newStatus: TicketStatus;
      withResponse?: string;
    }) => {
      const { respondSupportTicket } = await import("@/lib/support.functions");
      await respondSupportTicket({
        data: {
          ticketId: id,
          newStatus,
          response: withResponse ?? null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Ticket atualizado");
      setResponse("");
      qc.invalidateQueries({ queryKey: ["admin-support-tickets", companyId] });
      qc.invalidateQueries({ queryKey: ["support-tickets"] });
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <KpiCard label="Abertos" value={counters.open} tone="text-amber-700 bg-amber-500/10" />
        <KpiCard
          label="Em atendimento"
          value={counters.in_progress}
          tone="text-blue-700 bg-blue-500/10"
        />
        <KpiCard
          label="Resolvidos"
          value={counters.resolved}
          tone="text-emerald-700 bg-emerald-500/10"
        />
        <KpiCard label="Fechados" value={counters.closed} tone="text-muted-foreground bg-muted" />
        <KpiCard
          label="Urgentes ativos"
          value={counters.urgent}
          tone="text-rose-700 bg-rose-500/10"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por assunto, mensagem ou autor..."
            className="pl-8 h-9"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
        >
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            {(Object.keys(STATUS_LABEL) as TicketStatus[]).map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={priorityFilter}
          onValueChange={(v) => setPriorityFilter(v as typeof priorityFilter)}
        >
          <SelectTrigger className="w-[150px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas prioridades</SelectItem>
            {(Object.keys(PRIORITY_LABEL) as TicketPriority[]).map((p) => (
              <SelectItem key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid lg:grid-cols-[1fr_1.2fr] gap-4">
        <div className="rounded-xl border bg-card shadow-soft overflow-hidden">
          <div className="px-4 py-2.5 border-b bg-muted/40 text-xs font-medium text-muted-foreground flex items-center gap-2">
            <Inbox className="h-3.5 w-3.5" />
            Caixa de entrada ({filtered.length})
          </div>
          {isLoading ? (
            <div className="p-3 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nenhum ticket encontrado.
            </div>
          ) : (
            <ul className="divide-y max-h-[600px] overflow-y-auto">
              {filtered.map((t) => {
                const isActive = activeId === t.id;
                const author = membersById.get(t.user_id) ?? "Membro";
                return (
                  <li
                    key={t.id}
                    onClick={() => {
                      setActiveId(t.id);
                      setResponse(t.response ?? "");
                    }}
                    className={cn(
                      "p-3 cursor-pointer hover:bg-muted/30 transition-colors",
                      isActive && "bg-primary/5",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-sm font-medium truncate">{t.subject}</p>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {formatDistanceToNow(new Date(t.created_at), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-1.5">{t.message}</p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge
                        variant="outline"
                        className={cn("text-[10px]", STATUS_STYLE[t.status])}
                      >
                        {STATUS_LABEL[t.status]}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={cn("text-[10px]", PRIORITY_STYLE[t.priority])}
                      >
                        {PRIORITY_LABEL[t.priority]}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground ml-1">por {author}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="rounded-xl border bg-card shadow-soft p-5">
          {!active ? (
            <div className="h-full grid place-items-center text-center text-sm text-muted-foreground py-12">
              <div>
                <Inbox className="h-8 w-8 mx-auto mb-2 opacity-50" />
                Selecione um ticket à esquerda para responder.
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <Badge variant="outline" className={STATUS_STYLE[active.status]}>
                    {STATUS_LABEL[active.status]}
                  </Badge>
                  <Badge variant="outline" className={PRIORITY_STYLE[active.priority]}>
                    {PRIORITY_LABEL[active.priority]}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(active.created_at).toLocaleString("pt-BR")}
                  </span>
                </div>
                <h2 className="text-base font-semibold">{active.subject}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Aberto por{" "}
                  <span className="font-medium">{membersById.get(active.user_id) ?? "Membro"}</span>
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Mensagem</p>
                <div className="rounded-lg border bg-muted/30 p-3 text-sm whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto">
                  {active.message}
                </div>
              </div>

              {active.response && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">
                    Última resposta
                    {active.responded_at && (
                      <span className="ml-2 text-muted-foreground/70">
                        ({new Date(active.responded_at).toLocaleString("pt-BR")})
                      </span>
                    )}
                  </p>
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm whitespace-pre-wrap leading-relaxed">
                    {active.response}
                  </div>
                </div>
              )}

              <div>
                <Label className="text-xs">Resposta</Label>
                <Textarea
                  rows={5}
                  value={response}
                  onChange={(e) => setResponse(e.target.value)}
                  placeholder="Escreva sua resposta ao usuário..."
                  maxLength={4000}
                  className="mt-1.5"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() =>
                    respondMut.mutate({
                      id: active.id,
                      newStatus: "resolved",
                      withResponse: response,
                    })
                  }
                  disabled={respondMut.isPending || !response.trim()}
                >
                  {respondMut.isPending ? (
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-1.5" />
                  )}
                  Responder e marcar resolvido
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    respondMut.mutate({
                      id: active.id,
                      newStatus: "in_progress",
                      withResponse: response.trim() ? response : undefined,
                    })
                  }
                  disabled={respondMut.isPending}
                >
                  Em atendimento
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => respondMut.mutate({ id: active.id, newStatus: "closed" })}
                  disabled={respondMut.isPending}
                >
                  Fechar
                </Button>
                {active.status !== "open" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => respondMut.mutate({ id: active.id, newStatus: "open" })}
                    disabled={respondMut.isPending}
                  >
                    Reabrir
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl border bg-card p-3 shadow-soft">
      <div className={cn("inline-flex h-6 px-2 items-center rounded-md text-xs font-medium", tone)}>
        {value}
      </div>
      <p className="text-xs text-muted-foreground mt-1.5">{label}</p>
    </div>
  );
}

function ChannelCard({
  icon: Icon,
  title,
  description,
  tone,
}: {
  icon: typeof MessageCircle;
  title: string;
  description: string;
  tone: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-soft hover:shadow-elevated transition cursor-pointer">
      <div className={cn("h-9 w-9 rounded-lg grid place-items-center mb-3", tone)}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
    </div>
  );
}

