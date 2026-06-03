import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const TriagemSchema = z.object({
  contact_name: z.string().trim().min(2).max(160),
  client_id: z.string().uuid().optional().nullable(),
  document: z.string().trim().max(24).optional().nullable(),
  cpf: z.string().trim().max(20).optional().nullable(),
  contact_phone: z.string().trim().max(40).optional().nullable(),
  contact_email: z.string().trim().email().max(160).optional().nullable().or(z.literal("")),
  city: z.string().trim().max(120).optional().nullable(),
  address: z.string().trim().max(300).optional().nullable(),
  observations: z.string().trim().max(4000).optional().nullable(),
  practice_area: z.string().trim().max(80).optional().nullable(),
  demand_type: z.string().trim().max(120).optional().nullable(),
  benefit_type: z.string().trim().max(80).optional().nullable(),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  origin: z.string().trim().max(80).optional().nullable(),
  secretary_notes: z.string().trim().max(4000).optional().nullable(),
  scheduled_at: z.string().datetime().optional().nullable(),
  gov_password: z.string().trim().max(200).optional().nullable(),
  inss_password: z.string().trim().max(200).optional().nullable(),
  assigned_lawyer_id: z.string().uuid().optional().nullable(),
  assigned_to: z.string().uuid().optional().nullable(),
  raw_description: z.string().trim().max(8000).optional().nullable(),
  dynamic_fields: z.record(z.string(), z.unknown()).optional().nullable(),
});

function isMissingClientsTable(error: { code?: string; message?: string } | null) {
  const message = error?.message?.toLowerCase() ?? "";
  return (
    error?.code === "42P01" ||
    (message.includes("clients") &&
      (message.includes("schema cache") || message.includes("does not exist")))
  );
}

export const createTriagemWithFlow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => TriagemSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("active_company_id")
      .eq("id", userId)
      .maybeSingle();
    const companyId = profile?.active_company_id;
    if (!companyId) throw new Error("Empresa ativa não encontrada");

    const assignee = data.assigned_lawyer_id ?? data.assigned_to ?? userId;
    const document = data.document ?? data.cpf ?? null;
    const demandType = data.demand_type ?? data.benefit_type ?? null;

    let clientId = data.client_id ?? null;
    if (!clientId) {
      const { data: clientRow, error: cErr } = await supabaseAdmin
        .from("clients")
        .insert({
          company_id: companyId,
          created_by: userId,
          name: data.contact_name,
          client_type: "individual",
          document,
          phone: data.contact_phone ?? null,
          email: data.contact_email || null,
          address: data.address ?? null,
          city: data.city ?? null,
          is_provisional: true,
        } as never)
        .select("id")
        .single();
      if (cErr && isMissingClientsTable(cErr)) {
        clientId = null;
      } else {
        if (cErr) throw new Error(`Cliente provisório: ${cErr.message}`);
        clientId = (clientRow as { id: string }).id;
      }
    }

    // 2) Triagem
    const { data: triagemRow, error: tErr } = await supabaseAdmin
      .from("triagens")
      .insert({
        company_id: companyId,
        created_by: userId,
        client_id: clientId,
        contact_name: data.contact_name,
        contact_phone: data.contact_phone ?? null,
        contact_email: data.contact_email || null,
        cpf: document,
        document,
        city: data.city ?? null,
        address: data.address ?? null,
        observations: data.observations ?? null,
        secretary_notes: data.secretary_notes ?? data.observations ?? null,
        practice_area: data.practice_area ?? null,
        benefit_type: demandType,
        demand_type: demandType,
        priority: data.priority,
        origin: data.origin ?? null,
        scheduled_at: data.scheduled_at ?? null,
        assigned_to: assignee,
        raw_description:
          data.raw_description ?? data.observations ?? `Triagem recebida — ${data.contact_name}`,
        status: "waiting_lawyer",
        notes: data.dynamic_fields ? JSON.stringify(data.dynamic_fields) : null,
      } as never)
      .select("id")
      .single();
    if (tErr) throw new Error(`Triagem: ${tErr.message}`);
    const triagemId = (triagemRow as { id: string }).id;

    // 2b) Credenciais sensíveis em tabela separada (RLS owner/admin/autor)
    if (data.gov_password || data.inss_password) {
      const { error: credErr } = await supabaseAdmin.from("triagem_credentials").insert({
        triagem_id: triagemId,
        company_id: companyId,
        created_by: userId,
        gov_password: data.gov_password ?? null,
        inss_password: data.inss_password ?? null,
      } as never);
      if (credErr && credErr.code !== "42P01") {
        throw new Error(`Credenciais da triagem: ${credErr.message}`);
      }
    }

    await supabaseAdmin.from("notifications").insert({
      company_id: companyId,
      user_id: assignee,
      type: "triage_assigned",
      title: "Nova triagem aguardando sua análise",
      body: `Cliente ${data.contact_name} está aguardando atendimento`,
      link: `/app/triagem/${triagemId}`,
      payload: { triagem_id: triagemId, priority: data.priority },
    } as never);

    await supabaseAdmin.from("activity_logs").insert({
      company_id: companyId,
      user_id: userId,
      action: "triage_sent_to_lawyer",
      entity_type: "triagem",
      entity_id: triagemId,
      entity_label: data.contact_name,
      metadata: { practice_area: data.practice_area ?? null, demand_type: demandType, assignee },
    } as never);

    return { triagemId, clientId };
  });

