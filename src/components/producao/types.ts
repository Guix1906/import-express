export type ColumnKey =
  | "pre_atendimento"
  | "atendimento_realizado"
  | "contrato_fechado"
  | "aguardando_documentos"
  | "para_producao"
  | "para_protocolo_judicial"
  | "protocolados_adm"
  | "intermediarias"
  | "arquivados"
  | "concluidos"
  | "em_revisao"
  | "pendencias";

export type Priority = "baixa" | "media" | "alta" | "urgente";

export type ProductionCard = {
  id: string;
  company_id: string;
  assignee_id: string;
  created_by: string;
  client_id: string | null;
  case_id: string | null;
  client_name_snapshot: string | null;
  process_number: string | null;
  practice_area: string | null;
  demand_type: string | null;
  title: string;
  description: string | null;
  priority: Priority;
  column_key: ColumnKey;
  status_flags: Record<string, unknown>;
  due_date: string | null;
  position: number;
  observations: string | null;
  triagem_id: string | null;
  questionnaire: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type CompanyMemberLite = { user_id: string; full_name: string | null };

export type CardComment = {
  id: string;
  card_id: string;
  author_id: string;
  content: string;
  created_at: string;
};

export type CardChecklistItem = {
  id: string;
  card_id: string;
  text: string;
  done: boolean;
  position: number;
};

export type CardWatcher = {
  id: string;
  card_id: string;
  profile_id: string;
};

export type CardEvent = {
  id: string;
  card_id: string;
  actor_id: string;
  event_type: string;
  payload: Record<string, unknown> | null;
  created_at: string;
};

export type CardDocument = {
  id: string;
  card_id: string | null;
  name: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
};

export type FinancialEntry = {
  id: string;
  entry_type: string;
  description: string;
  amount: number | string;
  status: string;
  due_date: string | null;
};

export const COLUMNS: { key: ColumnKey; label: string; accent: string }[] = [
  { key: "pre_atendimento", label: "Pré-atendimento", accent: "from-sky-500/25 to-sky-500/5" },
  {
    key: "atendimento_realizado",
    label: "Atendimento Realizado",
    accent: "from-cyan-500/25 to-cyan-500/5",
  },
  { key: "contrato_fechado", label: "Contrato Fechado", accent: "from-teal-500/25 to-teal-500/5" },
  {
    key: "aguardando_documentos",
    label: "Aguardando Documentos",
    accent: "from-yellow-500/25 to-yellow-500/5",
  },
  { key: "para_producao", label: "Em Produção", accent: "from-slate-500/20 to-slate-500/5" },
  {
    key: "para_protocolo_judicial",
    label: "Para Protocolo Judicial",
    accent: "from-blue-500/25 to-blue-500/5",
  },
  {
    key: "protocolados_adm",
    label: "Protocolados ADM",
    accent: "from-indigo-500/25 to-indigo-500/5",
  },
  { key: "intermediarias", label: "Acompanhamento", accent: "from-amber-500/25 to-amber-500/5" },
  { key: "em_revisao", label: "Em Revisão", accent: "from-violet-500/25 to-violet-500/5" },
  { key: "pendencias", label: "Pendências", accent: "from-rose-500/25 to-rose-500/5" },
  { key: "concluidos", label: "Finalizado", accent: "from-emerald-500/25 to-emerald-500/5" },
  { key: "arquivados", label: "Arquivados", accent: "from-zinc-500/20 to-zinc-500/5" },
];

export const COLUMN_LABEL: Record<string, string> = Object.fromEntries(
  COLUMNS.map((c) => [c.key, c.label]),
);

export const PRIORITY_STYLES: Record<Priority, string> = {
  baixa: "bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/20",
  media: "bg-blue-500/10 text-blue-600 dark:text-blue-300 border-blue-500/20",
  alta: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
  urgente: "bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/30",
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  urgente: "Urgente",
};

export function initials(name?: string | null) {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}
