import { useEffect, useRef, useState } from "react";
import { Search, Loader2, Briefcase, Users, FileText, FileSignature } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";

type Hit = {
  id: string;
  kind: "processo" | "cliente" | "publicacao" | "contrato";
  title: string;
  subtitle?: string;
};

const ICONS = {
  processo: Briefcase,
  cliente: Users,
  publicacao: FileText,
  contrato: FileSignature,
} as const;

const LABELS = {
  processo: "Processos",
  cliente: "Clientes",
  publicacao: "Publicações",
  contrato: "Contratos",
} as const;

export function GlobalSearch() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hits, setHits] = useState<Hit[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);

  // close on outside click
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // debounced DB search
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      const like = `%${term}%`;
      const [proc, cli, pub, ctr] = await Promise.all([
        supabase
          .from("cases")
          .select("id, title, cnj_number, practice_area")
          .or(`title.ilike.${like},cnj_number.ilike.${like}`)
          .limit(5),
        supabase
          .from("clients")
          .select("id, name, email, document")
          .or(`name.ilike.${like},email.ilike.${like},document.ilike.${like}`)
          .limit(5),
        supabase
          .from("publications")
          .select("id, process_number, client_name, content")
          .or(
            `process_number.ilike.${like},client_name.ilike.${like},content.ilike.${like},lawyer_name.ilike.${like}`,
          )
          .limit(5),
        supabase
          .from("contracts")
          .select("id, title, counterparty")
          .or(`title.ilike.${like},counterparty.ilike.${like}`)
          .limit(5),
      ]);

      const out: Hit[] = [];
      (proc.data ?? []).forEach((r: any) =>
        out.push({
          id: r.id,
          kind: "processo",
          title: r.title,
          subtitle: r.cnj_number || r.practice_area || undefined,
        }),
      );
      (cli.data ?? []).forEach((r: any) =>
        out.push({
          id: r.id,
          kind: "cliente",
          title: r.name,
          subtitle: r.email || r.document || undefined,
        }),
      );
      (pub.data ?? []).forEach((r: any) =>
        out.push({
          id: r.id,
          kind: "publicacao",
          title: r.process_number || r.client_name || "Publicação",
          subtitle: (r.content ?? "").slice(0, 80),
        }),
      );
      (ctr.data ?? []).forEach((r: any) =>
        out.push({
          id: r.id,
          kind: "contrato",
          title: r.title,
          subtitle: r.counterparty || undefined,
        }),
      );
      setHits(out);
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const go = (h: Hit) => {
    setOpen(false);
    setQ("");
    if (h.kind === "processo") navigate({ to: "/app/processos" });
    else if (h.kind === "cliente") navigate({ to: "/app/clientes" });
    else if (h.kind === "publicacao") navigate({ to: "/app/publicacoes" });
    else navigate({ to: "/app/contratos" });
  };

  const grouped = (["processo", "cliente", "publicacao", "contrato"] as const)
    .map((k) => ({ kind: k, items: hits.filter((h) => h.kind === k) }))
    .filter((g) => g.items.length > 0);

  return (
    <div ref={wrapRef} className="hidden md:flex flex-1 max-w-md mx-2 relative">
      <div className="relative w-full">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => q && setOpen(true)}
          placeholder="Buscar processos, clientes, publicações, contratos..."
          className="w-full h-9 rounded-md border bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 transition"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
        )}
      </div>

      {open && q.trim().length >= 2 && (
        <div className="absolute top-11 left-0 right-0 z-30 rounded-md border bg-popover shadow-lg overflow-hidden">
          {grouped.length === 0 && !loading && (
            <div className="p-4 text-sm text-muted-foreground">Nenhum resultado encontrado.</div>
          )}
          <div className="max-h-[420px] overflow-y-auto">
            {grouped.map((g) => {
              const Icon = ICONS[g.kind];
              return (
                <div key={g.kind}>
                  <div className="px-3 py-1.5 text-[11px] uppercase tracking-wider text-muted-foreground bg-muted/40">
                    {LABELS[g.kind]}
                  </div>
                  {g.items.map((h) => (
                    <button
                      key={`${h.kind}-${h.id}`}
                      onClick={() => go(h)}
                      className="w-full flex items-start gap-3 px-3 py-2 hover:bg-accent text-left"
                    >
                      <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm truncate">{h.title}</div>
                        {h.subtitle && (
                          <div className="text-xs text-muted-foreground truncate">{h.subtitle}</div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