const TriageActionSchema = z.object({
  triagemId: z.string().uuid(),
});

const TriageDetailSchema = z.object({
  companyId: z.string().uuid(),
  triagemId: z.string().uuid(),
});

const TriageListSchema = z.object({
  companyId: z.string().uuid(),
  tab: z
    .enum([
      "all",
      "waiting_lawyer",
      "mine",
      "in_attendance",
      "attendance_finished",
      "waiting_documents",
      "converted",
      "archived",
    ])
    .default("all"),
  q: z.string().trim().max(120).optional().default(""),
});

const TriageEditSchema = z.object({
  triagemId: z.string().uuid(),
  contact_name: z.string().trim().min(2).max(160),
  contact_phone: z.string().trim().max(40).optional().nullable(),
  contact_email: z.string().trim().email().max(160).optional().nullable().or(z.literal("")),
  document: z.string().trim().max(24).optional().nullable(),
  city: z.string().trim().max(120).optional().nullable(),
  address: z.string().trim().max(300).optional().nullable(),
  practice_area: z.string().trim().max(80).optional().nullable(),
  demand_type: z.string().trim().max(120).optional().nullable(),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  origin: z.string().trim().max(80).optional().nullable(),
  raw_description: z.string().trim().max(8000).optional().nullable(),
  observations: z.string().trim().max(4000).optional().nullable(),
  secretary_notes: z.string().trim().max(4000).optional().nullable(),
  assigned_to: z.string().uuid().optional().nullable().or(z.literal("")),
});

const TriageDecisionSchema = z.object({
  triagemId: z.string().uuid(),
  action: z.enum([
    "request_documents",
    "archive",
    "convert_client",
    "create_contract",
    "send_contract",
    "create_finance",
    "create_case",
    "create_card",
    "schedule_return",
  ]),
  reason: z.string().trim().max(1000).optional().nullable(),
  pending_documents: z.string().trim().max(4000).optional().nullable(),
  contract_value: z.number().nonnegative().optional().nullable(),
  financial_amount: z.number().nonnegative().optional().nullable(),
  due_date: z.string().optional().nullable(),
  return_at: z.string().optional().nullable(),
  case_title: z.string().trim().max(200).optional().nullable(),
  cnj_number: z.string().trim().max(80).optional().nullable(),
  card_title: z.string().trim().max(200).optional().nullable(),
});

async function getActiveCompanyId(userId: string) {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("active_company_id")
    .eq("id", userId)
    .maybeSingle();
  if (!profile?.active_company_id) throw new Error("Empresa ativa nao encontrada");
  return profile.active_company_id as string;
}

