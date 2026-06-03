import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MemberProductionRow = {
  member_id: string;
  member_name: string;
  member_role: string | null;
  avatar_url: string | null;
  total: number;
  by_status: Record<string, number>;
  overdue: number;
  finalizados: number;
  em_andamento: number;
  em_revisao: number;
  produtividade: number; // 0-100
  tempo_medio_horas: number | null;
};

export type CardExportRow = {
  id: string;
  data: string;
  colaborador: string;
  cliente: string;
  processo: string;
  area: string;
  atividade: string;
  status: string;
  fase_processual: string;
  prioridade: string;
  prazo: string;
  observacoes: string;
};

export type MonthlySeriesPoint = {
  month: string; // YYYY-MM
  criados: number;
  finalizados: number;
};

export type StatusBucket = { status: string; count: number };
export type Bottleneck = { status: string; avg_hours: number; count: number };

export type OperationalCard = {
  id: string;
  title: string;
  client_name: string | null;
  process_number: string | null;
  practice_area: string | null;
  operational_status: string;
  legal_phase: string | null;
  priority: string;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  assignee_id: string | null;
  assignee_name: string | null;
  created_by: string | null;
  creator_name: string | null;
};

export type ProducaoDashboard = {
  totals: {
    total: number;
    em_andamento: number;
    concluidos: number;
    atrasados: number;
    protocolados: number;
    arquivados: number;
    em_revisao: number;
  };
  members: MemberProductionRow[];
  by_status: StatusBucket[];
  by_priority: StatusBucket[];
  monthly: MonthlySeriesPoint[];
  bottlenecks: Bottleneck[];
  cards: CardExportRow[];
  cards_full: OperationalCard[];
};

const FINALIZADOS = new Set(["finalizado", "concluido"]);
const ARQUIVADOS = new Set(["arquivado"]);
const PROTOCOLADOS = new Set(["protocolado"]);
const EM_ANDAMENTO_SET = new Set([
  "aguardando_documentos",
  "em_analise",
  "em_producao",
  "em_revisao",
  "acompanhamento",
  "pendencias",
  "a_fazer",
  "para_producao",
]);

