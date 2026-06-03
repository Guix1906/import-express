import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import type { ProductionCard } from "./types";

type TriagemRow = {
  id: string;
  contact_name: string;
  cpf: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  city: string | null;
  address: string | null;
  practice_area: string | null;
  benefit_type: string | null;
  observations: string | null;
  raw_description: string | null;
  status: string;
  created_at: string;
};

type TriagemCreds = {
  gov_password: string | null;
  inss_password: string | null;
};

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-1.5 text-sm border-b border-border/40 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="col-span-2">
        {value || <span className="text-muted-foreground">—</span>}
      </span>
    </div>
  );
}

export function CardPreliminares({ card }: { card: ProductionCard }) {
  const { data: triagem, isLoading } = useQuery({
    queryKey: ["card-triagem", card.triagem_id],
    enabled: !!card.triagem_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("triagens")
        .select(
          "id, contact_name, cpf, contact_phone, contact_email, city, address, practice_area, benefit_type, observations, raw_description, status, created_at",
        )
        .eq("id", card.triagem_id!)
        .maybeSingle();
      if (error) throw error;
      return data as TriagemRow | null;
    },
  });

  // Credenciais restritas (RLS: somente owner/admin/autor conseguem ler)
  const { data: creds } = useQuery({
    queryKey: ["card-triagem-creds", card.triagem_id],
    enabled: !!card.triagem_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("triagem_credentials")
        .select("gov_password, inss_password")
        .eq("triagem_id", card.triagem_id!)
        .maybeSingle();
      if (error) return null;
      return (data ?? null) as TriagemCreds | null;
    },
  });

  if (!card.triagem_id) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        Este cartão não foi originado de uma triagem.
      </p>
    );
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>;
  if (!triagem) return <p className="text-sm text-muted-foreground">Triagem não encontrada.</p>;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Badge variant="outline">{triagem.status}</Badge>
        <span className="text-xs text-muted-foreground">
          Triagem criada em {new Date(triagem.created_at).toLocaleString("pt-BR")}
        </span>
      </div>
      <div className="rounded-lg border bg-muted/20 p-3">
        <Row label="Nome" value={triagem.contact_name} />
        <Row label="CPF" value={triagem.cpf} />
        <Row label="Telefone" value={triagem.contact_phone} />
        <Row label="E-mail" value={triagem.contact_email} />
        <Row label="Cidade" value={triagem.city} />
        <Row label="Endereço" value={triagem.address} />
        <Row label="Área" value={triagem.practice_area} />
        <Row label="Benefício" value={triagem.benefit_type} />
        <Row label="Senha GOV.BR" value={creds?.gov_password ?? null} />
        <Row label="Senha Meu INSS" value={creds?.inss_password ?? null} />
      </div>
      {triagem.observations && (
        <div>
          <p className="text-xs text-muted-foreground mb-1">Observações</p>
          <p className="text-sm whitespace-pre-wrap rounded-md border bg-muted/20 p-2">
            {triagem.observations}
          </p>
        </div>
      )}
    </div>
  );
}
