import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function isMissingTable(error: { code?: string; message?: string } | null, table: string) {
  const message = error?.message?.toLowerCase() ?? "";
  return (
    error?.code === "42P01" ||
    (message.includes(table.toLowerCase()) &&
      (message.includes("schema cache") || message.includes("does not exist")))
  );
}

const CompanySchema = z.object({
  companyId: z.string().uuid(),
});

const ClientSchema = z.object({
  companyId: z.string().uuid(),
  name: z.string().trim().min(2).max(160),
  client_type: z.enum(["individual", "company"]).default("individual"),
  document: z.string().trim().max(30).optional().nullable(),
  email: z.string().trim().email().max(160).optional().nullable().or(z.literal("")),
  phone: z.string().trim().max(40).optional().nullable(),
  address: z.string().trim().max(300).optional().nullable(),
  city: z.string().trim().max(120).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  is_provisional: z.boolean().optional(),
});

const ClientDeleteSchema = z.object({
  companyId: z.string().uuid(),
  id: z.string().uuid(),
});

export const listClientsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CompanySchema.parse(input))
  .handler(async ({ data }) => {
    const { data: rows, error } = await supabaseAdmin
      .from("clients")
      .select("id, name, client_type, document, email, phone, address, city, notes, created_at")
      .eq("company_id", data.companyId)
      .eq("is_provisional", false)
      .order("created_at", { ascending: false })
      .limit(1000);

    if (error) {
      if (isMissingTable(error, "clients")) return [];
      throw new Error(error.message);
    }

    return rows ?? [];
  });

export const createClientAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ClientSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: inserted, error } = await supabaseAdmin
      .from("clients")
      .insert({
        company_id: data.companyId,
        created_by: context.userId,
        name: data.name,
        client_type: data.client_type,
        document: data.document || null,
        email: data.email || null,
        phone: data.phone || null,
        address: data.address || null,
        city: data.city || null,
        notes: data.notes || null,
        is_provisional: data.is_provisional ?? false,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    return { id: inserted.id };
  });

export const deleteClientAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ClientDeleteSchema.parse(input))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("clients")
      .delete()
      .eq("company_id", data.companyId)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const CaseSchema = z.object({
  companyId: z.string().uuid(),
  title: z.string().trim().min(2).max(200),
  cnj_number: z.string().trim().max(80).optional().nullable(),
  internal_number: z.string().trim().max(80).optional().nullable(),
  practice_area: z.string().trim().max(120).optional().nullable(),
  court: z.string().trim().max(160).optional().nullable(),
  instance: z.string().trim().max(80).optional().nullable(),
  case_value: z.number().optional().nullable(),
  client_id: z.string().uuid().optional().nullable(),
  polo_ativo: z.string().trim().max(200).optional().nullable(),
  polo_passivo: z.string().trim().max(200).optional().nullable(),
  priority: z.string().trim().max(40).optional().nullable(),
  procedural_status: z.string().trim().max(200).optional().nullable(),
  description: z.string().trim().max(4000).optional().nullable(),
});

export const listCasesAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CompanySchema.parse(input))
  .handler(async ({ data }) => {
    const { data: cases, error } = await supabaseAdmin
      .from("cases")
      .select(
        "id, cnj_number, title, practice_area, court, status, case_value, client_id, created_at",
      )
      .eq("company_id", data.companyId)
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) {
      if (isMissingTable(error, "cases")) return [];
      throw new Error(error.message);
    }

    const clientIds = Array.from(
      new Set((cases ?? []).map((item) => item.client_id).filter(Boolean) as string[]),
    );
    const clientNameById = new Map<string, string>();

    if (clientIds.length > 0) {
      const { data: clients } = await supabaseAdmin
        .from("clients")
        .select("id, name")
        .in("id", clientIds);
      for (const client of clients ?? []) clientNameById.set(client.id, client.name);
    }

    return (cases ?? []).map((item) => ({
      ...item,
      client: item.client_id ? { name: clientNameById.get(item.client_id) ?? "" } : null,
    }));
  });

export const createCaseAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CaseSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: inserted, error } = await supabaseAdmin
      .from("cases")
      .insert({
        company_id: data.companyId,
        created_by: context.userId,
        title: data.title,
        cnj_number: data.cnj_number || null,
        internal_number: data.internal_number || null,
        practice_area: data.practice_area || null,
        court: data.court || null,
        instance: data.instance || null,
        case_value: data.case_value ?? null,
        client_id: data.client_id || null,
        polo_ativo: data.polo_ativo || null,
        polo_passivo: data.polo_passivo || null,
        priority: data.priority || "media",
        procedural_status: data.procedural_status || null,
        description: data.description || null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted.id };
  });

const FinancialEntrySchema = z.object({
  companyId: z.string().uuid(),
  id: z.string().uuid().optional(),
  entry_type: z.string().trim().min(1),
  subtype: z.string().trim().optional().nullable(),
  category: z.string().trim().optional().nullable(),
  description: z.string().trim().min(2),
  amount: z.number(),
  due_date: z.string().optional().nullable(),
  paid_at: z.string().optional().nullable(),
  status: z.string().trim().optional().nullable(),
  payment_method: z.string().trim().optional().nullable(),
  case_id: z.string().uuid().optional().nullable(),
  client_id: z.string().uuid().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});

const FinancialActionSchema = z.object({
  companyId: z.string().uuid(),
  id: z.string().uuid(),
});

export const listFinancialEntriesAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CompanySchema.parse(input))
  .handler(async ({ data }) => {
    const { data: rows, error } = await supabaseAdmin
      .from("financial_entries")
      .select(
        "id, entry_type, subtype, category, description, amount, due_date, paid_at, status, payment_method, case_id, client_id, notes",
      )
      .eq("company_id", data.companyId)
      .order("due_date", { ascending: false, nullsFirst: false })
      .limit(1000);
    if (error) {
      if (isMissingTable(error, "financial_entries")) return [];
      throw new Error(error.message);
    }
    return rows ?? [];
  });

export const saveFinancialEntryAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => FinancialEntrySchema.parse(input))
  .handler(async ({ data, context }) => {
    const payload = {
      entry_type: data.entry_type,
      subtype: data.subtype || "geral",
      category: data.category || null,
      description: data.description,
      amount: data.amount,
      due_date: data.due_date || null,
      paid_at: data.paid_at || null,
      status: data.status || "pendente",
      payment_method: data.payment_method || null,
      case_id: data.case_id || null,
      client_id: data.client_id || null,
      notes: data.notes || null,
    };

    if (data.id) {
      const { error } = await supabaseAdmin
        .from("financial_entries")
        .update(payload)
        .eq("company_id", data.companyId)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }

    const { data: inserted, error } = await supabaseAdmin
      .from("financial_entries")
      .insert({
        ...payload,
        company_id: data.companyId,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted.id };
  });

export const markFinancialEntryPaidAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => FinancialActionSchema.parse(input))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("financial_entries")
      .update({ status: "pago", paid_at: new Date().toISOString().slice(0, 10) })
      .eq("company_id", data.companyId)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteFinancialEntryAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => FinancialActionSchema.parse(input))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("financial_entries")
      .delete()
      .eq("company_id", data.companyId)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
