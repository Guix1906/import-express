import type { TriagePriority, TriageStatus } from "./types";

export const triageStatusLabels: Record<TriageStatus, string> = {
  draft: "Rascunho",
  waiting_lawyer: "Aguardando advogado",
  in_attendance: "Em atendimento",
  attendance_finished: "Atendimento finalizado",
  waiting_documents: "Aguardando documentos",
  converted: "Convertida",
  archived: "Arquivada",
};

export const triagePriorityLabels: Record<TriagePriority, string> = {
  low: "Baixa",
  medium: "Normal",
  high: "Alta",
  urgent: "Urgente",
};

export const triagePriorityClass: Record<TriagePriority, string> = {
  low: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700",
  medium: "border-sky-500/25 bg-sky-500/10 text-sky-700",
  high: "border-amber-500/30 bg-amber-500/10 text-amber-700",
  urgent: "border-rose-500/30 bg-rose-500/10 text-rose-700",
};

export const triageStatusClass: Record<TriageStatus, string> = {
  draft: "border-muted bg-muted/50 text-muted-foreground",
  waiting_lawyer: "border-amber-500/30 bg-amber-500/10 text-amber-700",
  in_attendance: "border-blue-500/30 bg-blue-500/10 text-blue-700",
  attendance_finished: "border-cyan-500/30 bg-cyan-500/10 text-cyan-700",
  waiting_documents: "border-violet-500/30 bg-violet-500/10 text-violet-700",
  converted: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
  archived: "border-slate-500/30 bg-slate-500/10 text-slate-600",
};

export const practiceAreaOptions = [
  "Previdenciario",
  "Trabalhista",
  "Civel",
  "Familia",
  "Consumidor",
  "Criminal",
  "Empresarial",
  "Tributario",
  "Imobiliario",
  "Bancario",
  "Administrativo",
  "Digital/LGPD",
] as const;

export const demandTypeOptionsByArea: Record<string, string[]> = {
  Previdenciario: [
    "Aposentadoria",
    "Auxilio-doenca",
    "BPC/LOAS",
    "Pensao por morte",
    "Revisao de beneficio",
    "Planejamento previdenciario",
  ],
  Trabalhista: [
    "Verbas rescisorias",
    "Horas extras",
    "Reconhecimento de vinculo",
    "Acidente de trabalho",
    "Assedio moral",
    "Defesa trabalhista",
  ],
  Civel: [
    "Cobranca",
    "Indenizacao",
    "Obrigacao de fazer",
    "Contrato",
    "Responsabilidade civil",
    "Execucao",
  ],
  Familia: [
    "Divorcio",
    "Pensao alimenticia",
    "Guarda",
    "Inventario",
    "Uniao estavel",
    "Partilha de bens",
  ],
  Consumidor: [
    "Produto/servico com defeito",
    "Negativacao indevida",
    "Plano de saude",
    "Banco/cartao",
    "Compra online",
    "Cancelamento/reembolso",
  ],
  Criminal: [
    "Audiencia de custodia",
    "Inquerito policial",
    "Defesa criminal",
    "Maria da Penha",
    "Habeas corpus",
    "Acompanhamento em delegacia",
  ],
  Empresarial: [
    "Contrato empresarial",
    "Cobranca empresarial",
    "Societario",
    "Recuperacao de credito",
    "Compliance",
    "Consultoria recorrente",
  ],
  Tributario: [
    "Defesa fiscal",
    "Execucao fiscal",
    "Parcelamento",
    "Recuperacao tributaria",
    "Planejamento tributario",
    "Auto de infracao",
  ],
  Imobiliario: [
    "Compra e venda",
    "Locacao",
    "Usucapiao",
    "Regularizacao de imovel",
    "Condominio",
    "Distrato imobiliario",
  ],
  Bancario: [
    "Revisional de contrato",
    "Juros abusivos",
    "Busca e apreensao",
    "Fraude bancaria",
    "Superendividamento",
    "Cartao/emprestimo",
  ],
  Administrativo: [
    "Servidor publico",
    "Concurso publico",
    "Processo administrativo",
    "Licitacao",
    "Improbidade",
    "Beneficio administrativo",
  ],
  "Digital/LGPD": [
    "Vazamento de dados",
    "Remocao de conteudo",
    "Golpe digital",
    "Adequacao LGPD",
    "Contrato digital",
    "Crime virtual",
  ],
};

export const triageOriginOptions = [
  "Indicacao",
  "Google",
  "Instagram",
  "WhatsApp",
  "Site",
  "Cliente antigo",
  "Retorno",
  "Presencial",
  "Convenio/parceria",
] as const;

export function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function isValidCpf(value: string) {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;

  const calc = (factor: number) => {
    let total = 0;
    for (let i = 0; i < factor - 1; i += 1) total += Number(cpf[i]) * (factor - i);
    const rest = (total * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  return calc(10) === Number(cpf[9]) && calc(11) === Number(cpf[10]);
}

export function isValidCnpj(value: string) {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;

  const calc = (weights: number[]) => {
    const total = weights.reduce((sum, weight, index) => sum + Number(cnpj[index]) * weight, 0);
    const rest = total % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  return (
    calc([5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(cnpj[12]) &&
    calc([6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(cnpj[13])
  );
}

export function validateCpfCnpj(value: string) {
  const digits = onlyDigits(value);
  if (!digits) return { valid: true, message: "" };
  if (digits.length === 11) {
    return isValidCpf(digits)
      ? { valid: true, message: "" }
      : { valid: false, message: "CPF invalido" };
  }
  if (digits.length === 14) {
    return isValidCnpj(digits)
      ? { valid: true, message: "" }
      : { valid: false, message: "CNPJ invalido" };
  }
  return { valid: false, message: "Informe CPF com 11 digitos ou CNPJ com 14 digitos" };
}

export function validateCpfOnly(value: string) {
  const digits = onlyDigits(value);
  if (digits.length !== 11) {
    return { valid: false, message: "Informe um CPF com exatamente 11 digitos" };
  }
  if (!isValidCpf(digits)) {
    return { valid: false, message: "CPF invalido. Confira os numeros informados." };
  }
  return { valid: true, message: "" };
}

export function elapsedLabel(value: string | null) {
  if (!value) return "sem data";
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.floor(diff / 60000));
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function fmtDateTime(value: string | null) {
  if (!value) return "Nao informado";
  return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
