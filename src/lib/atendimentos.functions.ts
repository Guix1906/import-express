import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ConsultationType = z.enum([
  "consulta_inicial",
  "processo_existente",
  "retorno",
  "pos_atendimento",
]);
const Status = z.enum([
  "agendado",
  "confirmado",
  "em_atendimento",
  "aguardando_retorno",
  "concluido",
  "cancelado",
  "nao_compareceu",
]);
const Channel = z.enum(["presencial", "video", "telefone", "whatsapp", "email"]);

const UpsertSchema = z.object({
  id: z.string().uuid().optional(),
  subject: z.string().trim().min(2).max(200),
  summary: z.string().trim().max(4000).optional().nullable(),
  consultation_type: ConsultationType.default("consulta_inicial"),
  channel: Channel.default("presencial"),
  status: Status.default("agendado"),
  scheduled_at: z.string().optional().nullable(),
  duration_minutes: z.number().int().min(0).max(1440).optional().nullable(),
  client_id: z.string().uuid().optional().nullable(),
  case_id: z.string().uuid().optional().nullable(),
  assigned_to: z.string().uuid().optional().nullable(),
  billable: z.boolean().default(false),
  fee_schedule_id: z.string().uuid().optional().nullable(),
  amount: z.number().nonnegative().optional().nullable(),
  hourly_rate: z.number().nonnegative().optional().nullable(),
});

export const upsertAtendimento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => UpsertSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("active_company_id")
      .eq("id", userId)
      .maybeSingle();
    const companyId = profile?.active_company_id;
    if (!companyId) throw new Error("Empresa ativa não encontrada");

    const payload = {
      subject: data.subject,
      summary: data.summary ?? null,
      consultation_type: data.consultation_type,
      channel: data.channel,
      status: data.status,
      scheduled_at: data.scheduled_at ?? null,
      duration_minutes: data.duration_minutes ?? null,
      client_id: data.client_id ?? null,
      case_id: data.case_id ?? null,
      assigned_to: data.assigned_to ?? null,
      billable: data.billable,
      fee_schedule_id: data.fee_schedule_id ?? null,
      amount: data.amount ?? null,
      hourly_rate: data.hourly_rate ?? null,
    };

    let atendimentoId = data.id;
    if (atendimentoId) {
      const { error } = await supabase
        .from("atendimentos")
        .update(payload as never)
        .eq("id", atendimentoId);
      if (error) throw new Error(error.message);
    } else {
      const { data: row, error } = await supabase
        .from("atendimentos")
        .insert({ ...payload, company_id: companyId, created_by: userId } as never)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      atendimentoId = (row as { id: string }).id;
    }

    // Auto-create financial entry when billable
    if (data.billable && data.amount && data.amount > 0 && data.client_id) {
      await supabase.from("financial_entries").insert({
        company_id: companyId,
        created_by: userId,
        client_id: data.client_id,
        entry_type: "receita",
        description: `Atendimento: ${data.subject}`,
        amount: data.amount,
        category: "consulta",
        status: "pendente",
        due_date: data.scheduled_at ? data.scheduled_at.slice(0, 10) : null,
      } as never);
    }

    await supabase.from("activity_logs").insert({
      company_id: companyId,
      user_id: userId,
      action: data.id ? "update" : "create",
      entity_type: "atendimento",
      entity_id: atendimentoId!,
      entity_label: data.subject,
      metadata: { status: data.status, type: data.consultation_type, billable: data.billable },
    } as never);

    return { id: atendimentoId };
  });

// Fee schedule
const FeeUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  service_type: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional().nullable(),
  default_amount: z.number().nonnegative(),
  active: z.boolean().default(true),
});

export const upsertFeeSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => FeeUpsertSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("active_company_id")
      .eq("id", userId)
      .maybeSingle();
    const companyId = profile?.active_company_id;
    if (!companyId) throw new Error("Empresa ativa não encontrada");

    if (data.id) {
      const { error } = await supabase
        .from("fee_schedule")
        .update({
          service_type: data.service_type,
          description: data.description ?? null,
          default_amount: data.default_amount,
          active: data.active,
        } as never)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("fee_schedule").insert({
        company_id: companyId,
        created_by: userId,
        service_type: data.service_type,
        description: data.description ?? null,
        default_amount: data.default_amount,
        active: data.active,
      } as never);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteFeeSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("fee_schedule").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
