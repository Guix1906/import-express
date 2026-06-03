import { confirmDialog } from "@/components/app/confirm-dialog";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MessageSquare,
  ListChecks,
  FileText,
  History,
  Trash2,
  Eye,
  X,
  CheckCircle2,
  Plus,
  ClipboardList,
  UserCheck,
  FileSignature,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  type CardChecklistItem,
  type CardComment,
  type CardEvent,
  type CardWatcher,
  type ColumnKey,
  type CompanyMemberLite,
  type Priority,
  type ProductionCard,
  COLUMN_LABEL,
  PRIORITY_LABEL,
  PRIORITY_STYLES,
  initials,
} from "./types";
import { FieldEdit } from "./FieldEdit";
import { CardDocuments } from "./CardDocuments";
import { CardMovimentacoes } from "./CardMovimentacoes";
import { CardFinanceiro } from "./CardFinanceiro";
import { CardPreliminares } from "./CardPreliminares";
import { CardQuestionnaire } from "./CardQuestionnaire";
import { CloseContractDialog } from "./CloseContractDialog";

export function CardDetailDialog({
  card,
  onClose,
  membersById,
  members,
  userId,
  companyId,
}: {
  card: ProductionCard | null;
  onClose: () => void;
  membersById: Map<string, string>;
  members: CompanyMemberLite[];
  userId: string;
  companyId: string | null;
}) {
  const qc = useQueryClient();
  const [tab, setTab] = useState("resumo");

  const { data: events = [] } = useQuery({
    queryKey: ["card-events", card?.id],
    enabled: !!card,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_card_events")
        .select("*")
        .eq("card_id", card!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as CardEvent[];
    },
  });

  const { data: comments = [] } = useQuery({
    queryKey: ["card-comments", card?.id],
    enabled: !!card,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_card_comments")
        .select("*")
        .eq("card_id", card!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as CardComment[];
    },
  });

  const { data: checklist = [] } = useQuery({
    queryKey: ["card-checklist", card?.id],
    enabled: !!card,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_card_checklist")
        .select("*")
        .eq("card_id", card!.id)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as CardChecklistItem[];
    },
  });

  const { data: watchers = [] } = useQuery({
    queryKey: ["card-watchers", card?.id],
    enabled: !!card,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_card_watchers")
        .select("*")
        .eq("card_id", card!.id);
      if (error) throw error;
      return (data ?? []) as unknown as CardWatcher[];
    },
  });

  const { data: myRoles = [] } = useQuery({
    queryKey: ["my-roles", companyId, userId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("company_id", companyId!);
      return ((data ?? []) as { role: string }[]).map((r) => r.role);
    },
  });
  const isReviewer = myRoles.includes("owner") || myRoles.includes("admin");

  const [newComment, setNewComment] = useState("");
  const [newCheckText, setNewCheckText] = useState("");
  const [reviewReason, setReviewReason] = useState("");
  const [closeOpen, setCloseOpen] = useState(false);

  async function notify(userIds: string[], title: string, body: string) {
    if (!companyId || userIds.length === 0) return;
    const uniq = Array.from(new Set(userIds.filter((u) => u && u !== userId)));
    if (uniq.length === 0) return;
    await supabase.from("notifications").insert(
      uniq.map((uid) => ({
        company_id: companyId,
        user_id: uid,
        type: "production_card",
        title,
        body,
        link: `/app/producao-escritorio`,
        payload: { card_id: card!.id },
      })),
    );
  }

  function recipients(): string[] {
    const list: string[] = [];
    if (card?.assignee_id) list.push(card.assignee_id);
    for (const w of watchers) list.push(w.profile_id);
    return list;
  }

  if (!card) return null;

  async function saveField(patch: Partial<ProductionCard>) {
    const prevAssignee = card!.assignee_id;
    const { error } = await supabase
      .from("production_cards")
      .update(patch as never)
      .eq("id", card!.id);
    if (error) {
      toast.error("Erro ao salvar");
      return;
    }
    qc.invalidateQueries({ queryKey: ["production-cards", companyId] });
    if (patch.assignee_id && patch.assignee_id !== prevAssignee) {
      notify([patch.assignee_id], "Você foi atribuído a um cartão", `${card!.title}`);
    }
  }

  async function addComment() {
    if (!newComment.trim() || !companyId) return;
    const content = newComment.trim();
    const { error } = await supabase.from("production_card_comments").insert({
      company_id: companyId,
      card_id: card!.id,
      author_id: userId,
      content,
    });
    if (error) {
      toast.error("Erro ao comentar");
      return;
    }
    setNewComment("");
    qc.invalidateQueries({ queryKey: ["card-comments", card!.id] });
    await supabase.from("production_card_events").insert({
      company_id: companyId,
      card_id: card!.id,
      actor_id: userId,
      event_type: "commented",
      payload: {},
    });
    qc.invalidateQueries({ queryKey: ["card-events", card!.id] });
    notify(recipients(), `Novo comentário em "${card!.title}"`, content.slice(0, 140));
  }

  async function toggleWatcher(profileId: string) {
    if (!companyId) return;
    const existing = watchers.find((w) => w.profile_id === profileId);
    if (existing) {
      await supabase.from("production_card_watchers").delete().eq("id", existing.id);
    } else {
      await supabase.from("production_card_watchers").insert({
        company_id: companyId,
        card_id: card!.id,
        profile_id: profileId,
      });
    }
    qc.invalidateQueries({ queryKey: ["card-watchers", card!.id] });
  }

  async function logEvent(eventType: string, payload: Record<string, unknown> = {}) {
    if (!companyId) return;
    await supabase.from("production_card_events").insert({
      company_id: companyId,
      card_id: card!.id,
      actor_id: userId,
      event_type: eventType,
      payload: payload as never,
    });
    qc.invalidateQueries({ queryKey: ["card-events", card!.id] });
  }

  async function applyReview(action: "request" | "approve" | "changes" | "reject") {
    if (!companyId) return;
    const reason = reviewReason.trim();
    if ((action === "changes" || action === "reject") && !reason) {
      toast.error("Informe o motivo");
      return;
    }
    const now = new Date().toISOString();
    let newColumn: ColumnKey = card!.column_key;
    let completed_at: string | null = null;
    const flags: Record<string, unknown> = { ...(card!.status_flags ?? {}) };

    if (action === "request") {
      flags.review_status = "pending";
      flags.review_requested_by = userId;
      flags.review_requested_at = now;
      newColumn = "em_revisao";
    } else if (action === "approve") {
      flags.review_status = "approved";
      flags.review_decided_by = userId;
      flags.review_decided_at = now;
      flags.review_reason = null;
      newColumn = "concluidos";
      completed_at = now;
    } else if (action === "changes") {
      flags.review_status = "changes_requested";
      flags.review_decided_by = userId;
      flags.review_decided_at = now;
      flags.review_reason = reason;
      newColumn = "para_producao";
    } else if (action === "reject") {
      flags.review_status = "rejected";
      flags.review_decided_by = userId;
      flags.review_decided_at = now;
      flags.review_reason = reason;
      newColumn = "pendencias";
    }

    const { error } = await supabase
      .from("production_cards")
      .update({
        status_flags: flags,
        column_key: newColumn,
        completed_at: action === "approve" ? completed_at : null,
      } as never)
      .eq("id", card!.id);
    if (error) {
      toast.error("Erro ao registrar revisão");
      return;
    }

    const eventMap = {
      request: "review_requested",
      approve: "review_approved",
      changes: "review_changes_requested",
      reject: "review_rejected",
    } as const;
    await logEvent(eventMap[action], { reason: reason || undefined });

    const titleMap = {
      request: "Revisão solicitada",
      approve: "Revisão aprovada",
      changes: "Ajustes solicitados",
      reject: "Trabalho reprovado",
    } as const;
    const targets =
      action === "request"
        ? recipients()
        : [card!.assignee_id, ...watchers.map((w) => w.profile_id)];
    notify(
      targets,
      `${titleMap[action]}: ${card!.title}`,
      reason || `Status: ${String(flags.review_status)}`,
    );

    setReviewReason("");
    qc.invalidateQueries({ queryKey: ["production-cards", companyId] });
    toast.success(titleMap[action]);
  }

  async function addCheck() {
    if (!newCheckText.trim() || !companyId) return;
    const { error } = await supabase.from("production_card_checklist").insert({
      company_id: companyId,
      card_id: card!.id,
      text: newCheckText.trim(),
      position: checklist.length,
    });
    if (error) {
      toast.error("Erro ao adicionar item");
      return;
    }
    setNewCheckText("");
    qc.invalidateQueries({ queryKey: ["card-checklist", card!.id] });
  }

  async function toggleCheck(id: string, done: boolean) {
    await supabase
      .from("production_card_checklist")
      .update({ done } as never)
      .eq("id", id);
    qc.invalidateQueries({ queryKey: ["card-checklist", card!.id] });
  }

  async function removeCheck(id: string) {
    await supabase.from("production_card_checklist").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["card-checklist", card!.id] });
  }

  async function deleteCard() {
    if (
      !(await confirmDialog({
        title: "Excluir cartão",
        description: "Deseja realmente excluir este cartão? Esta ação não pode ser desfeita.",
        confirmText: "Excluir",
      }))
    )
      return;
    const { error } = await supabase.from("production_cards").delete().eq("id", card!.id);
    if (error) {
      toast.error("Erro ao excluir");
      return;
    }
    toast.success("Cartão excluído");
    qc.invalidateQueries({ queryKey: ["production-cards", companyId] });
    onClose();
  }

  const flags = (card.status_flags ?? {}) as Record<string, unknown>;
  const reviewStatus =
    typeof flags.review_status === "string" ? (flags.review_status as string) : undefined;
  const reviewReasonText =
    typeof flags.review_reason === "string" ? (flags.review_reason as string) : undefined;
  const statusBadge: Record<string, { label: string; cls: string }> = {
    pending: {
      label: "Aguardando revisão",
      cls: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
    },
    approved: {
      label: "Aprovado",
      cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/30",
    },
    changes_requested: {
      label: "Ajustes solicitados",
      cls: "bg-blue-500/10 text-blue-600 dark:text-blue-300 border-blue-500/30",
    },
    rejected: {
      label: "Reprovado",
      cls: "bg-rose-500/10 text-rose-600 dark:text-rose-300 border-rose-500/30",
    },
  };
  const canRequest =
    !reviewStatus || reviewStatus === "changes_requested" || reviewStatus === "rejected";
  const canDecide = isReviewer && reviewStatus === "pending";

  return (
    <Dialog open={!!card} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <DialogTitle className="flex-1">{card.title}</DialogTitle>
            <Badge variant="outline" className={cn(PRIORITY_STYLES[card.priority])}>
              {PRIORITY_LABEL[card.priority]}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Criado{" "}
            {formatDistanceToNow(new Date(card.created_at), { addSuffix: true, locale: ptBR })} •{" "}
            Responsável: {membersById.get(card.assignee_id) ?? "—"}
          </p>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex flex-wrap w-full h-auto">
            <TabsTrigger value="resumo">Resumo</TabsTrigger>
            <TabsTrigger value="preliminares">
              <UserCheck className="h-3.5 w-3.5 mr-1" />
              Dados Preliminares
            </TabsTrigger>
            <TabsTrigger value="questionario">
              <ClipboardList className="h-3.5 w-3.5 mr-1" />
              Questionário
            </TabsTrigger>
            <TabsTrigger value="historico">
              <History className="h-3.5 w-3.5 mr-1" />
              Histórico
            </TabsTrigger>
            <TabsTrigger value="comentarios">
              <MessageSquare className="h-3.5 w-3.5 mr-1" />
              Comentários
            </TabsTrigger>
            <TabsTrigger value="checklist">
              <ListChecks className="h-3.5 w-3.5 mr-1" />
              Checklist
            </TabsTrigger>
            <TabsTrigger value="documentos">
              <FileText className="h-3.5 w-3.5 mr-1" />
              Documentos
            </TabsTrigger>
            <TabsTrigger value="observadores">
              <Eye className="h-3.5 w-3.5 mr-1" />
              Observadores
              {watchers.length > 0 && (
                <span className="ml-1 text-[10px] bg-primary/15 text-primary rounded-full px-1.5">
                  {watchers.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="movimentacoes">Movimentações</TabsTrigger>
            <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          </TabsList>

          {/* RESUMO */}
          <TabsContent value="resumo" className="space-y-3 pt-3">
            <div className="grid grid-cols-2 gap-3">
              <FieldEdit
                label="Cliente"
                value={card.client_name_snapshot ?? ""}
                onSave={(v) => saveField({ client_name_snapshot: v || null })}
              />
              {(() => {
                const protoCols: ColumnKey[] = [
                  "para_protocolo_judicial",
                  "protocolados_adm",
                  "intermediarias",
                  "em_revisao",
                  "concluidos",
                  "arquivados",
                ];
                const canEditProc = protoCols.includes(card.column_key);
                return canEditProc ? (
                  <FieldEdit
                    label="Nº Processo"
                    value={card.process_number ?? ""}
                    onSave={(v) => saveField({ process_number: v || null })}
                  />
                ) : (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Nº Processo</label>
                    <div className="rounded-md border bg-muted/30 px-2.5 py-2 text-sm text-muted-foreground">
                      Disponível após Protocolo
                    </div>
                  </div>
                );
              })()}
              <FieldEdit
                label="Área jurídica"
                value={card.practice_area ?? ""}
                onSave={(v) => saveField({ practice_area: v || null })}
              />
              <FieldEdit
                label="Tipo de demanda"
                value={card.demand_type ?? ""}
                onSave={(v) => saveField({ demand_type: v || null })}
              />
              <div>
                <label className="text-xs font-medium text-muted-foreground">Prioridade</label>
                <Select
                  value={card.priority}
                  onValueChange={(v) => saveField({ priority: v as Priority })}
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
              <div>
                <label className="text-xs font-medium text-muted-foreground">Responsável</label>
                <Select
                  value={card.assignee_id}
                  onValueChange={(v) => saveField({ assignee_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((m) => (
                      <SelectItem key={m.user_id} value={m.user_id}>
                        {m.full_name ?? "Membro"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Prazo</label>
                <Input
                  type="date"
                  defaultValue={card.due_date ? card.due_date.slice(0, 10) : ""}
                  onBlur={(e) =>
                    saveField({
                      due_date: e.target.value ? new Date(e.target.value).toISOString() : null,
                    })
                  }
                />
              </div>
            </div>
            <FieldEdit
              label="Descrição"
              value={card.description ?? ""}
              onSave={(v) => saveField({ description: v || null })}
              multiline
            />
            <FieldEdit
              label="Observações"
              value={card.observations ?? ""}
              onSave={(v) => saveField({ observations: v || null })}
              multiline
            />

            {/* APROVAÇÃO / REVISÃO */}
            <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Aprovação</span>
                </div>
                {reviewStatus && statusBadge[reviewStatus] && (
                  <Badge
                    variant="outline"
                    className={cn("text-[10px]", statusBadge[reviewStatus].cls)}
                  >
                    {statusBadge[reviewStatus].label}
                  </Badge>
                )}
              </div>
              {reviewReasonText &&
                (reviewStatus === "changes_requested" || reviewStatus === "rejected") && (
                  <p className="text-xs text-muted-foreground italic border-l-2 border-rose-500/40 pl-2">
                    "{reviewReasonText}"
                  </p>
                )}
              {canDecide && (
                <Textarea
                  value={reviewReason}
                  onChange={(e) => setReviewReason(e.target.value)}
                  rows={2}
                  placeholder="Motivo (obrigatório para ajustes ou reprovação)..."
                  className="text-sm"
                />
              )}
              <div className="flex flex-wrap gap-2">
                {canRequest && (
                  <Button size="sm" variant="outline" onClick={() => applyReview("request")}>
                    Enviar para revisão
                  </Button>
                )}
                {canDecide && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => applyReview("approve")}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      Aprovar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => applyReview("changes")}>
                      Solicitar ajustes
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => applyReview("reject")}
                      className="text-rose-600 border-rose-500/40 hover:bg-rose-500/10"
                    >
                      Reprovar
                    </Button>
                  </>
                )}
                {reviewStatus === "pending" && !isReviewer && (
                  <p className="text-xs text-muted-foreground">
                    Aguardando aprovação de um responsável (owner/admin).
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={deleteCard}
                className="text-rose-500 hover:text-rose-600"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir cartão
              </Button>
              {card.client_id && card.column_key !== "contrato_fechado" && (
                <Button
                  size="sm"
                  onClick={() => setCloseOpen(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <FileSignature className="h-4 w-4 mr-2" />
                  Fechar contrato
                </Button>
              )}
            </div>
          </TabsContent>

          {/* DADOS PRELIMINARES */}
          <TabsContent value="preliminares" className="pt-3">
            <CardPreliminares card={card} />
          </TabsContent>

          {/* QUESTIONÁRIO */}
          <TabsContent value="questionario" className="pt-3">
            <CardQuestionnaire
              card={card}
              onSaved={() => qc.invalidateQueries({ queryKey: ["production-cards", companyId] })}
            />
          </TabsContent>

          {/* HISTORICO */}
          <TabsContent value="historico" className="pt-3">
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum evento ainda</p>
            ) : (
              <div className="space-y-3">
                {events.map((ev) => {
                  const payload = (ev.payload ?? {}) as Record<string, unknown>;
                  const from = typeof payload.from === "string" ? payload.from : "";
                  const to = typeof payload.to === "string" ? payload.to : "";
                  const reason = typeof payload.reason === "string" ? payload.reason : "";
                  const description =
                    ev.event_type === "moved"
                      ? `moveu de "${COLUMN_LABEL[from] ?? from}" para "${COLUMN_LABEL[to] ?? to}"`
                      : ev.event_type === "commented"
                        ? "comentou"
                        : ev.event_type === "review_requested"
                          ? "enviou para revisão"
                          : ev.event_type === "review_approved"
                            ? "aprovou a revisão"
                            : ev.event_type === "review_changes_requested"
                              ? `solicitou ajustes${reason ? `: "${reason}"` : ""}`
                              : ev.event_type === "review_rejected"
                                ? `reprovou${reason ? `: "${reason}"` : ""}`
                                : ev.event_type;
                  return (
                    <div key={ev.id} className="flex gap-3 text-sm">
                      <div className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0" />
                      <div className="flex-1">
                        <p>
                          <span className="font-medium">
                            {membersById.get(ev.actor_id) ?? "Alguém"}
                          </span>{" "}
                          <span className="text-muted-foreground">{description}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(ev.created_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* COMENTARIOS */}
          <TabsContent value="comentarios" className="pt-3 space-y-3">
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {comments.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Sem comentários ainda
                </p>
              )}
              {comments.map((c) => (
                <div key={c.id} className="flex gap-2">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="text-[10px]">
                      {initials(membersById.get(c.author_id))}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 bg-muted/40 rounded-lg px-3 py-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-medium text-xs">
                        {membersById.get(c.author_id) ?? "Membro"}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(c.created_at), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </span>
                    </div>
                    <p className="text-sm mt-0.5 whitespace-pre-wrap">{c.content}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-2 border-t">
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Escreva um comentário..."
                rows={2}
                className="flex-1"
              />
              <Button onClick={addComment} disabled={!newComment.trim()}>
                Enviar
              </Button>
            </div>
          </TabsContent>

          {/* CHECKLIST */}
          <TabsContent value="checklist" className="pt-3 space-y-2">
            {checklist.map((item) => (
              <div key={item.id} className="flex items-center gap-2 group">
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={(e) => toggleCheck(item.id, e.target.checked)}
                  className="h-4 w-4"
                />
                <span
                  className={cn(
                    "flex-1 text-sm",
                    item.done && "line-through text-muted-foreground",
                  )}
                >
                  {item.text}
                </span>
                <button
                  onClick={() => removeCheck(item.id)}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-rose-500"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <Input
                value={newCheckText}
                onChange={(e) => setNewCheckText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCheck()}
                placeholder="Novo item de checklist..."
              />
              <Button onClick={addCheck} disabled={!newCheckText.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="documentos" className="pt-3">
            <CardDocuments cardId={card.id} companyId={companyId} userId={userId} />
          </TabsContent>
          <TabsContent value="observadores" className="pt-3 space-y-2">
            <p className="text-xs text-muted-foreground">
              Observadores recebem notificações de comentários, movimentações e mudanças neste
              cartão.
            </p>
            <div className="space-y-1 max-h-[360px] overflow-y-auto">
              {members.map((mem) => {
                const isWatching = watchers.some((w) => w.profile_id === mem.user_id);
                return (
                  <button
                    key={mem.user_id}
                    onClick={() => toggleWatcher(mem.user_id)}
                    className={cn(
                      "w-full flex items-center gap-2 rounded-md border px-2.5 py-2 text-left transition-colors",
                      isWatching ? "border-primary/40 bg-primary/5" : "hover:bg-accent/40",
                    )}
                  >
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="text-[10px]">
                        {initials(mem.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="flex-1 text-sm">{mem.full_name ?? "Membro"}</span>
                    {isWatching ? (
                      <Badge
                        variant="outline"
                        className="border-primary/40 text-primary text-[10px]"
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        Observando
                      </Badge>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">Adicionar</span>
                    )}
                  </button>
                );
              })}
            </div>
          </TabsContent>
          <TabsContent value="movimentacoes" className="pt-3">
            <CardMovimentacoes
              card={card}
              companyId={companyId}
              onLink={(caseId, snapshot) =>
                saveField({
                  case_id: caseId,
                  process_number: caseId
                    ? (snapshot.cnj_number ?? card.process_number)
                    : card.process_number,
                  practice_area: caseId
                    ? (snapshot.practice_area ?? card.practice_area)
                    : card.practice_area,
                  client_id: caseId ? (snapshot.client_id ?? card.client_id) : card.client_id,
                })
              }
            />
          </TabsContent>
          <TabsContent value="financeiro" className="pt-3">
            <CardFinanceiro card={card} companyId={companyId} userId={userId} />
          </TabsContent>
        </Tabs>
      </DialogContent>
      <CloseContractDialog
        card={card}
        open={closeOpen}
        onOpenChange={setCloseOpen}
        companyId={companyId}
      />
    </Dialog>
  );
}
