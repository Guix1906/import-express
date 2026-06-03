import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { addBusinessDays } from "@/lib/legal-deadlines";

// ---------- Andamentos ----------

const MovementSchema = z.object({
  case_id: z.string().uuid(),
  movement_date: z.string().min(1),
  movement_type: z.string().trim().max(40).default("andamento"),
  title: z.string().trim().min(2).max(240),
  description: z.string().trim().max(4000).optional().nullable(),
  source: z.string().trim().max(120).optional().nullable(),
});

export const addProcessMovement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => MovementSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("active_company_id")
      .eq("id", userId)
      .maybeSingle();
    const companyId = profile?.active_company_id;
    if (!companyId) throw new Error("Empresa ativa não encontrada");

    const { error } = await supabase.from("process_movements").insert({
      company_id: companyId,
      case_id: data.case_id,
      created_by: userId,
      movement_date: data.movement_date,
      movement_type: data.movement_type,
      title: data.title,
      description: data.description ?? null,
      source: data.source ?? null,
    } as never);
    if (error) throw new Error(error.message);

    await supabase.from("activity_logs").insert({
      company_id: companyId,
      user_id: userId,
      action: "create",
      entity_type: "andamento",
      entity_id: data.case_id,
      entity_label: data.title,
      metadata: { type: data.movement_type, date: data.movement_date },
    } as never);

    return { ok: true };
  });

export const listProcessMovements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ case_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("process_movements")
      .select(
        "id, movement_date, movement_type, title, description, source, created_at, created_by",
      )
      .eq("case_id", data.case_id)
      .order("movement_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { movements: rows ?? [] };
  });

// ---------- Criar processo a partir de contrato ----------

const CreateCaseSchema = z.object({
  contractId: z.string().uuid(),
  title: z.string().trim().min(2).max(240),
  cnj_number: z.string().trim().max(40).optional().nullable(),
  court: z.string().trim().max(120).optional().nullable(),
  practice_area: z.string().trim().max(80).optional().nullable(),
  case_value: z.number().nonnegative().optional().nullable(),
  generate_default_deadlines: z.boolean().default(true),
});

const DEFAULT_DEADLINES_BY_AREA: Record<string, Array<{ title: string; businessDays: number }>> = {
  previdenciario: [
    { title: "Protocolar requerimento administrativo", businessDays: 5 },
    { title: "Aguardar resposta INSS (60 dias)", businessDays: 60 },
  ],
  trabalhista: [
    { title: "Audiência inicial (estimada)", businessDays: 30 },
    { title: "Prazo para defesa", businessDays: 15 },
  ],
  civel: [
    { title: "Prazo para contestação", businessDays: 15 },
    { title: "Audiência de conciliação", businessDays: 30 },
  ],
  default: [{ title: "Acompanhamento inicial", businessDays: 10 }],
};

export const createCaseFromContract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => CreateCaseSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("active_company_id")
      .eq("id", userId)
      .maybeSingle();
    const companyId = profile?.active_company_id;
    if (!companyId) throw new Error("Empresa ativa não encontrada");

    const { data: contract, error: cErr } = await supabase
      .from("contracts")
      .select("id, client_id, value, case_id")
      .eq("id", data.contractId)
      .eq("company_id", companyId)
      .single();
    if (cErr || !contract) throw new Error("Contrato não encontrado");
    if (contract.case_id) throw new Error("Este contrato já está vinculado a um processo");

    // 1) cria o case
    const { data: caseRow, error: kErr } = await supabase
      .from("cases")
      .insert({
        company_id: companyId,
        created_by: userId,
        client_id: contract.client_id,
        title: data.title,
        cnj_number: data.cnj_number ?? null,
        court: data.court ?? null,
        practice_area: data.practice_area ?? null,
        case_value: data.case_value ?? contract.value ?? null,
        status: "active",
      } as never)
      .select("id")
      .single();
    if (kErr || !caseRow) throw new Error(`Processo: ${kErr?.message ?? "falha"}`);
    const caseId = (caseRow as { id: string }).id;

    // 2) vincula contrato -> case
    await supabase
      .from("contracts")
      .update({ case_id: caseId } as never)
      .eq("id", contract.id);

    // 3) prazos padrão
    if (data.generate_default_deadlines) {
      const areaKey = (data.practice_area ?? "default").toLowerCase();
      const tpl = DEFAULT_DEADLINES_BY_AREA[areaKey] ?? DEFAULT_DEADLINES_BY_AREA.default;
      const today = new Date();
      const deadlines = tpl.map((t) => ({
        company_id: companyId,
        created_by: userId,
        case_id: caseId,
        title: t.title,
        due_date: addBusinessDays(today, t.businessDays).toISOString().slice(0, 10),
        status: "pending",
        is_double_term: false,
      }));
      await supabase.from("deadlines").insert(deadlines as never);
    }

    // 4) andamento inicial
    await supabase.from("process_movements").insert({
      company_id: companyId,
      case_id: caseId,
      created_by: userId,
      movement_date: new Date().toISOString().slice(0, 10),
      movement_type: "abertura",
      title: "Processo criado a partir do contrato",
      source: "sistema",
    } as never);

    await supabase.from("activity_logs").insert({
      company_id: companyId,
      user_id: userId,
      action: "create",
      entity_type: "processo",
      entity_id: caseId,
      entity_label: data.title,
      metadata: { from_contract: contract.id, area: data.practice_area ?? null },
    } as never);

    return { caseId };
  });
