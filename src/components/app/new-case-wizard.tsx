import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  Sparkles,
  Search,
  UserPlus,
  Scale,
  ClipboardList,
  Calendar as CalendarIcon,
  Check,
  ArrowRight,
  ArrowLeft,
  Loader2,
  User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/use-active-company";
import { useAuth } from "@/hooks/use-auth";
import { PRACTICE_AREAS } from "@/lib/practice-area-fields";

type Step = 0 | 1 | 2 | 3 | 4;

const STEPS: { key: Step; title: string; icon: typeof Sparkles }[] = [
  { key: 0, title: "Cliente", icon: UserIcon },
  { key: 1, title: "Área", icon: Scale },
  { key: 2, title: "Triagem", icon: ClipboardList },
  { key: 3, title: "Atendimento", icon: CalendarIcon },
  { key: 4, title: "Resumo", icon: Check },
];

type ClientLite = { id: string; name: string; email: string | null; phone: string | null };

export function NewCaseWizard({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { companyId } = useActiveCompany();
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>(0);
  const [submitting, setSubmitting] = useState(false);

  // Cliente
  const [search, setSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<ClientLite | null>(null);
  const [newClient, setNewClient] = useState({ name: "", email: "", phone: "" });
  const [clientMode, setClientMode] = useState<"existing" | "new">("existing");

  // Caso
  const [practiceArea, setPracticeArea] = useState<string | null>(null);
  const [triagemNotes, setTriagemNotes] = useState("");
  const [urgencia, setUrgencia] = useState<"baixa" | "media" | "alta">("media");

  // Atendimento
  const [scheduleNow, setScheduleNow] = useState(true);
  const [scheduledAt, setScheduledAt] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  });

  const reset = () => {
    setStep(0);
    setSearch("");
    setSelectedClient(null);
    setNewClient({ name: "", email: "", phone: "" });
    setClientMode("existing");
    setPracticeArea(null);
    setTriagemNotes("");
    setUrgencia("media");
    setScheduleNow(true);
  };

  useEffect(() => {
    if (!open) setTimeout(reset, 200);
  }, [open]);

  const { data: clients = [], isFetching: searching } = useQuery({
    queryKey: ["wizard-clients", companyId, search],
    enabled: !!companyId && open && clientMode === "existing",
    queryFn: async (): Promise<ClientLite[]> => {
      let q = supabase
        .from("clients")
        .select("id, name, email, phone")
        .eq("company_id", companyId!)
        .order("name")
        .limit(8);
      if (search.trim()) q = q.ilike("name", `%${search.trim()}%`);
      const { data } = await q;
      return data ?? [];
    },
  });

  const canAdvance = useMemo(() => {
    if (step === 0) {
      return clientMode === "existing" ? !!selectedClient : !!newClient.name.trim();
    }
    if (step === 1) return !!practiceArea;
    if (step === 2) return true; // triagem opcional
    if (step === 3) return true;
    return true;
  }, [step, clientMode, selectedClient, newClient.name, practiceArea]);

  const submit = useMutation({
    mutationFn: async () => {
      if (!companyId || !user) throw new Error("Sessão inválida");

      // 1. Cliente
      let clientId = selectedClient?.id;
      let clientName = selectedClient?.name ?? "";
      if (clientMode === "new" || !clientId) {
        const { data: created, error } = await supabase
          .from("clients")
          .insert({
            company_id: companyId,
            name: newClient.name.trim(),
            email: newClient.email.trim() || null,
            phone: newClient.phone.trim() || null,
            client_type: "individual",
            created_by: user.id,
          })
          .select("id, name")
          .single();
        if (error) throw error;
        clientId = created.id;
        clientName = created.name;
      }

      // 2. Caso (se área escolhida)
      let caseId: string | null = null;
      if (practiceArea) {
        const { data: caseData, error: caseErr } = await supabase
          .from("cases")
          .insert({
            company_id: companyId,
            client_id: clientId,
            created_by: user.id,
            title: `${practiceArea} - ${clientName}`,
            practice_area: practiceArea,
            priority: urgencia,
            status: "active",
            description: triagemNotes || null,
          })
          .select("id")
          .single();
        if (caseErr) throw caseErr;
        caseId = caseData.id;
      }

      // 3. Triagem registro (se há notas)
      if (triagemNotes.trim() && clientId) {
        await supabase.from("triagens").insert({
          company_id: companyId,
          created_by: user.id,
          contact_name: clientName,
          contact_email: newClient.email || selectedClient?.email || null,
          contact_phone: newClient.phone || selectedClient?.phone || null,
          raw_description: triagemNotes,
          practice_area: practiceArea,
          converted_client_id: clientId,
          converted_case_id: caseId,
          status: "convertido",
        });
      }

      // 4. Atendimento agendado
      if (scheduleNow && scheduledAt) {
        const dt = new Date(scheduledAt).toISOString();
        await supabase.from("atendimentos").insert({
          company_id: companyId,
          created_by: user.id,
          client_id: clientId,
          case_id: caseId,
          assigned_to: user.id,
          subject: `Atendimento inicial - ${clientName}`,
          summary: triagemNotes || null,
          channel: "presencial",
          status: "agendado",
          scheduled_at: dt,
          consultation_type: "consulta_inicial",
        });

        // Evento na agenda
        await supabase.from("events").insert({
          company_id: companyId,
          created_by: user.id,
          assigned_to: user.id,
          case_id: caseId,
          title: `Atendimento - ${clientName}`,
          event_type: "meeting",
          starts_at: dt,
        });
      }

      // 5. Activity log
      await supabase.from("activity_logs").insert({
        company_id: companyId,
        user_id: user.id,
        action: "novo_caso_wizard",
        entity_type: "case",
        entity_id: caseId,
        entity_label: clientName,
        metadata: { practice_area: practiceArea, scheduled: scheduleNow },
      });

      return { clientId, caseId };
    },
    onSuccess: ({ clientId }) => {
      toast.success("Caso criado com sucesso!");
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      onOpenChange(false);
      if (clientId) navigate({ to: "/app/clientes/$id", params: { id: clientId } });
    },
    onError: (e: Error) => {
      toast.error("Erro ao criar caso", { description: e.message });
    },
  });

  const handleNext = () => {
    if (step < 4) setStep((s) => (s + 1) as Step);
    else {
      setSubmitting(true);
      submit.mutate(undefined, { onSettled: () => setSubmitting(false) });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden gap-0">
        {/* Header com progresso */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <div className="h-8 w-8 grid place-items-center rounded-lg bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </div>
            Novo Caso
          </DialogTitle>

          <div className="flex items-center gap-1 mt-4">
            {STEPS.map((s, i) => {
              const active = step === s.key;
              const done = step > s.key;
              return (
                <div key={s.key} className="flex items-center flex-1 last:flex-none">
                  <div
                    className={cn(
                      "flex items-center gap-2 px-2 py-1 rounded-md text-xs transition-all",
                      active && "text-foreground font-medium",
                      done && "text-primary",
                      !active && !done && "text-muted-foreground",
                    )}
                  >
                    <div
                      className={cn(
                        "h-5 w-5 grid place-items-center rounded-full text-[10px] font-semibold",
                        active && "bg-primary text-primary-foreground",
                        done && "bg-primary/15 text-primary",
                        !active && !done && "bg-muted text-muted-foreground",
                      )}
                    >
                      {done ? <Check className="h-3 w-3" /> : i + 1}
                    </div>
                    <span className="hidden sm:inline">{s.title}</span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={cn("h-px flex-1 mx-1", done ? "bg-primary/30" : "bg-border")} />
                  )}
                </div>
              );
            })}
          </div>
        </DialogHeader>

        {/* Conteúdo */}
        <div className="px-6 py-6 min-h-[340px] max-h-[60vh] overflow-y-auto">
          {step === 0 && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button
                  variant={clientMode === "existing" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setClientMode("existing")}
                  className="gap-2"
                >
                  <Search className="h-3.5 w-3.5" /> Cliente existente
                </Button>
                <Button
                  variant={clientMode === "new" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setClientMode("new")}
                  className="gap-2"
                >
                  <UserPlus className="h-3.5 w-3.5" /> Novo cliente
                </Button>
              </div>

              {clientMode === "existing" ? (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar cliente por nome..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {searching ? (
                      <div className="text-sm text-muted-foreground py-4 text-center">
                        Buscando...
                      </div>
                    ) : clients.length === 0 ? (
                      <div className="text-sm text-muted-foreground py-8 text-center">
                        Nenhum cliente encontrado. Use "Novo cliente" para criar.
                      </div>
                    ) : (
                      clients.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => setSelectedClient(c)}
                          className={cn(
                            "w-full text-left flex items-center gap-3 p-3 rounded-lg border transition-all",
                            selectedClient?.id === c.id
                              ? "border-primary bg-primary/5"
                              : "hover:bg-accent border-transparent",
                          )}
                        >
                          <div className="h-9 w-9 rounded-full bg-muted grid place-items-center text-sm font-semibold">
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-sm truncate">{c.name}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {c.email || c.phone || "Sem contato"}
                            </div>
                          </div>
                          {selectedClient?.id === c.id && (
                            <Check className="h-4 w-4 text-primary" />
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <div>
                    <Label>Nome completo *</Label>
                    <Input
                      autoFocus
                      value={newClient.name}
                      onChange={(e) => setNewClient((p) => ({ ...p, name: e.target.value }))}
                      placeholder="Nome do cliente"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>E-mail</Label>
                      <Input
                        type="email"
                        value={newClient.email}
                        onChange={(e) => setNewClient((p) => ({ ...p, email: e.target.value }))}
                        placeholder="email@exemplo.com"
                      />
                    </div>
                    <div>
                      <Label>Telefone</Label>
                      <Input
                        value={newClient.phone}
                        onChange={(e) => setNewClient((p) => ({ ...p, phone: e.target.value }))}
                        placeholder="(00) 00000-0000"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Dados complementares podem ser preenchidos depois na ficha do cliente.
                  </p>
                </div>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium mb-3">Área jurídica do caso</h3>
                <div className="flex flex-wrap gap-2">
                  {PRACTICE_AREAS.map((a) => (
                    <button
                      key={a}
                      onClick={() => setPracticeArea(a)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-sm border transition-all",
                        practiceArea === a
                          ? "bg-primary text-primary-foreground border-primary shadow-soft"
                          : "hover:bg-accent border-border",
                      )}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium mb-3">Prioridade</h3>
                <div className="flex gap-2">
                  {(["baixa", "media", "alta"] as const).map((u) => (
                    <button
                      key={u}
                      onClick={() => setUrgencia(u)}
                      className={cn(
                        "px-4 py-2 rounded-lg text-sm border capitalize transition-all flex-1",
                        urgencia === u
                          ? u === "alta"
                            ? "bg-red-500/10 border-red-500 text-red-600 dark:text-red-400"
                            : u === "media"
                              ? "bg-amber-500/10 border-amber-500 text-amber-600 dark:text-amber-400"
                              : "bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400"
                          : "hover:bg-accent border-border",
                      )}
                    >
                      {u === "media" ? "Média" : u}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <div>
                <Label className="flex items-center gap-2">
                  Resumo do caso{" "}
                  <Badge variant="outline" className="text-[10px]">
                    Opcional
                  </Badge>
                </Label>
                <Textarea
                  autoFocus
                  rows={8}
                  value={triagemNotes}
                  onChange={(e) => setTriagemNotes(e.target.value)}
                  placeholder="Descreva brevemente a situação do cliente, fatos relevantes, documentos disponíveis e o que o cliente espera..."
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Esta descrição será registrada como triagem e ficará disponível na ficha do
                  cliente.
                </p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button
                  variant={scheduleNow ? "default" : "outline"}
                  size="sm"
                  onClick={() => setScheduleNow(true)}
                >
                  Sim, agendar
                </Button>
                <Button
                  variant={!scheduleNow ? "default" : "outline"}
                  size="sm"
                  onClick={() => setScheduleNow(false)}
                >
                  Agendar depois
                </Button>
              </div>

              {scheduleNow && (
                <div>
                  <Label>Data e horário do atendimento</Label>
                  <Input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Será criado um atendimento e um evento na agenda automaticamente.
                  </p>
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium mb-3">Confirme as informações</h3>
              <SummaryRow
                label="Cliente"
                value={clientMode === "existing" ? selectedClient?.name : newClient.name}
              />
              <SummaryRow label="Área jurídica" value={practiceArea} />
              <SummaryRow label="Prioridade" value={urgencia} />
              <SummaryRow
                label="Triagem"
                value={
                  triagemNotes
                    ? `${triagemNotes.slice(0, 80)}${triagemNotes.length > 80 ? "..." : ""}`
                    : "—"
                }
              />
              <SummaryRow
                label="Atendimento"
                value={
                  scheduleNow
                    ? new Date(scheduledAt).toLocaleString("pt-BR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })
                    : "Agendar depois"
                }
              />
              <div className="mt-6 rounded-lg bg-primary/5 border border-primary/20 p-4 text-sm">
                <p className="font-medium text-primary mb-2">
                  O sistema vai criar automaticamente:
                </p>
                <ul className="space-y-1 text-muted-foreground text-xs">
                  <li>✓ Cliente {clientMode === "new" ? "novo" : "vinculado"}</li>
                  {practiceArea && <li>✓ Caso/processo na área {practiceArea}</li>}
                  {triagemNotes && <li>✓ Registro de triagem</li>}
                  {scheduleNow && <li>✓ Atendimento agendado + evento na agenda</li>}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-muted/30">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setStep((s) => Math.max(0, s - 1) as Step)}
            disabled={step === 0 || submitting}
            className="gap-1"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
          <Button onClick={handleNext} disabled={!canAdvance || submitting} className="gap-2">
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Criando...
              </>
            ) : step === 4 ? (
              <>
                Criar caso <Check className="h-4 w-4" />
              </>
            ) : (
              <>
                Continuar <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SummaryRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground uppercase tracking-wide">{label}</span>
      <span className="text-sm font-medium text-right">{value || "—"}</span>
    </div>
  );
}
