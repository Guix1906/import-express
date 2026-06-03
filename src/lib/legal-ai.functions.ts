import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({
  publicationId: z.string().uuid(),
});

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const analysisTool = {
  type: "function" as const,
  function: {
    name: "registrar_analise_publicacao",
    description: "Registra a análise jurídica estruturada de uma publicação processual brasileira.",
    parameters: {
      type: "object",
      properties: {
        summary: {
          type: "string",
          description:
            "Resumo executivo da publicação em 2-4 frases, claro e objetivo, em português.",
        },
        urgency: {
          type: "string",
          enum: ["baixa", "media", "alta", "critica"],
          description:
            "Nível de urgência. 'critica' para prazos de 24-48h ou medidas urgentes; 'alta' para prazos curtos (<=5 dias).",
        },
        petition_type: {
          type: "string",
          description:
            "Tipo de peça processual sugerido (ex: Contestação, Réplica, Embargos, Recurso, Manifestação, Cumprimento de sentença).",
        },
        deadline_days: {
          type: "number",
          description:
            "Quantidade de dias úteis sugerida para o prazo, conforme CPC. Use 0 se não houver prazo identificável.",
        },
        deadline_title: {
          type: "string",
          description: "Título curto e acionável para o prazo (ex: 'Apresentar contestação').",
        },
        key_points: {
          type: "array",
          items: { type: "string" },
          description: "3-5 pontos-chave/ações recomendadas extraídos da publicação.",
        },
        confidence: {
          type: "string",
          enum: ["baixa", "media", "alta"],
          description: "Confiança da análise. 'baixa' quando o texto é ambíguo ou incompleto.",
        },
        is_double_term: {
          type: "boolean",
          description:
            "true quando a parte intimada goza de prazo em dobro (Fazenda Pública, Ministério Público, Defensoria Pública, litisconsortes com procuradores distintos em autos físicos — CPC art. 183/186/180/229).",
        },
      },
      required: [
        "summary",
        "urgency",
        "petition_type",
        "deadline_days",
        "deadline_title",
        "key_points",
        "confidence",
        "is_double_term",
      ],
      additionalProperties: false,
    },
  },
};

export const analyzePublication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Garante que a publicação pertence à empresa ativa do usuário (anti-IDOR).
    const { data: profile } = await supabase
      .from("profiles")
      .select("active_company_id")
      .eq("id", userId)
      .maybeSingle();
    const companyId = profile?.active_company_id;
    if (!companyId) throw new Error("Empresa ativa não encontrada");

    const { data: pub, error: fetchErr } = await supabase
      .from("publications")
      .select(
        "id, content, process_number, process_subject, court, communication_type, publication_date",
      )
      .eq("id", data.publicationId)
      .eq("company_id", companyId)
      .single();

    if (fetchErr || !pub) {
      throw new Error("Publicação não encontrada");
    }

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      throw new Error("LOVABLE_API_KEY não configurado");
    }

    const userPrompt = [
      `Processo: ${pub.process_number ?? "—"}`,
      `Assunto: ${pub.process_subject ?? "—"}`,
      `Tribunal: ${pub.court ?? "—"}`,
      `Tipo de comunicação: ${pub.communication_type ?? "—"}`,
      `Data publicação: ${pub.publication_date ?? "—"}`,
      "",
      "Inteiro teor da publicação:",
      pub.content ?? "(sem conteúdo)",
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
              "Você é um advogado brasileiro experiente especialista em análise de publicações processuais (DJe, diários oficiais). Analise a publicação fornecida e extraia informações estruturadas seguindo o CPC. Sempre responda em português jurídico claro. Se não houver prazo evidente, use deadline_days=0. Use a função registrar_analise_publicacao.",
          },
          { role: "user", content: userPrompt },
        ],
        tools: [analysisTool],
        tool_choice: {
          type: "function",
          function: { name: "registrar_analise_publicacao" },
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (res.status === 429) {
        throw new Error("Limite de requisições atingido. Tente novamente em alguns instantes.");
      }
      if (res.status === 402) {
        throw new Error(
          "Créditos de IA esgotados. Adicione créditos em Settings > Workspace > Usage.",
        );
      }
      console.error("Lovable AI error", res.status, text);
      throw new Error(`Falha na análise por IA (${res.status})`);
    }

    const json = (await res.json()) as {
      choices?: Array<{
        message?: {
          tool_calls?: Array<{ function?: { arguments?: string } }>;
        };
      }>;
    };

    const argsStr = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!argsStr) {
      throw new Error("IA não retornou análise estruturada.");
    }

    let analysis: Record<string, unknown>;
    try {
      analysis = JSON.parse(argsStr);
    } catch {
      throw new Error("Resposta da IA inválida.");
    }

    const enriched = { ...analysis, analyzed_at: new Date().toISOString() };

    const { error: updErr } = await supabase
      .from("publications")
      .update({ ai_analysis: enriched })
      .eq("id", data.publicationId)
      .eq("company_id", companyId);

    if (updErr) {
      console.error("Update ai_analysis error", updErr);
      throw new Error("Não foi possível salvar a análise.");
    }

    return { analysis: enriched };
  });
