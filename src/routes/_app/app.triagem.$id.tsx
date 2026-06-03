import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Briefcase,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileUp,
  Loader2,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import {
  decideTriageDestination,
  getTriageDetailAdmin,
  listTriageActivitiesAdmin,
  pauseTriageAttendance,
  startTriageAttendance,
  updateLawyerTriage,
} from "@/lib/triagem-flow.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useActiveCompany } from "@/hooks/use-active-company";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import type { TriageDetail } from "@/features/triagem/types";
import {
  fmtDateTime,
  triagePriorityClass,
  triagePriorityLabels,
  triageStatusClass,
  triageStatusLabels,
} from "@/features/triagem/utils";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/app/triagem/$id")({
  component: TriageDetailPage,
});

type Activity = {
  id: string;
  action: string;
  entity_label: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

type TriageDocument = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
};

type TriageDecisionAction =
  | "request_documents"
  | "archive"
  | "convert_client"
  | "create_contract"
  | "create_finance"
  | "create_case"
  | "create_card"
  | "send_contract"
  | "schedule_return";

function parseLawyerAttendance(notes?: string | null) {
  if (!notes) return {} as Record<string, unknown>;
  try {
    const parsed = JSON.parse(notes);
    const attendance = parsed?.lawyer_attendance;
    return attendance && typeof attendance === "object"
      ? (attendance as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function textFrom(value: unknown) {
  return typeof value === "string" ? value : "";
}

function TriageDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { companyId } = useActiveCompany();
  const qc = useQueryClient();
  const detailFn = useServerFn(getTriageDetailAdmin);
  const activityFn = useServerFn(listTriageActivitiesAdmin);
  const decisionFn = useServerFn(decideTriageDestination);
  const startFn = useServerFn(startTriageAttendance);
  const pauseFn = useServerFn(pauseTriageAttendance);
  const saveFn = useServerFn(updateLawyerTriage);
  const [activeTab, setActiveTab] = useState("summary");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [lawyer, setLawyer] = useState({
    lawyer_client_report: "",
    legal_analysis: "",
    lawyer_notes: "",
    legal_guidance: "",
    presented_documents: "",
    pending_documents_text: "",
    urgency_level: "",
    case_viability: "",
    next_steps: "",
    lawyer_id: "",
    recommended_action: "",
    internal_notes: "",
  });
  const [pendingDocuments, setPendingDocuments] = useState("");
  const [archiveReason, setArchiveReason] = useState("");
  const [conversionValue, setConversionValue] = useState("");
  const [financeDueDate, setFinanceDueDate] = useState("");
  const [returnAt, setReturnAt] = useState("");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentName, setDocumentName] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { data: triage, isLoading } = useQuery({
    queryKey: ["triage-detail", companyId, id],
    enabled: !!companyId && !!id,
    staleTime: 20_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const row = (await detailFn({
        data: { companyId: companyId!, triagemId: id },
      })) as unknown as TriageDetail;
      const attendance = parseLawyerAttendance(row.notes);
      const savedPendingDocuments =
        textFrom(attendance.pending_documents_text) || (row.pending_documents ?? []).join("\n");
      setLawyer({
        lawyer_client_report: textFrom(attendance.lawyer_client_report),
        legal_analysis: row.legal_analysis ?? "",
        lawyer_notes: row.lawyer_notes ?? "",
        legal_guidance: textFrom(attendance.legal_guidance),
        presented_documents: textFrom(attendance.presented_documents),
        pending_documents_text: savedPendingDocuments,
        urgency_level: textFrom(attendance.urgency_level) || row.priority || "",
        case_viability: row.legal_viability ?? textFrom(attendance.case_viability),
        next_steps: textFrom(attendance.next_steps),
        lawyer_id: textFrom(attendance.lawyer_id) || row.assigned_to || user?.id || "",
        recommended_action: row.recommended_action ?? "",
        internal_notes: row.internal_notes ?? "",
      });
      setPendingDocuments(savedPendingDocuments);
      setArchiveReason(row.archived_reason ?? "");
      return row;
    },
  });

  const { data: activities = [] } = useQuery({
    queryKey: ["triage-activity", companyId, id],
    enabled: !!companyId && !!id,
    staleTime: 30_000,
    queryFn: async () => {
      return (await activityFn({
        data: { companyId: companyId!, triagemId: id },
      })) as Activity[];
    },
  });

  const { data: documents = [] } = useQuery({
    queryKey: ["triage-documents", companyId, id],
    enabled: !!companyId && !!id,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("id, name, description, category, storage_path, mime_type, size_bytes, created_at")
        .eq("company_id", companyId!)
        .eq("triagem_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TriageDocument[];
    },
  });

  useEffect(() => {
    if (!triage?.started_at) {
      setElapsedSeconds(0);
      return;
    }

    const startedAt = new Date(triage.started_at).getTime();
    const finishedAt = triage.finished_at ? new Date(triage.finished_at).getTime() : null;
    const calculateElapsed = () =>
      Math.max(0, Math.floor(((finishedAt ?? Date.now()) - startedAt) / 1000));

    setElapsedSeconds(calculateElapsed());
    if (finishedAt) return;

    const intervalId = window.setInterval(() => {
      setElapsedSeconds(calculateElapsed());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [triage?.finished_at, triage?.started_at]);

  const buildLawyerPayload = (
    status?: "waiting_documents" | "converted" | "archived" | "attendance_finished",
  ) => ({
    triagemId: id,
    lawyer_client_report: lawyer.lawyer_client_report,
    lawyer_notes: lawyer.lawyer_notes,
    legal_analysis: lawyer.legal_analysis,
    legal_guidance: lawyer.legal_guidance,
    presented_documents: lawyer.presented_documents,
    pending_documents_text: lawyer.pending_documents_text || pendingDocuments,
    urgency_level: lawyer.urgency_level,
    case_viability: lawyer.case_viability,
    legal_viability: lawyer.case_viability,
    next_steps: lawyer.next_steps,
    lawyer_id: lawyer.lawyer_id || user?.id || null,
    recommended_action: lawyer.recommended_action,
    internal_notes: lawyer.internal_notes,
    status,
  });

  const startMut = useMutation({
    mutationFn: () => startFn({ data: { triagemId: id } }),
    onSuccess: () => {
      toast.success("Atendimento iniciado");
      setActiveTab("attendance");
      setLawyer((previous) => ({
        ...previous,
        urgency_level: previous.urgency_level || triage?.priority || "",
        lawyer_id: previous.lawyer_id || user?.id || "",
      }));
      qc.invalidateQueries({ queryKey: ["triage-detail", companyId, id] });
      qc.invalidateQueries({ queryKey: ["triagens", companyId] });
    },
    onError: (e: Error) => toast.error("Erro ao iniciar atendimento", { description: e.message }),
  });

  const pauseMut = useMutation({
    mutationFn: async () => {
      await saveFn({ data: buildLawyerPayload("attendance_finished") });
      return pauseFn({ data: { triagemId: id } });
    },
    onSuccess: (result) => {
      toast.success("Atendimento finalizado", {
        description: `Tempo da consulta: ${formatDuration(result.durationSeconds)}`,
      });
      qc.invalidateQueries({ queryKey: ["triage-detail", companyId, id] });
      qc.invalidateQueries({ queryKey: ["triage-activity", companyId, id] });
      qc.invalidateQueries({ queryKey: ["triagens", companyId] });
    },
    onError: (e: Error) => toast.error("Erro ao finalizar atendimento", { description: e.message }),
  });

  const saveMut = useMutation({
    mutationFn: (status?: "waiting_documents" | "converted" | "archived") =>
      saveFn({ data: buildLawyerPayload(status) }),
    onSuccess: () => {
      toast.success("Atendimento salvo com sucesso");
      qc.invalidateQueries({ queryKey: ["triage-detail", companyId, id] });
      qc.invalidateQueries({ queryKey: ["triage-activity", companyId, id] });
      qc.invalidateQueries({ queryKey: ["triagens", companyId] });
    },
    onError: (e: Error) => toast.error("Erro ao salvar", { description: e.message }),
  });

  const decisionMut = useMutation({
    mutationFn: (action: TriageDecisionAction) => {
      const value = conversionValue ? Number(conversionValue) : undefined;
      return decisionFn({
        data: {
          triagemId: id,
          action,
          pending_documents: pendingDocuments,
          reason: archiveReason,
          contract_value: value,
          financial_amount: value,
          due_date: financeDueDate || null,
          return_at: returnAt || null,
          case_title: `Ação ${triage?.practice_area || "jurídica"} - ${triage?.contact_name || "Cliente"}`,
          card_title: `Produzir demanda - ${triage?.contact_name || "Cliente"}`,
        },
      });
    },
    onSuccess: (result) => {
      toast.success("Decisão da triagem salva");
      qc.invalidateQueries({ queryKey: ["triage-detail", companyId, id] });
      qc.invalidateQueries({ queryKey: ["triage-activity", companyId, id] });
      qc.invalidateQueries({ queryKey: ["triagens", companyId] });
      if (result.link && result.link !== `/app/triagem/${id}`) {
        navigate({ to: result.link });
      }
    },
    onError: (e: Error) =>
      toast.error("Erro ao decidir destino da triagem", { description: e.message }),
  });

  const uploadDocumentMut = useMutation({
    mutationFn: async () => {
      if (!companyId || !user) throw new Error("Sessao invalida");
      if (!documentFile) throw new Error("Selecione um arquivo");
      const file = documentFile;
      const safeName = file.name.replace(/[^\w.-]+/g, "_");
      const path = `${companyId}/triagens/${id}/${crypto.randomUUID()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from("documents").insert({
        company_id: companyId,
        uploaded_by: user.id,
        client_id: triage?.client_id ?? null,
        triagem_id: id,
        name: documentName.trim() || file.name,
        description: `Documento anexado pela triagem ${id}`,
        category: "Triagem",
        scope: "triagem",
        storage_path: path,
        mime_type: file.type || null,
        size_bytes: file.size,
      } as never);

      if (insertError) {
        await supabase.storage.from("documents").remove([path]);
        throw insertError;
      }

      await supabase.from("activity_logs").insert({
        company_id: companyId,
        user_id: user.id,
        action: "triage_document_attached",
        entity_type: "triagem",
        entity_id: id,
        entity_label: triage?.contact_name ?? null,
        metadata: { storage_path: path, name: documentName.trim() || file.name },
      } as never);
    },
    onSuccess: () => {
      toast.success("Documento anexado com sucesso");
      setDocumentFile(null);
      setDocumentName("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["triage-documents", companyId, id] });
    },
    onError: (e: Error) => toast.error("Erro ao anexar documento", { description: e.message }),
  });

  const deleteDocumentMut = useMutation({
    mutationFn: async (doc: TriageDocument) => {
      const { error: storageError } = await supabase.storage
        .from("documents")
        .remove([doc.storage_path]);
      if (storageError) throw storageError;
      const { error } = await supabase.from("documents").delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Documento excluido");
      qc.invalidateQueries({ queryKey: ["triage-documents", companyId, id] });
    },
    onError: (e: Error) => toast.error("Erro ao excluir documento", { description: e.message }),
  });

  async function openDocument(doc: TriageDocument) {
    const { data, error } = await supabase.storage
      .from("documents")
      .createSignedUrl(doc.storage_path, 60);
    if (error || !data?.signedUrl) {
      toast.error("Nao foi possivel abrir o documento", { description: error?.message });
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  if (isLoading || !triage) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <Skeleton className="h-20" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const suggestedPendingDocs = parseList(triage.ai_classification?.required_documents);
  const savedPendingDocs = (triage.pending_documents ?? []).filter(Boolean);
  const pendingDocs = savedPendingDocs.length ? savedPendingDocs : suggestedPendingDocs;
  const nextSteps = parseList(triage.ai_classification?.next_steps);
  const attendanceStarted = Boolean(triage.started_at);
  const attendancePaused = Boolean(triage.started_at && triage.finished_at);
  const attendanceRunning = Boolean(triage.started_at && !triage.finished_at);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <Link
            to="/app/triagem"
            className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar para triagens
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {triage.contact_name || "Triagem"}
            </h1>
            <Badge variant="outline" className={cn(triageStatusClass[triage.status])}>
              {triageStatusLabels[triage.status]}
            </Badge>
            <Badge variant="outline" className={cn(triagePriorityClass[triage.priority])}>
              {triagePriorityLabels[triage.priority]}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {triage.practice_area || "Área não definida"} ·{" "}
            {triage.demand_type || "Demanda não definida"} · Criada em{" "}
            {fmtDateTime(triage.created_at)}
          </p>
        </div>
        <div className="flex flex-col items-start gap-3 md:items-end">
          {attendanceStarted && (
            <div className="rounded-xl border bg-muted/25 px-4 py-3 text-left md:text-right">
              <p className="text-xs font-medium uppercase text-muted-foreground">
                Tempo da consulta
              </p>
              <p className="font-mono text-2xl font-semibold tracking-tight">
                {formatDuration(elapsedSeconds)}
              </p>
              {attendancePaused && (
                <p className="text-xs text-muted-foreground">
                  Atendimento finalizado em {fmtDateTime(triage.finished_at)}
                </p>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {!attendanceStarted && (
              <Button disabled={startMut.isPending} onClick={() => startMut.mutate()}>
                <Clock className="mr-2 h-4 w-4" /> Iniciar atendimento
              </Button>
            )}
            {attendanceRunning && (
              <Button
                variant="outline"
                disabled={pauseMut.isPending}
                onClick={() => pauseMut.mutate()}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" /> Finalizar atendimento
              </Button>
            )}
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="summary">Resumo para advogado</TabsTrigger>
          <TabsTrigger value="client">Dados do cliente</TabsTrigger>
          <TabsTrigger value="legal">Informações jurídicas</TabsTrigger>
          <TabsTrigger value="documents">Documentos</TabsTrigger>
          <TabsTrigger value="attendance">Atendimento do advogado</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="summary">
          <Panel icon={Briefcase} title="Resumo objetivo">
            <Info label="Relato do cliente" value={triage.raw_description} />
            <Info
              label="Observações da secretária"
              value={triage.secretary_notes || triage.observations}
            />
            <Info
              label="Documentos apresentados"
              value={pendingDocs.length ? pendingDocs.join(", ") : "Ainda não informados"}
            />
            <Info
              label="Pendências"
              value={pendingDocs.length ? pendingDocs.join("\n") : "Sem pendências registradas"}
            />
            <Info label="Urgência" value={triagePriorityLabels[triage.priority]} />
            <Info
              label="Próximos passos sugeridos"
              value={nextSteps.length ? nextSteps.join("\n") : triage.recommended_action}
            />
          </Panel>
        </TabsContent>

        <TabsContent value="client">
          <Panel icon={UserRound} title="Dados do cliente">
            <Grid>
              <Info label="Nome" value={triage.contact_name} />
              <Info label="CPF/CNPJ" value={triage.document} />
              <Info label="Telefone" value={triage.contact_phone} />
              <Info label="E-mail" value={triage.contact_email} />
              <Info label="Endereço" value={triage.address} />
              <Info label="Cidade" value={triage.city} />
            </Grid>
          </Panel>
        </TabsContent>

        <TabsContent value="legal">
          <Panel icon={Briefcase} title="Informações jurídicas">
            <Grid>
              <Info label="Área do direito" value={triage.practice_area} />
              <Info label="Tipo de demanda" value={triage.demand_type} />
              <Info
                label="Parte contrária"
                value={String(triage.ai_classification?.opposing_party ?? "Não informado")}
              />
              <Info
                label="Número de processo"
                value={String(triage.ai_classification?.process_number ?? "Não informado")}
              />
              <Info label="Urgência" value={triagePriorityLabels[triage.priority]} />
            </Grid>
            <Info label="Descrição completa" value={triage.raw_description} />
          </Panel>
        </TabsContent>

        <TabsContent value="documents">
          <Panel icon={FileUp} title="Documentos">
            <div className="rounded-lg border border-dashed p-4">
              <Label>Upload de documento</Label>
              <div className="mt-2 grid gap-2 md:grid-cols-[1fr_auto]">
                <Input
                  ref={fileInputRef}
                  type="file"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    setDocumentFile(file);
                    if (file && !documentName) setDocumentName(file.name);
                  }}
                />
                <Button
                  disabled={uploadDocumentMut.isPending || !documentFile}
                  onClick={() => uploadDocumentMut.mutate()}
                >
                  {uploadDocumentMut.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileUp className="mr-2 h-4 w-4" />
                  )}
                  Anexar
                </Button>
              </div>
              <Input
                className="mt-2"
                value={documentName}
                onChange={(e) => setDocumentName(e.target.value)}
                placeholder="Nome do documento"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Estrutura pronta para Supabase Storage; liberação depende da coluna de vínculo da
                triagem em documents.
              </p>
            </div>
            {documents.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum documento anexado nesta triagem.
              </p>
            ) : (
              <div className="space-y-2">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex flex-col gap-3 rounded-lg border p-3 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium">{doc.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {doc.category || "Triagem"} - {fmtDateTime(doc.created_at)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => openDocument(doc)}>
                        <Eye className="mr-2 h-4 w-4" /> Preview
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openDocument(doc)}>
                        <Download className="mr-2 h-4 w-4" /> Download
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-rose-600 hover:text-rose-700"
                        disabled={deleteDocumentMut.isPending}
                        onClick={() => deleteDocumentMut.mutate(doc)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Excluir
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Info
              label="Documentos pendentes"
              value={pendingDocs.join("\n") || "Nenhum pendente"}
            />
          </Panel>
        </TabsContent>

        <TabsContent value="attendance">
          <Panel icon={CheckCircle2} title="Atendimento do advogado">
            <div className="rounded-xl border bg-muted/25 p-4">
              <div className="mb-4">
                <p className="text-sm font-semibold">Dados da Triagem</p>
                <p className="text-sm text-muted-foreground">
                  Informacoes registradas pela secretaria para consulta do advogado.
                </p>
              </div>
              <Grid>
                <Info label="Cliente" value={triage.contact_name} />
                <Info label="Telefone" value={triage.contact_phone} />
                <Info label="Area juridica" value={triage.practice_area} />
                <Info label="Data da triagem" value={fmtDateTime(triage.created_at)} />
              </Grid>
              <Info label="Relato inicial" value={triage.raw_description} />
              <Info
                label="Observacoes da secretaria"
                value={triage.secretary_notes || triage.observations}
              />
              <Info
                label="Documentos informados"
                value={pendingDocs.length ? pendingDocs.join("\n") : "Ainda nao informados"}
              />
            </div>
            {attendanceStarted && (
              <div className="rounded-xl border bg-primary/5 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-medium">CronÃ´metro do atendimento</p>
                    <p className="text-sm text-muted-foreground">
                      {attendancePaused
                        ? "Atendimento finalizado. O tempo total ficou registrado nesta triagem."
                        : "Consulta em andamento. Finalize ao concluir o atendimento presencial."}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-2xl font-semibold">
                      {formatDuration(elapsedSeconds)}
                    </span>
                    {attendanceRunning && (
                      <Button
                        variant="outline"
                        disabled={pauseMut.isPending}
                        onClick={() => pauseMut.mutate()}
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" /> Finalizar atendimento
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
            <div className="rounded-xl border bg-background p-4">
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold">Anamnese juridica do cliente</p>
                  <p className="text-sm text-muted-foreground">
                    Preencha e salve os dados reais do atendimento sem duplicar a triagem.
                  </p>
                </div>
                {attendancePaused ? (
                  <Badge variant="outline">Atendimento finalizado</Badge>
                ) : attendanceRunning ? (
                  <Badge className="bg-emerald-600 text-white">Em atendimento</Badge>
                ) : (
                  <Badge variant="outline">Aguardando inicio</Badge>
                )}
              </div>
              <div className="space-y-4">
                <TextArea
                  label="Relato detalhado do cliente"
                  value={lawyer.lawyer_client_report}
                  onChange={(v) => setLawyer((p) => ({ ...p, lawyer_client_report: v }))}
                />
                <TextArea
                  label="Observacoes do advogado"
                  value={lawyer.lawyer_notes}
                  onChange={(v) => setLawyer((p) => ({ ...p, lawyer_notes: v }))}
                />
                <TextArea
                  label="Analise juridica"
                  value={lawyer.legal_analysis}
                  onChange={(v) => setLawyer((p) => ({ ...p, legal_analysis: v }))}
                />
                <TextArea
                  label="Orientacao dada ao cliente"
                  value={lawyer.legal_guidance}
                  onChange={(v) => setLawyer((p) => ({ ...p, legal_guidance: v }))}
                />
                <div className="grid gap-4 md:grid-cols-2">
                  <TextArea
                    label="Documentos apresentados"
                    value={lawyer.presented_documents}
                    onChange={(v) => setLawyer((p) => ({ ...p, presented_documents: v }))}
                  />
                  <TextArea
                    label="Documentos pendentes"
                    value={lawyer.pending_documents_text}
                    onChange={(v) => {
                      setLawyer((p) => ({ ...p, pending_documents_text: v }));
                      setPendingDocuments(v);
                    }}
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <SelectField
                    label="Urgencia do caso"
                    value={lawyer.urgency_level}
                    onChange={(value) => setLawyer((p) => ({ ...p, urgency_level: value }))}
                    options={[
                      ["", "Selecione"],
                      ["low", "Baixa"],
                      ["medium", "Media"],
                      ["high", "Alta"],
                      ["urgent", "Urgente"],
                    ]}
                  />
                  <SelectField
                    label="Viabilidade do caso"
                    value={lawyer.case_viability}
                    onChange={(value) => setLawyer((p) => ({ ...p, case_viability: value }))}
                    options={[
                      ["", "Selecione"],
                      ["viavel", "Viavel"],
                      ["parcialmente_viavel", "Parcialmente viavel"],
                      ["inviavel", "Inviavel"],
                      ["precisa_analise", "Precisa de analise"],
                    ]}
                  />
                </div>
                <TextArea
                  label="Proximos passos"
                  value={lawyer.next_steps}
                  onChange={(v) => setLawyer((p) => ({ ...p, next_steps: v }))}
                />
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Proxima acao</Label>
                    <select
                      value={lawyer.recommended_action}
                      onChange={(e) =>
                        setLawyer((p) => ({ ...p, recommended_action: e.target.value }))
                      }
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="">Selecione</option>
                      <option value="solicitar_documentos">Solicitar documentos</option>
                      <option value="arquivar">Arquivar</option>
                      <option value="marcar_convertida">Marcar convertida</option>
                      <option value="criar_processo">Criar processo</option>
                      <option value="agendar_retorno">Agendar retorno</option>
                      <option value="enviar_contrato">Enviar contrato</option>
                      <option value="aguardando_decisao_cliente">
                        Aguardando decisao do cliente
                      </option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Responsavel pelo atendimento</Label>
                    <Input
                      value={user?.email || lawyer.lawyer_id || "Usuario logado"}
                      readOnly
                      className="bg-muted/40"
                    />
                  </div>
                </div>
                <TextArea
                  label="Observacoes internas"
                  value={lawyer.internal_notes}
                  onChange={(v) => setLawyer((p) => ({ ...p, internal_notes: v }))}
                />
              </div>
              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={() => setActiveTab("summary")}>
                  Cancelar
                </Button>
                <Button
                  variant="outline"
                  disabled={saveMut.isPending}
                  onClick={() => saveMut.mutate(undefined)}
                >
                  {saveMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar atendimento
                </Button>
                <Button
                  disabled={!attendanceStarted || attendancePaused || pauseMut.isPending}
                  onClick={() => pauseMut.mutate()}
                >
                  {pauseMut.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                  )}
                  Finalizar atendimento
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Valor para contrato/financeiro, se houver</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={conversionValue}
                onChange={(e) => setConversionValue(e.target.value)}
                placeholder="Ex: 3000"
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Vencimento do financeiro</Label>
                <Input
                  type="date"
                  value={financeDueDate}
                  onChange={(e) => setFinanceDueDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Data e hora do retorno</Label>
                <Input
                  type="datetime-local"
                  value={returnAt}
                  onChange={(e) => setReturnAt(e.target.value)}
                />
              </div>
            </div>
            <p className="rounded-lg bg-muted/35 p-3 text-xs text-muted-foreground">
              Salvar analise registra os campos acima. Os botoes abaixo executam a decisao no banco:
              criam contrato, financeiro, processo, card, retorno ou mudam o status da triagem.
            </p>
            <TextArea
              label="Motivo do arquivamento"
              value={archiveReason}
              onChange={setArchiveReason}
            />
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                disabled={decisionMut.isPending}
                onClick={() => decisionMut.mutate("request_documents")}
              >
                Solicitar documentos
              </Button>
              <Button
                variant="outline"
                disabled={decisionMut.isPending}
                onClick={() => decisionMut.mutate("archive")}
              >
                Arquivar
              </Button>
              <Button
                variant="outline"
                disabled={decisionMut.isPending}
                onClick={() => decisionMut.mutate("convert_client")}
              >
                Marcar convertida
              </Button>
              <Button
                variant="outline"
                disabled={decisionMut.isPending}
                onClick={() => decisionMut.mutate("create_contract")}
              >
                Criar contrato
              </Button>
              <Button
                variant="outline"
                disabled={decisionMut.isPending}
                onClick={() => decisionMut.mutate("send_contract")}
              >
                Enviar contrato
              </Button>
              <Button
                variant="outline"
                disabled={decisionMut.isPending}
                onClick={() => decisionMut.mutate("create_finance")}
              >
                Criar financeiro
              </Button>
              <Button
                variant="outline"
                disabled={decisionMut.isPending}
                onClick={() => decisionMut.mutate("create_case")}
              >
                Criar processo
              </Button>
              <Button
                variant="outline"
                disabled={decisionMut.isPending}
                onClick={() => decisionMut.mutate("schedule_return")}
              >
                Agendar retorno
              </Button>
              <Button
                disabled={decisionMut.isPending}
                onClick={() => decisionMut.mutate("create_card")}
              >
                Criar card de producao
              </Button>
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="history">
          <Panel icon={Clock} title="Histórico">
            <div className="space-y-3">
              {activities.map((a) => (
                <div key={a.id} className="rounded-lg border p-3">
                  <p className="text-sm font-medium">{formatAction(a.action)}</p>
                  <p className="text-xs text-muted-foreground">{fmtDateTime(a.created_at)}</p>
                </div>
              ))}
            </div>
          </Panel>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Panel({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Briefcase;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
      <h2 className="flex items-center gap-2 font-semibold">
        <Icon className="h-4 w-4 text-primary" /> {title}
      </h2>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-2">{children}</div>;
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm">{value || "Não informado"}</p>
    </div>
  );
}

function TextArea({
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
      <Textarea rows={5} value={value} onChange={(e) => onChange(e.target.value)} />
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
  options: Array<[string, string]>;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue || "empty"} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </div>
  );
}

function parseList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function formatAction(action: string) {
  const labels: Record<string, string> = {
    triage_sent_to_lawyer: "Triagem enviada para advogado",
    triage_attendance_started: "Atendimento iniciado",
    triage_attendance_paused: "Atendimento finalizado",
    triage_attendance_finished: "Atendimento finalizado",
    triage_lawyer_updated: "Análise jurídica atualizada",
    triage_converted: "Triagem convertida",
    triage_documents_requested: "Documentos solicitados",
    triage_archived: "Triagem arquivada",
    triage_converted_to_case: "Triagem convertida em processo",
    triage_converted_to_contract: "Contrato criado pela triagem",
    triage_contract_sent: "Contrato enviado pela triagem",
    triage_converted_to_finance: "Financeiro criado pela triagem",
    triage_converted_to_card: "Card de produção criado pela triagem",
    triage_return_scheduled: "Retorno agendado",
    triage_document_attached: "Documento anexado",
  };
  return labels[action] ?? action;
}

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}
