import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { FinancialEntry, ProductionCard } from "./types";

type EntryType = "honorario" | "receita" | "despesa";

export function CardFinanceiro({
  card,
  companyId,
  userId,
}: {
  card: ProductionCard;
  companyId: string | null;
  userId: string;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [entryType, setEntryType] = useState<EntryType>("honorario");

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["card-financial", card.id, card.case_id, card.client_id],
    enabled: !!companyId,
    queryFn: async () => {
      let q = supabase
        .from("financial_entries")
        .select("*")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false })
        .limit(30);
      if (card.case_id) q = q.eq("case_id", card.case_id);
      else if (card.client_id) q = q.eq("client_id", card.client_id);
      else return [];
      const { data } = await q;
      return (data ?? []) as unknown as FinancialEntry[];
    },
  });

  async function addEntry() {
    if (!companyId || !amount.trim()) {
      toast.error("Informe um valor");
      return;
    }
    const value = Number(amount.replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Valor inválido");
      return;
    }
    const { error } = await supabase.from("financial_entries").insert({
      company_id: companyId,
      created_by: userId,
      entry_type: entryType,
      description: description.trim() || `${entryType} — ${card.title}`,
      amount: value,
      due_date: dueDate || null,
      status: "pendente",
      case_id: card.case_id,
      client_id: card.client_id,
    });
    if (error) {
      toast.error("Erro ao lançar");
      return;
    }
    await supabase.from("production_card_events").insert({
      company_id: companyId,
      card_id: card.id,
      actor_id: userId,
      event_type: "financial_added",
      payload: { amount: value, entry_type: entryType },
    });
    toast.success("Lançamento criado");
    setAmount("");
    setDescription("");
    setDueDate("");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["card-financial", card.id] });
    qc.invalidateQueries({ queryKey: ["card-events", card.id] });
  }

  const total = entries.reduce(
    (acc, e) => {
      const v = Number(e.amount);
      if (e.entry_type === "despesa") acc.despesa += v;
      else acc.receita += v;
      return acc;
    },
    { receita: 0, despesa: 0 },
  );

  const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  if (!card.case_id && !card.client_id) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Vincule um processo ou cliente ao cartão para gerenciar lançamentos financeiros.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border bg-emerald-500/5 p-2.5">
          <p className="text-[10px] uppercase text-muted-foreground">Receitas / Honorários</p>
          <p className="text-base font-semibold text-emerald-600">{fmt(total.receita)}</p>
        </div>
        <div className="rounded-lg border bg-rose-500/5 p-2.5">
          <p className="text-[10px] uppercase text-muted-foreground">Despesas</p>
          <p className="text-base font-semibold text-rose-600">{fmt(total.despesa)}</p>
        </div>
      </div>

      {open ? (
        <div className="rounded-lg border p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Select value={entryType} onValueChange={(v) => setEntryType(v as EntryType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="honorario">Honorário</SelectItem>
                <SelectItem value="receita">Receita</SelectItem>
                <SelectItem value="despesa">Despesa</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Valor (R$)"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <Input
            placeholder="Descrição (opcional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={addEntry}>
              Lançar
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="w-full">
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Novo lançamento
        </Button>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
      ) : entries.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6 border border-dashed rounded-lg">
          Nenhum lançamento vinculado.
        </p>
      ) : (
        <div className="space-y-1.5 max-h-[280px] overflow-y-auto">
          {entries.map((e) => (
            <div
              key={e.id}
              className="flex items-center justify-between rounded-md border p-2 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{e.description}</p>
                <p className="text-[11px] text-muted-foreground">
                  {e.entry_type} · {e.status}
                  {e.due_date && ` · vence ${format(new Date(e.due_date), "dd/MM/yyyy")}`}
                </p>
              </div>
              <span
                className={cn(
                  "font-semibold",
                  e.entry_type === "despesa" ? "text-rose-600" : "text-emerald-600",
                )}
              >
                {fmt(Number(e.amount))}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
