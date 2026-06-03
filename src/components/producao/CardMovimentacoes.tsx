import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ProductionCard } from "./types";

type LinkedCase = {
  id: string;
  title: string;
  cnj_number: string | null;
  practice_area: string | null;
  phase: string | null;
  status: string | null;
  client_id: string | null;
  client: { name: string | null } | null;
};

type CaseSearchResult = {
  id: string;
  title: string;
  cnj_number: string | null;
  practice_area: string | null;
  client_id: string | null;
  client: { name: string | null } | null;
};

type Publication = {
  id: string;
  publication_date: string | null;
  court: string | null;
  content: string | null;
  status: string;
  process_number: string | null;
};

export function CardMovimentacoes({
  card,
  companyId,
  onLink,
}: {
  card: ProductionCard;
  companyId: string | null;
  onLink: (
    caseId: string | null,
    snapshot: {
      cnj_number?: string | null;
      practice_area?: string | null;
      client_id?: string | null;
    },
  ) => void;
}) {
  const [search, setSearch] = useState("");

  const { data: linkedCase } = useQuery({
    queryKey: ["card-case", card.case_id],
    enabled: !!card.case_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("cases")
        .select(
          "id, title, cnj_number, practice_area, phase, status, client_id, client:clients(name)",
        )
        .eq("id", card.case_id!)
        .maybeSingle();
      return data as unknown as LinkedCase | null;
    },
  });

  const { data: publications = [] } = useQuery({
    queryKey: ["card-publications", card.case_id, card.process_number],
    enabled: !!companyId && (!!card.case_id || !!card.process_number),
    queryFn: async () => {
      let q = supabase
        .from("publications")
        .select("id, publication_date, court, content, status, process_number")
        .eq("company_id", companyId!)
        .order("publication_date", { ascending: false, nullsFirst: false })
        .limit(20);
      if (card.case_id) q = q.eq("case_id", card.case_id);
      else if (card.process_number) q = q.eq("process_number", card.process_number);
      const { data } = await q;
      return (data ?? []) as unknown as Publication[];
    },
  });

  const { data: searchResults = [] } = useQuery({
    queryKey: ["case-search", companyId, search],
    enabled: !!companyId && search.trim().length >= 2,
    queryFn: async () => {
      const q = search.trim();
      const { data } = await supabase
        .from("cases")
        .select("id, title, cnj_number, practice_area, client_id, client:clients(name)")
        .eq("company_id", companyId!)
        .or(`title.ilike.%${q}%,cnj_number.ilike.%${q}%`)
        .limit(8);
      return (data ?? []) as unknown as CaseSearchResult[];
    },
  });

  return (
    <div className="space-y-3">
      {linkedCase ? (
        <div className="rounded-lg border bg-muted/20 p-3 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">{linkedCase.title}</p>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onLink(null, { cnj_number: null })}
              className="text-xs text-muted-foreground"
            >
              Desvincular
            </Button>
          </div>
          <div className="text-xs text-muted-foreground space-x-3">
            {linkedCase.cnj_number && <span>CNJ: {linkedCase.cnj_number}</span>}
            {linkedCase.practice_area && <span>{linkedCase.practice_area}</span>}
            {linkedCase.client?.name && <span>· {linkedCase.client.name}</span>}
            {linkedCase.phase && <span>· {linkedCase.phase}</span>}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-3 space-y-2">
          <p className="text-xs text-muted-foreground">Vincule este cartão a um processo do CNJ.</p>
          <Input
            placeholder="Buscar processo por título ou nº CNJ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {searchResults.length > 0 && (
            <div className="space-y-1">
              {searchResults.map((c) => (
                <button
                  key={c.id}
                  onClick={() =>
                    onLink(c.id, {
                      cnj_number: c.cnj_number,
                      practice_area: c.practice_area,
                      client_id: c.client_id,
                    })
                  }
                  className="w-full text-left rounded-md border px-2.5 py-2 hover:bg-accent/40 text-sm"
                >
                  <p className="font-medium">{c.title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {c.cnj_number ?? "Sem CNJ"} {c.client?.name ? `· ${c.client.name}` : ""}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">Publicações recentes</p>
        {publications.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6 border border-dashed rounded-lg">
            Nenhuma publicação vinculada.
          </p>
        ) : (
          <div className="space-y-2 max-h-[320px] overflow-y-auto">
            {publications.map((p) => (
              <div key={p.id} className="rounded-md border p-2.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{p.court ?? "Tribunal"}</span>
                  <span className="text-muted-foreground">
                    {p.publication_date ? format(new Date(p.publication_date), "dd/MM/yyyy") : "—"}
                  </span>
                </div>
                {p.content && (
                  <p className="text-muted-foreground mt-1 line-clamp-2">{p.content}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
