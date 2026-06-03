import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { ProductionCard } from "./types";

type Field = { key: string; label: string; type: "text" | "number" | "date" | "textarea" };

const TEMPLATES: Record<string, Field[]> = {
  aposentadoria: [
    { key: "idade", label: "Idade", type: "number" },
    { key: "tempo_contribuicao", label: "Tempo de contribuição (anos)", type: "number" },
    { key: "vinculos", label: "Vínculos empregatícios relevantes", type: "textarea" },
    { key: "data_dii", label: "Data do início da incapacidade (se houver)", type: "date" },
  ],
  auxilio: [
    { key: "cid", label: "CID", type: "text" },
    { key: "data_afastamento", label: "Data do afastamento", type: "date" },
    { key: "laudos", label: "Laudos / exames disponíveis", type: "textarea" },
  ],
  loas: [
    { key: "renda_familiar", label: "Renda familiar mensal (R$)", type: "number" },
    { key: "composicao_familiar", label: "Composição familiar", type: "textarea" },
    { key: "deficiencia", label: "Deficiência / incapacidade", type: "textarea" },
  ],
  pensao: [
    { key: "nome_falecido", label: "Nome do(a) falecido(a)", type: "text" },
    { key: "data_obito", label: "Data do óbito", type: "date" },
    { key: "dependentes", label: "Dependentes", type: "textarea" },
  ],
};

function pickTemplate(demandType?: string | null): { key: string; fields: Field[] } {
  const d = (demandType ?? "").toLowerCase();
  if (d.includes("aposent")) return { key: "aposentadoria", fields: TEMPLATES.aposentadoria };
  if (d.includes("aux") || d.includes("incap"))
    return { key: "auxilio", fields: TEMPLATES.auxilio };
  if (d.includes("loas") || d.includes("bpc")) return { key: "loas", fields: TEMPLATES.loas };
  if (d.includes("pens")) return { key: "pensao", fields: TEMPLATES.pensao };
  return { key: "aposentadoria", fields: TEMPLATES.aposentadoria };
}

export function CardQuestionnaire({
  card,
  onSaved,
}: {
  card: ProductionCard;
  onSaved: () => void;
}) {
  const tpl = useMemo(() => pickTemplate(card.demand_type), [card.demand_type]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const q = (card.questionnaire ?? {}) as Record<string, unknown>;
    const init: Record<string, string> = {};
    tpl.fields.forEach((f) => {
      const v = q[f.key];
      init[f.key] = v == null ? "" : String(v);
    });
    setValues(init);
  }, [card.id, card.questionnaire, tpl]);

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("production_cards")
      .update({ questionnaire: { _template: tpl.key, ...values } } as never)
      .eq("id", card.id);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar questionário");
      return;
    }
    toast.success("Questionário salvo");
    onSaved();
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Template: <span className="font-medium capitalize">{tpl.key}</span> (definido pelo tipo de
        demanda do card).
      </p>
      {tpl.fields.map((f) => (
        <div key={f.key} className="space-y-1">
          <Label className="text-xs">{f.label}</Label>
          {f.type === "textarea" ? (
            <Textarea
              rows={2}
              value={values[f.key] ?? ""}
              onChange={(e) => setValues((s) => ({ ...s, [f.key]: e.target.value }))}
            />
          ) : (
            <Input
              type={f.type}
              value={values[f.key] ?? ""}
              onChange={(e) => setValues((s) => ({ ...s, [f.key]: e.target.value }))}
            />
          )}
        </div>
      ))}
      <Button onClick={save} disabled={saving}>
        {saving ? "Salvando..." : "Salvar questionário"}
      </Button>
    </div>
  );
}
