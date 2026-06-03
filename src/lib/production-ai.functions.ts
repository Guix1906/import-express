import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const inputSchema = z.object({
  rangeDays: z.number().int().min(1).max(365).default(30),
});

export const analyzeProductionMetrics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY ausente");

    const from = new Date();
    from.setDate(from.getDate() - data.rangeDays);

    const { data: cards, error } = await supabase
      .from("production_cards")
      .select(
        "assignee_id, column_key, priority, due_date, completed_at, created_at, practice_area",
      )
      .gte("created_at", from.toISOString());
    if (error) throw new Error(error.message);

    const list = cards ?? [];
    const total = list.length;
    const concluidos = list.filter((c) => c.column_key === "concluidos").length;
    const atrasados = list.filter(
      (c) =>
        c.due_date &&
        !["concluidos", "arquivados"].includes(c.column_key as string) &&
        new Date() > new Date(c.due_date as string),
    ).length;
    const urgentes = list.filter((c) => c.priority === "urgente").length;

    const porAssignee: Record<string, { total: number; ok: number; atraso: number }> = {};
    list.forEach((c) => {
      const k = (c.assignee_id as string) ?? "—";
      porAssignee[k] ??= { total: 0, ok: 0, atraso: 0 };
      porAssignee[k].total++;
      if (c.column_key === "concluidos") porAssignee[k].ok++;
      if (
        c.due_date &&
        !["concluidos", "arquivados"].includes(c.column_key as string) &&
        new Date() > new Date(c.due_date as string)
      )
        porAssignee[k].atraso++;
    });

    const porArea: Record<string, number> = {};
    list.forEach((c) => {
      const a = (c.practice_area as string) || "Sem área";
      porArea[a] = (porArea[a] ?? 0) + 1;
    });

    const prompt = `Você é um consultor sênior de produtividade jurídica analisando a operação de um escritório de advocacia nos últimos ${data.rangeDays} dias.

DADOS:
- Total de demandas: ${total}
- Concluídas: ${concluidos} (${total ? Math.round((concluidos / total) * 100) : 0}%)
- Atrasadas: ${atrasados}
- Urgentes: ${urgentes}
- Distribuição por colaborador (id → total/concluídas/atrasadas): ${JSON.stringify(porAssignee)}
- Distribuição por área: ${JSON.stringify(porArea)}

TAREFA: Produza um diagnóstico executivo em PORTUGUÊS contendo:
1. **Diagnóstico** (2-3 frases): o estado geral da operação.
2. **Pontos fortes** (1-2 bullets curtos).
3. **Riscos / gargalos** (1-3 bullets curtos, específicos).
4. **Recomendações práticas** (2-3 bullets acionáveis, ex: rebalancear demandas, priorizar X, revisar SLA de Y).

Seja direto, sem rodeios, no máximo 180 palavras. Não cite ids brutos — use "colaborador A/B/C" quando precisar diferenciar. Use markdown leve (**negrito** e bullets).`;

    const res = await fetch(AI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Gateway IA falhou: ${res.status} ${t.slice(0, 200)}`);
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const insight =
      json.choices?.[0]?.message?.content?.trim() ?? "Não foi possível gerar insights.";

    return { insight, sampleSize: total };
  });