async function ensureTriageClient(row: {
  id: string;
  company_id: string;
  created_by: string;
  client_id: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  document: string | null;
  city: string | null;
  address: string | null;
}) {
  if (row.client_id) {
    await supabaseAdmin
      .from("clients")
      .update({
        is_provisional: false,
        name: row.contact_name || "Cliente sem nome",
        document: row.document || null,
        phone: row.contact_phone || null,
        email: row.contact_email || null,
        city: row.city || null,
        address: row.address || null,
      } as never)
      .eq("id", row.client_id)
      .eq("company_id", row.company_id);
    return row.client_id;
  }

  const { data: client, error } = await supabaseAdmin
    .from("clients")
    .insert({
      company_id: row.company_id,
      created_by: row.created_by,
      name: row.contact_name || "Cliente sem nome",
      client_type: "individual",
      document: row.document || null,
      phone: row.contact_phone || null,
      email: row.contact_email || null,
      city: row.city || null,
      address: row.address || null,
      is_provisional: false,
      notes: `Criado a partir da triagem ${row.id}`,
    } as never)
    .select("id")
    .single();
  if (error) throw new Error(`Cliente: ${error.message}`);

  await supabaseAdmin
    .from("triagens")
    .update({ client_id: client.id, converted_client_id: client.id } as never)
    .eq("id", row.id)
    .eq("company_id", row.company_id);

  return client.id as string;
}

export const getTriageDetailAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => TriageDetailSchema.parse(input))
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("triagens")
      .select(
        "id, company_id, created_by, client_id, contact_name, contact_phone, contact_email, document, city, address, practice_area, demand_type, priority, origin, status, assigned_to, scheduled_at, started_at, finished_at, attendance_duration_seconds, created_at, updated_at, raw_description, observations, secretary_notes, lawyer_notes, legal_analysis, legal_viability, internal_notes, recommended_action, pending_documents, archived_reason, converted_at, ai_classification, notes, converted_client_id, converted_case_id, converted_contract_id, converted_card_id",
      )
      .eq("company_id", data.companyId)
      .eq("id", data.triagemId)
      .single();

    if (error) throw new Error(`Triagem: ${error.message}`);
    return row;
  });

export const listTriagensAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => TriageListSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    let query = supabaseAdmin
      .from("triagens")
      .select(
        "id, contact_name, contact_phone, contact_email, document, city, address, practice_area, demand_type, priority, origin, status, assigned_to, client_id, scheduled_at, started_at, created_at, raw_description, observations, secretary_notes",
      )
      .eq("company_id", data.companyId)
      .order("created_at", { ascending: false })
      .limit(80);

    if (data.tab === "mine") {
      query = query.eq("assigned_to", userId);
    } else if (data.tab !== "all") {
      query = query.eq("status", data.tab);
    }

    if (data.q) {
      const search = data.q.replace(/[%(),]/g, " ").trim();
      if (search) {
        query = query.or(
          `contact_name.ilike.%${search}%,document.ilike.%${search}%,contact_phone.ilike.%${search}%`,
        );
      }
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(`Listar triagens: ${error.message}`);
    return rows ?? [];
  });

export const listTriageActivitiesAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => TriageDetailSchema.parse(input))
  .handler(async ({ data }) => {
    const { data: rows, error } = await supabaseAdmin
      .from("activity_logs")
      .select("id, action, entity_label, created_at, metadata")
      .eq("company_id", data.companyId)
      .eq("entity_type", "triagem")
      .eq("entity_id", data.triagemId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw new Error(`Historico da triagem: ${error.message}`);
    return rows ?? [];
  });

export const updateTriageAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => TriageEditSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("active_company_id")
      .eq("id", userId)
      .maybeSingle();
    const companyId = profile?.active_company_id;
    if (!companyId) throw new Error("Empresa ativa nÃ£o encontrada");

    const patch = {
      contact_name: data.contact_name,
      contact_phone: data.contact_phone || null,
      contact_email: data.contact_email || null,
      document: data.document || null,
      cpf: data.document || null,
      city: data.city || null,
      address: data.address || null,
      practice_area: data.practice_area || null,
      demand_type: data.demand_type || null,
      benefit_type: data.demand_type || null,
      priority: data.priority,
      origin: data.origin || null,
      raw_description: data.raw_description || null,
      observations: data.observations || null,
      secretary_notes: data.secretary_notes || data.observations || null,
      assigned_to: data.assigned_to || null,
      updated_at: new Date().toISOString(),
    };

    const { data: row, error } = await supabaseAdmin
      .from("triagens")
      .update(patch as never)
      .eq("id", data.triagemId)
      .eq("company_id", companyId)
      .select("id, company_id, contact_name, notes")
      .single();

    if (error) throw new Error(`Editar triagem: ${error.message}`);

    await supabaseAdmin.from("activity_logs").insert({
      company_id: companyId,
      user_id: userId,
      action: "triage_updated",
      entity_type: "triagem",
      entity_id: data.triagemId,
      entity_label: row.contact_name,
      metadata: {
        practice_area: data.practice_area || null,
        demand_type: data.demand_type || null,
        assigned_to: data.assigned_to || null,
      },
    } as never);

    return { ok: true };
  });

