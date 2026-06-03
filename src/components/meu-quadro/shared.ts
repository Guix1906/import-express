import type { QuadroCard } from "@/components/quadros/CardDrawer";

export type AppRole = "owner" | "admin" | "lawyer" | "assistant" | "viewer";

export type MemberLite = {
  user_id: string;
  full_name: string;
  role: AppRole | null;
  total: number;
};

export type Card = QuadroCard;

export type MemberColumn = {
  id: string;
  key: string;
  title: string;
  color: string;
  position: number;
};

export type BoardLite = {
  id: string;
  name: string;
  description: string | null;
  board_type: string;
  color: string;
  gradient: string | null;
  icon: string | null;
  owner_id: string | null;
  role_label: string | null;
  created_at: string;
};

export const ROLE_LABEL: Record<AppRole, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  lawyer: "Advogado(a)",
  assistant: "Assistente",
  viewer: "Estagiário(a)",
};

// Premium per-member palette (cycled by index) — Vibrant SaaS
export const MEMBER_PALETTE = [
  {
    bg: "bg-indigo-50",
    ring: "ring-indigo-200",
    avatar: "bg-gradient-to-br from-indigo-500 to-indigo-700",
    dot: "bg-indigo-500",
    text: "text-indigo-700",
  },
  {
    bg: "bg-sky-50",
    ring: "ring-sky-200",
    avatar: "bg-gradient-to-br from-sky-500 to-sky-700",
    dot: "bg-sky-500",
    text: "text-sky-700",
  },
  {
    bg: "bg-emerald-50",
    ring: "ring-emerald-200",
    avatar: "bg-gradient-to-br from-emerald-500 to-emerald-700",
    dot: "bg-emerald-500",
    text: "text-emerald-700",
  },
  {
    bg: "bg-violet-50",
    ring: "ring-violet-200",
    avatar: "bg-gradient-to-br from-violet-500 to-violet-700",
    dot: "bg-violet-500",
    text: "text-violet-700",
  },
  {
    bg: "bg-amber-50",
    ring: "ring-amber-200",
    avatar: "bg-gradient-to-br from-amber-500 to-amber-600",
    dot: "bg-amber-500",
    text: "text-amber-700",
  },
  {
    bg: "bg-red-50",
    ring: "ring-red-200",
    avatar: "bg-gradient-to-br from-red-500 to-red-700",
    dot: "bg-red-500",
    text: "text-red-700",
  },
  {
    bg: "bg-teal-50",
    ring: "ring-teal-200",
    avatar: "bg-gradient-to-br from-teal-500 to-teal-700",
    dot: "bg-teal-500",
    text: "text-teal-700",
  },
  {
    bg: "bg-slate-50",
    ring: "ring-slate-300",
    avatar: "bg-gradient-to-br from-slate-700 to-slate-900",
    dot: "bg-slate-700",
    text: "text-slate-800",
  },
];

export type MemberPalette = (typeof MEMBER_PALETTE)[number];

export const COLUMN_COLORS: { key: string; label: string; dot: string; ring: string }[] = [
  { key: "indigo", label: "Índigo", dot: "bg-indigo-500", ring: "ring-indigo-300" },
  { key: "sky", label: "Azul", dot: "bg-sky-500", ring: "ring-sky-300" },
  { key: "emerald", label: "Verde", dot: "bg-emerald-500", ring: "ring-emerald-300" },
  { key: "violet", label: "Violeta", dot: "bg-violet-500", ring: "ring-violet-300" },
  { key: "amber", label: "Âmbar", dot: "bg-amber-500", ring: "ring-amber-300" },
  { key: "red", label: "Vermelho", dot: "bg-red-500", ring: "ring-red-300" },
  { key: "teal", label: "Teal", dot: "bg-teal-500", ring: "ring-teal-300" },
  { key: "slate", label: "Cinza", dot: "bg-slate-500", ring: "ring-slate-300" },
];

export function colorClasses(key: string) {
  return COLUMN_COLORS.find((c) => c.key === key) ?? COLUMN_COLORS[0];
}

export const DEFAULT_COLUMNS: Array<{ key: string; title: string; color: string }> = [
  { key: "para_producao", title: "Para produção", color: "indigo" },
  { key: "para_protocolo", title: "Para protocolo judicial", color: "sky" },
  { key: "protocolados", title: "Protocolados / ADM", color: "emerald" },
  { key: "intermediarias", title: "Intermediárias / Arquivados", color: "violet" },
];

export const PRIORITY_DOT: Record<string, string> = {
  baixa: "bg-slate-400",
  media: "bg-sky-500",
  alta: "bg-amber-500",
  urgente: "bg-red-500",
};

export function initials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

export function paletteFor(index: number) {
  return MEMBER_PALETTE[index % MEMBER_PALETTE.length];
}
