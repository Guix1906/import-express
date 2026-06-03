// Util ViaCEP - autocomplete de endereço a partir do CEP
export type ViaCepResult = {
  cep?: string;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
};

export function maskCep(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

export async function lookupCep(cep: string): Promise<ViaCepResult | null> {
  const digits = cep.replace(/\D/g, "");
  if (digits.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    if (!res.ok) return null;
    const data = (await res.json()) as ViaCepResult;
    if (data.erro) return null;
    return data;
  } catch {
    return null;
  }
}

export function formatAddressFromCep(data: ViaCepResult): {
  address: string;
  city: string;
} {
  const parts = [data.logradouro, data.bairro].filter(Boolean) as string[];
  const city = [data.localidade, data.uf].filter(Boolean).join(" / ");
  return { address: parts.join(", "), city };
}