export const deleteTriageAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => TriageActionSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("active_company_id")
      .eq("id", userId)
      .maybeSingle();
    const companyId = profile?.active_company_id;
    if (!companyId) throw new Error("Empresa ativa nÃ£o encontrada");

    const { data: row, error: readErr } = await supabaseAdmin
      .from("triagens")
      .select("id, company_id, contact_name, notes")
      .eq("id", data.triagemId)
      .eq("company_id", companyId)
      .single();
    if (readErr || !row) throw new Error("Triagem nÃ£o encontrada");

    const { error } = await supabaseAdmin
      .from("triagens")
      .delete()
      .eq("id", data.triagemId)
      .eq("company_id", companyId);
    if (error) throw new Error(`Excluir triagem: ${error.message}`);

    await supabaseAdmin.from("activity_logs").insert({
      company_id: companyId,
      user_id: userId,
      action: "triage_deleted",
      entity_type: "triagem",
      entity_id: data.triagemId,
      entity_label: row.contact_name,
      metadata: { deleted_at: new Date().toISOString() },
    } as never);

    return { ok: true };
  });

export const startTriageAttendance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => TriageActionSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const companyId = await getActiveCompanyId(userId);
    const { data: row, error: readErr } = await supabaseAdmin
      .from("triagens")
      .select("id, company_id, contact_name, status, started_at")
      .eq("id", data.triagemId)
      .eq("company_id", companyId)
      .single();
    if (readErr || !row) throw new Error("Triagem não encontrada");

    if (row.started_at || row.status === "in_attendance") {
      throw new Error("Atendimento ja foi iniciado para esta triagem");
    }

    const now = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from("triagens")
      .update({ status: "in_attendance", started_at: now, updated_at: now } as never)
      .eq("id", data.triagemId)
      .eq("company_id", companyId);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("activity_logs").insert({
      company_id: row.company_id,
      user_id: userId,
      action: "triage_attendance_started",
      entity_type: "triagem",
      entity_id: data.triagemId,
      entity_label: row.contact_name,
      metadata: { started_at: now },
    } as never);

    return { ok: true };
  });

export const pauseTriageAttendance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => TriageActionSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const companyId = await getActiveCompanyId(userId);
    const { data: row, error: readErr } = await supabaseAdmin
      .from("triagens")
      .select("id, company_id, contact_name, started_at, finished_at")
      .eq("id", data.triagemId)
      .eq("company_id", companyId)
      .single();
    if (readErr || !row) throw new Error("Triagem nÃ£o encontrada");
    if (!row.started_at) throw new Error("Atendimento ainda nÃ£o foi iniciado");

    const finishedAt = row.finished_at ?? new Date().toISOString();
    const durationSeconds = Math.max(
      0,
      Math.floor((new Date(finishedAt).getTime() - new Date(row.started_at).getTime()) / 1000),
    );
    const { error } = await supabaseAdmin
      .from("triagens")
      .update({
        status: "attendance_finished",
        finished_at: finishedAt,
        attendance_duration_seconds: durationSeconds,
        updated_at: finishedAt,
      } as never)
      .eq("id", data.triagemId)
      .eq("company_id", companyId);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("activity_logs").insert({
      company_id: row.company_id,
      user_id: userId,
      action: "triage_attendance_finished",
      entity_type: "triagem",
      entity_id: data.triagemId,
      entity_label: row.contact_name,
      metadata: { finished_at: finishedAt, duration_seconds: durationSeconds },
    } as never);

    return { ok: true, finishedAt, durationSeconds };
  });

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== "string") return {};

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return { legacy_notes: value };
  }
}

