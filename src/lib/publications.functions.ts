import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { addBusinessDays } from "@/lib/legal-deadlines";

const LinkSchema = z.object({
  publication_id: z.string().uuid(),
  case_id: z.string().uuid(),
  deadline_days: z.number().int().min(1).max(180).default(15),
  is_double_term: z.boolean().default(false),
  assigned_to: z.string().uuid().optional().nullable(),
});

/**
 * Vincula uma publicação a um processo e gera automaticamente:
 *  - tarefa de análise
 *  - prazo processual (com prazo em dobro opcional)
 *  - notificação para o responsável
 */
export const linkPublicationToCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => LinkSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("active_company_id")
      .eq("id", userId)
      .maybeSingle();
    const companyId = profile?.active_company_id;
    if (!companyId) throw new Error("Empresa ativa não encontrada");

    const { data: pub, error: pErr } = await supabase
      .from("publications")
      .select("id, content, process_number, client_name, assigned_to")
      .eq("id", data.publication_id)
      .single();
    if (pErr || !pub) throw new Error("Publicação não encontrada");

    const assignee = data.assigned_to ?? pub.assigned_to ?? userId;
    const days = data.is_double_term ? data.deadline_days * 2 : data.deadline_days;
    const dueDate = addBusinessDays(new Date(), days);
    const dueIso = dueDate.toISOString();
    const dueDay = dueIso.slice(0, 10);
    const label = `Publicação ${pub.process_number ?? ""}`.trim();

    // 1) Vincula publicação ao processo
    await supabase
      .from("publications")
      .update({ case_id: data.case_id, status: "linked" } as never)
      .eq("id", data.publication_id);

    // 2) Tarefa
    await supabase.from("tasks").insert({
      company_id: companyId,
      created_by: userId,
      assigned_to: assignee,
      case_id: data.case_id,
      title: `Analisar publicação — ${pub.process_number ?? "sem nº"}`,
      description: pub.content ?? null,
      status: "todo",
      priority: "high",
      due_date: dueIso,
    } as never);

    // 3) Prazo
    await supabase.from("deadlines").insert({
      company_id: companyId,
      created_by: userId,
      case_id: data.case_id,
      publication_id: data.publication_id,
      assigned_to: assignee,
      title: `Prazo de publicação ${pub.process_number ?? ""}`.trim(),
      description: pub.content?.slice(0, 500) ?? null,
      due_date: dueDay,
      status: "pending",
      is_double_term: data.is_double_term,
    } as never);

    // 4) Notificação
    await supabase.from("notifications").insert({
      company_id: companyId,
      user_id: assignee,
      type: "publication_linked",
      title: "Nova publicação vinculada",
      body: `${label} — prazo em ${days} dias úteis`,
      link: `/app/processos/${data.case_id}`,
      payload: { publication_id: data.publication_id, case_id: data.case_id },
    } as never);

    // 5) Log
    await supabase.from("activity_logs").insert({
      company_id: companyId,
      user_id: userId,
      action: "link",
      entity_type: "publicacao",
      entity_id: data.publication_id,
      entity_label: label,
      metadata: { case_id: data.case_id, deadline_days: days, double: data.is_double_term },
    } as never);

    return { ok: true, due_date: dueDay };
  });
