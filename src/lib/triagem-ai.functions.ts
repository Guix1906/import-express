import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({
  triagemId: z.string().uuid(),
});

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const classifyTool = {
  type: "function" as const,
  function: {
    name: "registrar_triagem_juridica",
    description:
      "Registra a triagem jurídica estruturada de um caso novo descrito pelo cliente em potencial.",
    parameters: {
      type: "object",
      properties: {
        practice_area: {
          type: "string",
          enum: [
            "Trabalhista",
            "Cível",
            "Criminal",
            "Tributário",
            "Família e Sucessões",
            "Consumidor",
            "Previdenciário",
            "Empresarial",
            "Imobiliário",
            "Administrativo",
            "Ambiental",
            "Outro",
          ],
          description: "Área principal do direito aplicável ao caso.",
        },
        case_type: {
          type: "string",
          description:
            "Tipo de ação ou demanda sugerida (ex.: 'Reclamatória trabalhista', 'Ação de cobrança', 'Habeas corpus').",
        },
        urgency: {
          type: "string",
          enum: ["baixa", "media", "alta", "critica"],
          description: "Urgência: 'critica' para risco imediato ou prazo prescricional iminente.",
        },
        viability: {
          type: "string",
          enum: ["inviavel", "baixa", "media", "alta"],
          description: "Viabilidade jurídica do caso com base nos fatos descritos.",
        },
        success_probability: {
          type: "string",
          enum: ["baixa", "media", "alta"],
          description: "Probabilidade estimada de êxito.",
        },
        estimated_value: {
          type: "string",
          description:
            "Faixa estimada do valor da causa em reais (ex.: 'R$ 10.000 a R$ 50.000') ou 'Indeterminado'.",
        },
        summary: {
          type: "string",
          description: "Resumo executivo do caso em 2-4 frases, em português jurídico claro.",
        },
        key_facts: {
          type: "array",
          items: { type: "string" },
          description: "3-6 fatos juridicamente relevantes extraídos do relato.",
        },
        required_documents: {
          type: "array",
          items: { type: "string" },
          description: "Documentos essenciais a serem solicitados ao cliente.",
        },
        next_steps: {
          type: "array",
          items: { type: "string" },
          description: "3-5 próximos passos recomendados ao escritório.",
        },
        recommended_action: {
          type: "string",
          description:
            "Ação imediata recomendada (ex.: 'Agendar reunião presencial', 'Solicitar documentos', 'Recusar caso').",
        },
        risks: {
          type: "array",
          items: { type: "string" },
          description: "Riscos, pontos fracos ou alertas processuais a considerar.",
        },
        confidence: {
          type: "string",
          enum: ["baixa", "media", "alta"],
          description: "Confiança da análise diante das informações disponíveis.",
        },
      },
      required: [
        "practice_area",
        "case_type",
        "urgency",
        "viability",
        "success_probability",
        "estimated_value",
        "summary",
        "key_facts",
        "required_documents",
        "next_steps",
        "recommended_action",
        "risks",
        "confidence",
      ],
      additionalProperties: false,
    },
  },
};

export const classifyTriagem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("active_company_id")
      .eq("id", userId)
      .maybeSingle();
    const companyId = profile?.active_company_id;
    if (!companyId) throw new Error("Empresa ativa não encontrada");

    const { data: triagem, error: fetchErr } = await supabase
      .from("triagens")
      .select("id, raw_description, contact_name")
      .eq("id", data.triagemId)
      .eq("company_id", companyId)
      .single();

    if (fetchErr || !triagem) {
      throw new Error("Triagem não encontrada");
    }

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurado");

    const userPrompt = [
      `Cliente em potencial: ${triagem.contact_name ?? "—"}`,
      "",
      "Relato do caso:",
      triagem.raw_description,
    ].join("\n");

    const res = await fetch(AI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "Você é um advogado brasileiro sênior especializado em triagem de casos para escritórios de advocacia. Analise o relato fornecido e classifique o caso com rigor técnico, em português jurídico claro. Use a função registrar_triagem_juridica para retornar a análise estruturada. Seja honesto sobre a viabilidade — não force casos inviáveis.",
          },
          { role: "user", content: userPrompt },
        ],
        tools: [classifyTool],
        tool_choice: {
          type: "function",
          function: { name: "registrar_triagem_juridica" },
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (res.status === 429) {
        throw new Error("Limite de requisições atingido. Tente novamente em instantes.");
      }
      if (res.status === 402) {
        throw new Error(
          "Créditos de IA esgotados. Adicione créditos em Settings > Workspace > Usage.",
        );
      }
      console.error("Lovable AI error", res.status, text);
      throw new Error(`Falha na triagem por IA (${res.status})`);
    }

    const json = (await res.json()) as {
      choices?: Array<{
        message?: { tool_calls?: Array<{ function?: { arguments?: string } }> };
      }>;
    };

    const argsStr = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!argsStr) throw new Error("IA não retornou classificação estruturada.");

    let classification: Record<string, unknown>;
    try {
      classification = JSON.parse(argsStr);
    } catch {
      throw new Error("Resposta da IA inválida.");
    }

    const enriched = { ...classification, analyzed_at: new Date().toISOString() };

    const { error: updErr } = await supabase
      .from("triagens")
      .update({ ai_classification: enriched, status: "classificado" })
      .eq("id", data.triagemId)
      .eq("company_id", companyId);

    if (updErr) {
      console.error("Update triagem error", updErr);
      throw new Error("Não foi possível salvar a classificação.");
    }

    return { classification: enriched };
  });