function splitMultilineList(value?: string | null) {
  return (value ?? "")
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

const LawyerTriageSchema = z.object({
  triagemId: z.string().uuid(),
  lawyer_client_report: z.string().trim().max(12000).optional().nullable(),
  legal_analysis: z.string().trim().max(8000).optional().nullable(),
  lawyer_notes: z.string().trim().max(8000).optional().nullable(),
  legal_guidance: z.string().trim().max(8000).optional().nullable(),
  presented_documents: z.string().trim().max(8000).optional().nullable(),
  pending_documents_text: z.string().trim().max(8000).optional().nullable(),
  urgency_level: z.string().trim().max(80).optional().nullable(),
  case_viability: z.string().trim().max(80).optional().nullable(),
  next_steps: z.string().trim().max(8000).optional().nullable(),
  lawyer_id: z.string().uuid().optional().nullable(),
  recommended_action: z.string().trim().max(120).optional().nullable(),
  legal_viability: z.string().trim().max(80).optional().nullable(),
  internal_notes: z.string().trim().max(8000).optional().nullable(),
  status: z
    .enum([
      "waiting_lawyer",
      "in_attendance",
      "attendance_finished",
      "waiting_documents",
      "converted",
      "archived",
    ])
    .optional(),
});

export const updateLawyerTriage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => LawyerTriageSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const companyId = await getActiveCompanyId(userId);
    const { data: row, error: readErr } = await supabaseAdmin
      .from("triagens")
      .select("id, company_id, contact_name")
      .eq("id", data.triagemId)
      .eq("company_id", companyId)
      .single();
    if (readErr || !row) throw new Error("Triagem não encontrada");

    const now = new Date().toISOString();
    const triageRow = row as { company_id: string; contact_name: string | null; notes?: unknown };
    const previousNotes = parseJsonObject(triageRow.notes);
    const previousAttendance = parseJsonObject(previousNotes.lawyer_attendance);
    const lawyerAttendance = {
      ...previousAttendance,
      lawyer_client_report: data.lawyer_client_report ?? null,
      lawyer_notes: data.lawyer_notes ?? null,
      legal_analysis: data.legal_analysis ?? null,
      legal_guidance: data.legal_guidance ?? null,
      presented_documents: data.presented_documents ?? null,
      pending_documents_text: data.pending_documents_text ?? null,
      urgency_level: data.urgency_level ?? null,
      case_viability: data.case_viability ?? data.legal_viability ?? null,
      next_steps: data.next_steps ?? null,
      recommended_action: data.recommended_action ?? null,
      internal_notes: data.internal_notes ?? null,
      lawyer_id: data.lawyer_id ?? userId,
      attendance_status:
        data.status === "attendance_finished"
          ? "finished"
          : data.status === "in_attendance"
            ? "in_attendance"
            : (previousAttendance.attendance_status ?? "draft"),
      updated_at: now,
    };

    const patch: Record<string, unknown> = {
      legal_analysis: data.legal_analysis ?? null,
      lawyer_notes: data.lawyer_notes ?? null,
      recommended_action: data.recommended_action ?? null,
      legal_viability: data.case_viability ?? data.legal_viability ?? null,
      internal_notes: data.internal_notes ?? null,
      pending_documents: splitMultilineList(data.pending_documents_text),
      notes: JSON.stringify({
        ...previousNotes,
        lawyer_attendance: lawyerAttendance,
      }),
      updated_at: now,
    };
    if (data.status) patch.status = data.status;
    if (data.status === "converted" || data.status === "archived") {
      patch.finished_at = now;
    }

    const { error } = await supabaseAdmin
      .from("triagens")
      .update(patch as never)
      .eq("id", data.triagemId)
      .eq("company_id", companyId);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("activity_logs").insert({
      company_id: row.company_id,
      user_id: userId,
      action: data.status === "converted" ? "triage_converted" : "triage_lawyer_updated",
      entity_type: "triagem",
      entity_id: data.triagemId,
      entity_label: row.contact_name,
      metadata: {
        recommended_action: data.recommended_action ?? null,
        status: data.status ?? null,
      },
    } as never);

    return { ok: true };
  });