export const getProducaoEscritorio = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ProducaoDashboard> => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("active_company_id")
      .eq("id", userId)
      .maybeSingle();
    const companyId = profile?.active_company_id;
    const empty: ProducaoDashboard = {
      totals: {
        total: 0,
        em_andamento: 0,
        concluidos: 0,
        atrasados: 0,
        protocolados: 0,
        arquivados: 0,
        em_revisao: 0,
      },
      members: [],
      by_status: [],
      by_priority: [],
      monthly: [],
      bottlenecks: [],
      cards: [],
      cards_full: [],
    };
    if (!companyId) return empty;

    const [cardsRes, membersRes, rolesRes] = await Promise.all([
      supabase
        .from("production_cards")
        .select(
          "id, title, assignee_id, created_by, client_name_snapshot, process_number, practice_area, priority, operational_status, legal_phase, due_date, observations, created_at, completed_at, operational_status_changed_at, department",
        )
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(1000),
      supabase
        .from("company_members")
        .select("user_id, profiles:profiles!inner(id, full_name, avatar_url)")
        .eq("company_id", companyId),
      supabase.from("user_roles").select("user_id, role").eq("company_id", companyId),
    ]);

    const cards = cardsRes.data ?? [];
    const roleRank: Record<string, number> = { owner: 3, admin: 2, lawyer: 1, member: 0 };
    const roleMap = new Map<string, string>();
    (rolesRes.data ?? []).forEach((r: any) => {
      const prev = roleMap.get(r.user_id);
      if (!prev || (roleRank[r.role] ?? -1) > (roleRank[prev] ?? -1))
        roleMap.set(r.user_id, r.role);
    });
    const memberMap = new Map<
      string,
      { name: string; avatar: string | null; role: string | null }
    >();
    (membersRes.data ?? []).forEach((m: any) => {
      const id = m.profiles?.id ?? m.user_id;
      memberMap.set(id, {
        name: m.profiles?.full_name ?? "—",
        avatar: m.profiles?.avatar_url ?? null,
        role: roleMap.get(id) ?? null,
      });
    });

    const now = new Date();
    const acc = new Map<string, MemberProductionRow & { _tempoTotal: number; _tempoN: number }>();
    const byStatus = new Map<string, number>();
    const byPriority = new Map<string, number>();
    const monthly = new Map<string, MonthlySeriesPoint>();

    // initialize last 6 months
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthly.set(key, { month: key, criados: 0, finalizados: 0 });
    }

    let total = 0;
    let totalAndamento = 0;
    let totalConcluidos = 0;
    let totalAtrasados = 0;
    let totalProtocolados = 0;
    let totalArquivados = 0;
    let totalRevisao = 0;

    for (const c of cards) {
      total++;
      const st = c.operational_status ?? "—";
      byStatus.set(st, (byStatus.get(st) ?? 0) + 1);
      byPriority.set(c.priority ?? "media", (byPriority.get(c.priority ?? "media") ?? 0) + 1);

      const isConcluido = FINALIZADOS.has(st) || !!c.completed_at;
      if (isConcluido) totalConcluidos++;
      else if (ARQUIVADOS.has(st)) totalArquivados++;
      if (PROTOCOLADOS.has(st)) totalProtocolados++;
      if (st === "em_revisao") totalRevisao++;
      if (!isConcluido && !ARQUIVADOS.has(st)) totalAndamento++;
      if (c.due_date && new Date(c.due_date) < now && !isConcluido && !ARQUIVADOS.has(st))
        totalAtrasados++;

      // monthly
      const created = c.created_at ? new Date(c.created_at) : null;
      if (created) {
        const key = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, "0")}`;
        const m = monthly.get(key);
        if (m) m.criados++;
      }
      const completed = c.completed_at ? new Date(c.completed_at) : null;
      if (completed) {
        const key = `${completed.getFullYear()}-${String(completed.getMonth() + 1).padStart(2, "0")}`;
        const m = monthly.get(key);
        if (m) m.finalizados++;
      }

      // member
      const mid = c.assignee_id ?? "—";
      const info = memberMap.get(mid);
      const row =
        acc.get(mid) ??
        ({
          member_id: mid,
          member_name: info?.name ?? "Não atribuído",
          member_role: info?.role ?? null,
          avatar_url: info?.avatar ?? null,
          total: 0,
          by_status: {},
          overdue: 0,
          finalizados: 0,
          em_andamento: 0,
          em_revisao: 0,
          produtividade: 0,
          tempo_medio_horas: null,
          _tempoTotal: 0,
          _tempoN: 0,
        } as any);
      row.total++;
      row.by_status[st] = (row.by_status[st] ?? 0) + 1;
      if (FINALIZADOS.has(st)) row.finalizados++;
      if (EM_ANDAMENTO_SET.has(st)) row.em_andamento++;
      if (st === "em_revisao") row.em_revisao++;
      if (c.due_date && new Date(c.due_date) < now && !FINALIZADOS.has(st) && !ARQUIVADOS.has(st))
        row.overdue++;
      if (created && completed) {
        row._tempoTotal += (completed.getTime() - created.getTime()) / 3600000;
        row._tempoN++;
      }
      acc.set(mid, row);
    }

    // bottlenecks
    const buckets = new Map<string, { total: number; n: number }>();
    for (const c of cards) {
      const st = c.operational_status ?? "—";
      if (FINALIZADOS.has(st) || ARQUIVADOS.has(st)) continue;
      const t = c.operational_status_changed_at
        ? (now.getTime() - new Date(c.operational_status_changed_at).getTime()) / 3600000
        : 0;
      const b = buckets.get(st) ?? { total: 0, n: 0 };
      b.total += t;
      b.n += 1;
      buckets.set(st, b);
    }
    const bottlenecks = Array.from(buckets.entries())
      .map(([k, v]) => ({ status: k, avg_hours: v.n ? Math.round(v.total / v.n) : 0, count: v.n }))
      .sort((a, b) => b.avg_hours - a.avg_hours)
      .slice(0, 5);

    const members: MemberProductionRow[] = Array.from(acc.values()).map((r: any) => ({
      ...r,
      produtividade: r.total ? Math.round((r.finalizados / r.total) * 100) : 0,
      tempo_medio_horas: r._tempoN ? Math.round(r._tempoTotal / r._tempoN) : null,
    }));
    members.sort((a, b) => b.total - a.total);

    const exportRows: CardExportRow[] = cards.map((c: any) => ({
      id: c.id,
      data: c.created_at ? new Date(c.created_at).toLocaleDateString("pt-BR") : "",
      colaborador: memberMap.get(c.assignee_id ?? "")?.name ?? "—",
      cliente: c.client_name_snapshot ?? "",
      processo: c.process_number ?? "",
      area: c.practice_area ?? "",
      atividade: c.title ?? "",
      status: c.operational_status ?? "",
      fase_processual: c.legal_phase ?? "",
      prioridade: c.priority ?? "",
      prazo: c.due_date ? new Date(c.due_date).toLocaleDateString("pt-BR") : "",
      observacoes: c.observations ?? "",
    }));

    const cardsFull: OperationalCard[] = cards.map((c: any) => ({
      id: c.id,
      title: c.title,
      client_name: c.client_name_snapshot,
      process_number: c.process_number,
      practice_area: c.practice_area,
      operational_status: c.operational_status ?? "",
      legal_phase: c.legal_phase,
      priority: c.priority ?? "media",
      due_date: c.due_date,
      completed_at: c.completed_at,
      created_at: c.created_at,
      assignee_id: c.assignee_id,
      assignee_name: c.assignee_id ? (memberMap.get(c.assignee_id)?.name ?? null) : null,
      created_by: c.created_by,
      creator_name: c.created_by ? (memberMap.get(c.created_by)?.name ?? null) : null,
    }));

    return {
      totals: {
        total,
        em_andamento: totalAndamento,
        concluidos: totalConcluidos,
        atrasados: totalAtrasados,
        protocolados: totalProtocolados,
        arquivados: totalArquivados,
        em_revisao: totalRevisao,
      },
      members,
      by_status: Array.from(byStatus.entries()).map(([status, count]) => ({ status, count })),
      by_priority: Array.from(byPriority.entries()).map(([status, count]) => ({ status, count })),
      monthly: Array.from(monthly.values()),
      bottlenecks,
      cards: exportRows,
      cards_full: cardsFull,
    };
  });
