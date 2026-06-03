import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ActivateSchema = z.object({
  contractId: z.string().uuid(),
  installments: z.number().int().min(1).max(60).default(1),
  firstDueDate: z.string().min(1),
  category: z.string().trim().max(60).optional().nullable(),
});

export const activateContractWithFinance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ActivateSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("active_company_id")
      .eq("id", userId)
      .maybeSingle();
    const companyId = profile?.active_company_id;
    if (!companyId) throw new Error("Empresa ativa nao encontrada");

    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("company_id", companyId)
      .in("role", ["owner", "admin"])
      .maybeSingle();
    if (!role) throw new Error("Voce nao tem permissao para ativar contratos financeiros.");

    const { data: contract, error: cErr } = await supabase
      .from("contracts")
      .select("id, title, client_id, value, company_id, status")
      .eq("id", data.contractId)
      .eq("company_id", companyId)
      .single();
    if (cErr || !contract) throw new Error("Contrato nao encontrado");

    const { count: existingInstallments, error: existingErr } = await supabase
      .from("financial_entries")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("source", "contract_activation")
      .eq("source_id", contract.id);
    if (existingErr) throw new Error(`Financeiro: ${existingErr.message}`);

    const today = new Date().toISOString().slice(0, 10);
    const { error: upErr } = await supabase
      .from("contracts")
      .update({ status: "ativo", signed_at: today } as never)
      .eq("id", contract.id)
      .eq("company_id", companyId);
    if (upErr) throw new Error(`Ativacao: ${upErr.message}`);

    const total = Number(contract.value ?? 0);
    const shouldGenerateInstallments = total > 0 && !existingInstallments;

    if (shouldGenerateInstallments) {
      const n = data.installments;
      const base = Math.floor((total / n) * 100) / 100;
      const last = Math.round((total - base * (n - 1)) * 100) / 100;
      const start = new Date(data.firstDueDate);
      const entries = Array.from({ length: n }).map((_, i) => {
        const due = new Date(start);
        due.setMonth(due.getMonth() + i);
        return {
          company_id: companyId,
          created_by: userId,
          client_id: contract.client_id,
          contract_id: contract.id,
          source: "contract_activation",
          source_id: contract.id,
          source_ref: `installment:${i + 1}`,
          entry_type: "receita",
          subtype: "parcela",
          description: `${contract.title} - Parcela ${i + 1}/${n}`,
          amount: i === n - 1 ? last : base,
          due_date: due.toISOString().slice(0, 10),
          status: "pendente",
          category: data.category ?? "honorarios",
        };
      });
      const { error: fErr } = await supabase.from("financial_entries").insert(entries as never);
      if (fErr) throw new Error(`Financeiro: ${fErr.message}`);

      await supabase.from("activity_logs").insert({
        company_id: companyId,
        user_id: userId,
        action: "finance_generated",
        entity_type: "contrato",
        entity_id: contract.id,
        entity_label: contract.title,
        metadata: { value: total, installments: n, source: "contract_activation" },
      } as never);
    }

    await supabase.from("activity_logs").insert({
      company_id: companyId,
      user_id: userId,
      action: "contract_activated",
      entity_type: "contrato",
      entity_id: contract.id,
      entity_label: contract.title,
      metadata: {
        value: total,
        installments: shouldGenerateInstallments ? data.installments : (existingInstallments ?? 0),
        finance_already_generated: total > 0 && !shouldGenerateInstallments,
      },
    } as never);

    return {
      ok: true,
      installments: shouldGenerateInstallments ? data.installments : (existingInstallments ?? 0),
    };
  });
