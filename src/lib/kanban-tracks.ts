// Definições compartilhadas dos dois eixos do kanban jurídico.

export type LegalPhase =
  | "triagem"
  | "contrato_fechado"
  | "peticao_inicial"
  | "citacao"
  | "contestacao"
  | "instrucao"
  | "sentenca"
  | "recurso"
  | "execucao"
  | "arquivado";

export type OperationalStatus =
  | "aguardando_documentos"
  | "em_analise"
  | "em_producao"
  | "em_revisao"
  | "protocolado"
  | "acompanhamento"
  | "pendencias"
  | "finalizado";

export type Track = "legal" | "operational";

export const LEGAL_PHASES: { key: LegalPhase; label: string; tone: string }[] = [
  {
    key: "triagem",
    label: "Triagem",
    tone: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30",
  },
  {
    key: "contrato_fechado",
    label: "Contrato fechado",
    tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  },
  {
    key: "peticao_inicial",
    label: "Petição inicial",
    tone: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30",
  },
  {
    key: "citacao",
    label: "Citação",
    tone: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30",
  },
  {
    key: "contestacao",
    label: "Contestação",
    tone: "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/30",
  },
  {
    key: "instrucao",
    label: "Instrução",
    tone: "bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-500/30",
  },
  {
    key: "sentenca",
    label: "Sentença",
    tone: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  },
  {
    key: "recurso",
    label: "Recurso",
    tone: "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/30",
  },
  {
    key: "execucao",
    label: "Execução",
    tone: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30",
  },
  {
    key: "arquivado",
    label: "Arquivado",
    tone: "bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 border-zinc-500/30",
  },
];

export const OPERATIONAL_STATUSES: { key: OperationalStatus; label: string; tone: string }[] = [
  {
    key: "aguardando_documentos",
    label: "Aguardando documentos",
    tone: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  },
  {
    key: "em_analise",
    label: "Em análise",
    tone: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30",
  },
  {
    key: "em_producao",
    label: "Em produção",
    tone: "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/30",
  },
  {
    key: "em_revisao",
    label: "Em revisão",
    tone: "bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-500/30",
  },
  {
    key: "protocolado",
    label: "Protocolado",
    tone: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/30",
  },
  {
    key: "acompanhamento",
    label: "Acompanhamento",
    tone: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30",
  },
  {
    key: "pendencias",
    label: "Pendências",
    tone: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30",
  },
  {
    key: "finalizado",
    label: "Finalizado",
    tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  },
];

export const PRIORITY_TONE: Record<string, string> = {
  baixa: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
  media: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  alta: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  urgente: "bg-rose-500/15 text-rose-700 dark:text-rose-300 animate-pulse",
};

export function legalLabel(k: string) {
  return LEGAL_PHASES.find((p) => p.key === k)?.label ?? k;
}
export function opLabel(k: string) {
  return OPERATIONAL_STATUSES.find((p) => p.key === k)?.label ?? k;
}