export const decideTriageDestination = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => TriageDecisionSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const companyId = await getActiveCompanyId(userId);
    const { data: triage, error: readErr } = await supabaseAdmin
      .from("triagens")
      .select(
        "id, company_id, created_by, client_id, contact_name, contact_phone, contact_email, document, city, address, practice_area, demand_type, priority, raw_description, assigned_to, status",
      )
      .eq("id", data.triagemId)
      .eq("company_id", companyId)
      .single();
    if (readErr || !triage) throw new Error("Triagem nao encontrada");

    const now = new Date().toISOString();
    const pendingDocuments = (data.pending_documents ?? "")
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);

    if (data.action === "request_documents") {
      const { error } = await supabaseAdmin
        .from("triagens")
        .update({
          status: "waiting_documents",
          recommended_action: "solicitar_documentos",
          pending_documents: pendingDocuments,
          updated_at: now,
        } as never)
        .eq("id", triage.id)
        .eq("company_id", companyId);
      if (error) throw new Error(`Solicitar documentos: ${error.message}`);

      await supabaseAdmin.from("activity_logs").insert({
        company_id: companyId,
        user_id: userId,
        action: "triage_documents_requested",
        entity_type: "triagem",
        entity_id: triage.id,
        entity_label: triage.contact_name,
        metadata: { pending_documents: pendingDocuments },
      } as never);

      return { ok: true, status: "waiting_documents", link: `/app/triagem/${triage.id}` };
    }

    if (data.action === "archive") {
      const { error } = await supabaseAdmin
        .from("triagens")
        .update({
          status: "archived",
          recommended_action: "arquivar",
          archived_reason: data.reason || null,
          finished_at: now,
          updated_at: now,
        } as never)
        .eq("id", triage.id)
        .eq("company_id", companyId);
      if (error) throw new Error(`Arquivar triagem: ${error.message}`);

      await supabaseAdmin.from("activity_logs").insert({
        company_id: companyId,
        user_id: userId,
        action: "triage_archived",
        entity_type: "triagem",
        entity_id: triage.id,
        entity_label: triage.contact_name,
        metadata: { reason: data.reason || null },
      } as never);

      return { ok: true, status: "archived", link: "/app/triagem" };
    }

    if (data.action === "schedule_return") {
      if (!data.return_at) throw new Error("Informe data e horario do retorno");

      const startsAt = new Date(data.return_at);
      const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
      const { data: event, error } = await supabaseAdmin
        .from("events")
        .insert({
          company_id: companyId,
          created_by: userId,
          title: `Retorno - ${triage.contact_name || "Cliente"}`,
          description: `Retorno agendado a partir da triagem ${triage.id}`,
          event_type: "meeting",
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          assigned_to: triage.assigned_to || userId,
        } as never)
        .select("id")
        .single();
      if (error) throw new Error(`Agendar retorno: ${error.message}`);

      await supabaseAdmin
        .from("triagens")
        .update({
          scheduled_at: startsAt.toISOString(),
          recommended_action: "agendar_retorno",
          updated_at: now,
        } as never)
        .eq("id", triage.id)
        .eq("company_id", companyId);

      await supabaseAdmin.from("activity_logs").insert({
        company_id: companyId,
        user_id: userId,
        action: "triage_return_scheduled",
        entity_type: "triagem",
        entity_id: triage.id,
        entity_label: triage.contact_name,
        metadata: { event_id: event.id, starts_at: startsAt.toISOString() },
      } as never);

      return { ok: true, status: triage.status, link: "/app/agenda", entityId: event.id };
    }

    const clientId = await ensureTriageClient(triage);
    const basePatch: Record<string, unknown> = {
      status: "converted",
      converted_at: now,
      converted_client_id: clientId,
      updated_at: now,
    };
    let action = "triage_converted";
    let entityId = triage.id;
    let link = `/app/clientes/${clientId}`;

    if (data.action === "create_case") {
      const { data: row, error } = await supabaseAdmin
        .from("cases")
        .insert({
          company_id: companyId,
          created_by: userId,
          client_id: clientId,
          title:
            data.case_title || `Caso - ${triage.contact_name || triage.practice_area || "Triagem"}`,
          cnj_number: data.cnj_number || null,
          practice_area: triage.practice_area || null,
          priority: triage.priority === "urgent" ? "urgente" : triage.priority || "media",
          procedural_status: "Triagem convertida",
          phase: "Triagem",
          description: triage.raw_description || null,
          assigned_to: triage.assigned_to || userId,
          lawyer_id: triage.assigned_to || userId,
        } as never)
        .select("id")
        .single();
      if (error) throw new Error(`Processo: ${error.message}`);
      basePatch.converted_case_id = row.id;
      action = "triage_converted_to_case";
      entityId = row.id;
      link = `/app/processos/${row.id}`;
    }

    if (data.action === "create_contract" || data.action === "send_contract") {
      const value = data.contract_value ?? 0;
      const contractStatus = data.action === "send_contract" ? "pendente_assinatura" : "rascunho";
      const { data: row, error } = await supabaseAdmin
        .from("contracts")
        .insert({
          company_id: companyId,
          created_by: userId,
          client_id: clientId,
          title: `Contrato de honorarios - ${triage.contact_name || "Cliente"}`,
          contract_type: "honorarios",
          status: contractStatus,
          value,
          notes: `Criado a partir da triagem ${triage.id}`,
        } as never)
        .select("id")
        .single();
      if (error) throw new Error(`Contrato: ${error.message}`);
      basePatch.converted_contract_id = row.id;
      action =
        data.action === "send_contract" ? "triage_contract_sent" : "triage_converted_to_contract";
      entityId = row.id;
      link = "/app/contratos";
    }

    if (data.action === "create_finance") {
      const amount = data.financial_amount ?? data.contract_value ?? 0;
      if (amount <= 0) throw new Error("Informe um valor financeiro maior que zero");
      const { data: row, error } = await supabaseAdmin
        .from("financial_entries")
        .insert({
          company_id: companyId,
          created_by: userId,
          client_id: clientId,
          source: "triagem",
          source_id: triage.id,
          source_ref: `triagem:${triage.id}`,
          entry_type: "receita",
          subtype: "honorarios",
          category: "honorarios",
          description: `Honorarios advocaticios - ${triage.contact_name || "Cliente"}`,
          amount,
          due_date: data.due_date || null,
          status: "pendente",
        } as never)
        .select("id")
        .single();
      if (error) throw new Error(`Financeiro: ${error.message}`);
      action = "triage_converted_to_finance";
      entityId = row.id;
      link = "/app/financeiro";
    }

    if (data.action === "create_card") {
      const { data: row, error } = await supabaseAdmin
        .from("production_cards")
        .insert({
          company_id: companyId,
          created_by: userId,
          assignee_id: triage.assigned_to || userId,
          client_id: clientId,
          client_name_snapshot: triage.contact_name || null,
          title:
            data.card_title ||
            `Produzir demanda - ${triage.contact_name || triage.practice_area || "Triagem"}`,
          description: triage.raw_description || null,
          practice_area: triage.practice_area || null,
          demand_type: triage.demand_type || null,
          priority:
            triage.priority === "high"
              ? "alta"
              : triage.priority === "urgent"
                ? "urgente"
                : "media",
          column_key: "para_producao",
          legal_phase: "para_producao",
          operational_status: "em_producao",
          triagem_id: triage.id,
        } as never)
        .select("id")
        .single();
      if (error) throw new Error(`Card de producao: ${error.message}`);
      basePatch.converted_card_id = row.id;
      action = "triage_converted_to_card";
      entityId = row.id;
      link = "/app/meu-quadro";
    }

    const { error: updateErr } = await supabaseAdmin
      .from("triagens")
      .update(basePatch as never)
      .eq("id", triage.id)
      .eq("company_id", companyId);
    if (updateErr) throw new Error(`Atualizar triagem: ${updateErr.message}`);

    await supabaseAdmin.from("activity_logs").insert({
      company_id: companyId,
      user_id: userId,
      action,
      entity_type: "triagem",
      entity_id: triage.id,
      entity_label: triage.contact_name,
      metadata: {
        target_entity_id: entityId,
        client_id: clientId,
        decision: data.action,
      },
    } as never);

    return { ok: true, status: "converted", link, clientId, entityId };
  });

const CloseContractSchema = z.object({
  cardId: z.string().uuid(),
  clientId: z.string().uuid(),
  contractValue: z.number().nonnegative().optional(),
  contractType: z.enum(["administrativo", "judicial"]).default("administrativo"),
  honorarios: z.number().nonnegative().optional(),
  clientUpdate: z
    .object({
      rg: z.string().trim().max(40).optional().nullable(),
      marital_status: z.string().trim().max(40).optional().nullable(),
      profession: z.string().trim().max(120).optional().nullable(),
      address: z.string().trim().max(300).optional().nullable(),
      birth_date: z.string().optional().nullable(),
    })
    .optional(),
});

export const closeContractFromCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CloseContractSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("active_company_id")
      .eq("id", userId)
      .maybeSingle();
    const companyId = profile?.active_company_id;
    if (!companyId) throw new Error("Empresa ativa não encontrada");

    const { data: card, error: cardErr } = await supabase
      .from("production_cards")
      .select("id, title, client_id, client_name_snapshot, demand_type")
      .eq("id", data.cardId)
      .eq("company_id", companyId)
      .single();
    if (cardErr || !card) throw new Error("Cartão não encontrado");

    // 1) Promove cliente (remove flag provisório + atualiza dados)
    const upd: Record<string, unknown> = { is_provisional: false };
    if (data.clientUpdate) {
      Object.entries(data.clientUpdate).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") upd[k] = v;
      });
    }
    const { error: upErr } = await supabase
      .from("clients")
      .update(upd as never)
      .eq("id", data.clientId)
      .eq("company_id", companyId);
    if (upErr) throw new Error(`Cliente: ${upErr.message}`);

    // 2) Cria contrato (rascunho)
    const { error: kErr } = await supabase.from("contracts").insert({
      company_id: companyId,
      created_by: userId,
      client_id: data.clientId,
      title: `Contrato — ${card.client_name_snapshot ?? "Cliente"}`,
      contract_type: "honorarios",
      status: "rascunho",
      value: data.contractValue ?? null,
      notes: `Originado da Produção: ${card.title}`,
    } as never);
    if (kErr) throw new Error(`Contrato: ${kErr.message}`);

    // 3) Financeiro (honorários a receber)
    if (data.honorarios && data.honorarios > 0) {
      const { error: fErr } = await supabase.from("financial_entries").insert({
        company_id: companyId,
        created_by: userId,
        client_id: data.clientId,
        entry_type: "receita",
        description: `Honorários (${data.contractType}) — ${card.client_name_snapshot ?? ""}`,
        amount: data.honorarios,
        category: data.contractType,
        status: "pendente",
      } as never);
      if (fErr) throw new Error(`Financeiro: ${fErr.message}`);
    }

    // 4) Move card para "Contrato Fechado" + checklist documentos
    await supabase
      .from("production_cards")
      .update({
        column_key: "contrato_fechado",
        legal_phase: "contrato_fechado",
        operational_status: "em_analise",
        legal_phase_changed_at: new Date().toISOString(),
        operational_status_changed_at: new Date().toISOString(),
      } as never)
      .eq("id", data.cardId);

    const baseChecklist = [
      "RG e CPF",
      "Comprovante de endereço",
      "Carteira de trabalho",
      "Documentos médicos / laudos",
      "Histórico de contribuições (CNIS)",
    ];
    await supabase.from("production_card_checklist").insert(
      baseChecklist.map((text, i) => ({
        company_id: companyId,
        card_id: data.cardId,
        text,
        position: i,
        done: false,
      })) as never,
    );

    await supabase.from("production_card_events").insert({
      company_id: companyId,
      card_id: data.cardId,
      actor_id: userId,
      event_type: "contract_closed",
      payload: { contract_type: data.contractType, value: data.contractValue ?? null },
    } as never);

    await supabase.from("activity_logs").insert({
      company_id: companyId,
      user_id: userId,
      action: "create",
      entity_type: "contrato",
      entity_id: data.cardId,
      entity_label: card.client_name_snapshot ?? null,
      metadata: {
        contract_type: data.contractType,
        value: data.contractValue ?? null,
        honorarios: data.honorarios ?? null,
      },
    } as never);

    return { ok: true };
  });
