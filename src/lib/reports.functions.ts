import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PeriodSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

async function getCompanyId(supabase: any, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("active_company_id")
    .eq("id", userId)
    .maybeSingle();
  if (!data?.active_company_id) throw new Error("Empresa ativa não encontrada");
  return data.active_company_id as string;
}

function defaultRange(input: { from?: string; to?: string }) {
  const to = input.to ?? new Date().toISOString();
  const from = input.from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  return { from, to };
}

function previousRange(from: string, to: string) {
  const fromMs = new Date(from).getTime();
  const toMs = new Date(to).getTime();
  const span = toMs - fromMs;
  return {
    from: new Date(fromMs - span).toISOString(),
    to: new Date(fromMs).toISOString(),
  };
}

function pct(current: number, previous: number): number {
  if (!previous) return current > 0 ? 100 : 0;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

function bucketByDay(items: { date: string }[], from: string, to: string) {
  const fromD = new Date(from);
  const toD = new Date(to);
  const days = Math.max(1, Math.ceil((toD.getTime() - fromD.getTime()) / 86400000));
  const buckets: Record<string, number> = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(fromD.getTime() + i * 86400000).toISOString().slice(0, 10);
    buckets[d] = 0;
  }
  for (const it of items) {
    const k = it.date.slice(0, 10);
    if (k in buckets) buckets[k]++;
  }
  return Object.entries(buckets).map(([date, value]) => ({ date, value }));
}

// ============ COMERCIAL ============
export const getCommercialReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => PeriodSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const companyId = await getCompanyId(supabase, userId);
    const { from, to } = defaultRange(data);
    const prev = previousRange(from, to);

    const [tCur, tPrev, cCur, cPrev, clCur, clPrev] = await Promise.all([
      supabase
        .from("triagens")
        .select("id, status, practice_area, created_at")
        .eq("company_id", companyId)
        .gte("created_at", from)
        .lte("created_at", to),
      supabase
        .from("triagens")
        .select("id, status, practice_area, created_at")
        .eq("company_id", companyId)
        .gte("created_at", prev.from)
        .lte("created_at", prev.to),
      supabase
        .from("contracts")
        .select("id, status, value, signed_at, created_at")
        .eq("company_id", companyId)
        .gte("created_at", from)
        .lte("created_at", to),
      supabase
        .from("contracts")
        .select("id, status, value, signed_at, created_at")
        .eq("company_id", companyId)
        .gte("created_at", prev.from)
        .lte("created_at", prev.to),
      supabase
        .from("clients")
        .select("id, created_at")
        .eq("company_id", companyId)
        .gte("created_at", from)
        .lte("created_at", to),
      supabase
        .from("clients")
        .select("id, created_at")
        .eq("company_id", companyId)
        .gte("created_at", prev.from)
        .lte("created_at", prev.to),
    ]);

    const triagens = tCur.data ?? [];
    const triagensPrev = tPrev.data ?? [];
    const contracts = cCur.data ?? [];
    const contractsPrev = cPrev.data ?? [];
    const clients = clCur.data ?? [];
    const clientsPrev = clPrev.data ?? [];

    const signed = contracts.filter((c) => c.status === "ativo" || c.signed_at);
    const signedPrev = contractsPrev.filter((c) => c.status === "ativo" || c.signed_at);
    const totalValue = signed.reduce((s, c) => s + Number(c.value || 0), 0);
    const totalValuePrev = signedPrev.reduce((s, c) => s + Number(c.value || 0), 0);
    const conversion = triagens.length > 0 ? (signed.length / triagens.length) * 100 : 0;
    const conversionPrev =
      triagensPrev.length > 0 ? (signedPrev.length / triagensPrev.length) * 100 : 0;
    const ticket = signed.length ? totalValue / signed.length : 0;
    const ticketPrev = signedPrev.length ? totalValuePrev / signedPrev.length : 0;

    const byArea: Record<string, number> = {};
    for (const t of triagens) {
      const k = t.practice_area || "Outros";
      byArea[k] = (byArea[k] || 0) + 1;
    }

    // Funil
    const funnel = [
      { etapa: "Triagens", valor: triagens.length },
      {
        etapa: "Em análise",
        valor: triagens.filter((t) => t.status === "analise" || t.status === "em_analise").length,
      },
      {
        etapa: "Aprovadas",
        valor: triagens.filter((t) => t.status === "aprovada" || t.status === "approved").length,
      },
      { etapa: "Contratos", valor: signed.length },
    ].filter((s) => s.valor > 0);

    // Series por dia para mini gráficos
    const triagensSeries = bucketByDay(
      triagens.map((t) => ({ date: t.created_at })),
      from,
      to,
    );
    const contratosSeries = bucketByDay(
      signed.map((c) => ({ date: c.signed_at || c.created_at })),
      from,
      to,
    );
    const clientesSeries = bucketByDay(
      clients.map((c) => ({ date: c.created_at })),
      from,
      to,
    );

    return {
      totals: {
        triagens: triagens.length,
        contratos_assinados: signed.length,
        novos_clientes: clients.length,
        faturamento_contratos: totalValue,
        taxa_conversao: Number(conversion.toFixed(1)),
        ticket_medio: ticket,
      },
      deltas: {
        triagens: pct(triagens.length, triagensPrev.length),
        contratos_assinados: pct(signed.length, signedPrev.length),
        novos_clientes: pct(clients.length, clientsPrev.length),
        faturamento_contratos: pct(totalValue, totalValuePrev),
        taxa_conversao: pct(conversion, conversionPrev),
        ticket_medio: pct(ticket, ticketPrev),
      },
      series: {
        triagens: triagensSeries,
        contratos: contratosSeries,
        clientes: clientesSeries,
      },
      por_area: Object.entries(byArea).map(([area, qty]) => ({ area, qty })),
      funnel,
    };
  });

// ============ JURÍDICO ============
export const getLegalReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => PeriodSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const companyId = await getCompanyId(supabase, userId);
    const { from, to } = defaultRange(data);
    const prev = previousRange(from, to);

    const [casesRes, casesPrev, deadlinesRes, deadlinesPrev, tasksRes, tasksPrev, movementsRes] =
      await Promise.all([
        supabase
          .from("cases")
          .select("id, status, practice_area, phase, lawyer_id, assigned_to, created_at")
          .eq("company_id", companyId)
          .gte("created_at", from)
          .lte("created_at", to),
        supabase
          .from("cases")
          .select("id, created_at")
          .eq("company_id", companyId)
          .gte("created_at", prev.from)
          .lte("created_at", prev.to),
        supabase
          .from("deadlines")
          .select("id, status, due_date, assigned_to")
          .eq("company_id", companyId)
          .gte("created_at", from)
          .lte("created_at", to),
        supabase
          .from("deadlines")
          .select("id")
          .eq("company_id", companyId)
          .gte("created_at", prev.from)
          .lte("created_at", prev.to),
        supabase
          .from("tasks")
          .select("id, status, assigned_to, completed_at, created_at")
          .eq("company_id", companyId)
          .gte("created_at", from)
          .lte("created_at", to),
        supabase
          .from("tasks")
          .select("id, status, completed_at")
          .eq("company_id", companyId)
          .gte("created_at", prev.from)
          .lte("created_at", prev.to),
        supabase
          .from("process_movements")
          .select("id, case_id, created_at")
          .eq("company_id", companyId)
          .gte("created_at", from)
          .lte("created_at", to),
      ]);

    const cases = casesRes.data ?? [];
    const deadlines = deadlinesRes.data ?? [];
    const tasks = tasksRes.data ?? [];

    const byArea: Record<string, number> = {};
    for (const c of cases) {
      const k = c.practice_area || "Outros";
      byArea[k] = (byArea[k] || 0) + 1;
    }
    const byPhase: Record<string, number> = {};
    for (const c of cases) {
      const k = c.phase || "Indefinido";
      byPhase[k] = (byPhase[k] || 0) + 1;
    }
    const byLawyer: Record<string, { tasks_done: number; cases: number }> = {};
    for (const c of cases) {
      const k = c.lawyer_id || c.assigned_to || "n/a";
      byLawyer[k] = byLawyer[k] || { tasks_done: 0, cases: 0 };
      byLawyer[k].cases++;
    }
    for (const t of tasks.filter((t) => t.status === "done")) {
      const k = t.assigned_to || "n/a";
      byLawyer[k] = byLawyer[k] || { tasks_done: 0, cases: 0 };
      byLawyer[k].tasks_done++;
    }
    const now = Date.now();
    const prazos_vencidos = deadlines.filter(
      (d) => d.status !== "completed" && new Date(d.due_date).getTime() < now,
    ).length;
    const tarefasDone = tasks.filter((t) => t.status === "done").length;
    const tarefasDonePrev = (tasksPrev.data ?? []).filter((t) => t.status === "done").length;

    return {
      totals: {
        processos: cases.length,
        prazos: deadlines.length,
        prazos_vencidos,
        movimentacoes: movementsRes.data?.length ?? 0,
        tarefas_concluidas: tarefasDone,
      },
      deltas: {
        processos: pct(cases.length, (casesPrev.data ?? []).length),
        prazos: pct(deadlines.length, (deadlinesPrev.data ?? []).length),
        prazos_vencidos: 0,
        movimentacoes: 0,
        tarefas_concluidas: pct(tarefasDone, tarefasDonePrev),
      },
      por_area: Object.entries(byArea).map(([area, qty]) => ({ area, qty })),
      por_fase: Object.entries(byPhase).map(([fase, qty]) => ({ fase, qty })),
      por_advogado: Object.entries(byLawyer).map(([lawyer_id, v]) => ({ lawyer_id, ...v })),
    };
  });

// ============ FINANCEIRO ============
export const getFinancialReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => PeriodSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const companyId = await getCompanyId(supabase, userId);
    const { from, to } = defaultRange(data);
    const prev = previousRange(from, to);

    const [curRes, prevRes] = await Promise.all([
      supabase
        .from("financial_entries")
        .select("id, entry_type, subtype, amount, status, due_date, paid_at, created_at")
        .eq("company_id", companyId)
        .gte("created_at", from)
        .lte("created_at", to),
      supabase
        .from("financial_entries")
        .select("id, entry_type, amount, status, due_date")
        .eq("company_id", companyId)
        .gte("created_at", prev.from)
        .lte("created_at", prev.to),
    ]);

    const list = curRes.data ?? [];
    const listPrev = prevRes.data ?? [];
    const today = new Date().toISOString().slice(0, 10);
    const sum = (arr: any[]) => arr.reduce((s, e) => s + Number(e.amount || 0), 0);

    const a_receber = list.filter((e) => e.entry_type !== "despesa" && e.status !== "pago");
    const a_pagar = list.filter((e) => e.entry_type === "despesa" && e.status !== "pago");
    const recebido = list.filter((e) => e.entry_type !== "despesa" && e.status === "pago");
    const pago = list.filter((e) => e.entry_type === "despesa" && e.status === "pago");
    const inadimplentes = list.filter(
      (e) => e.entry_type !== "despesa" && e.status !== "pago" && e.due_date && e.due_date < today,
    );

    const recebidoPrev = listPrev.filter((e) => e.entry_type !== "despesa" && e.status === "pago");
    const inadimplentesPrev = listPrev.filter(
      (e) => e.entry_type !== "despesa" && e.status !== "pago" && e.due_date && e.due_date < today,
    );

    const fluxo: Record<string, { entrada: number; saida: number }> = {};
    for (const e of list) {
      const key = (e.paid_at || e.due_date || e.created_at || "").slice(0, 7);
      if (!key) continue;
      fluxo[key] = fluxo[key] || { entrada: 0, saida: 0 };
      if (e.entry_type === "despesa") fluxo[key].saida += Number(e.amount || 0);
      else if (e.status === "pago") fluxo[key].entrada += Number(e.amount || 0);
    }

    const recebidoSum = sum(recebido);
    const inadimplenciaSum = sum(inadimplentes);

    return {
      totals: {
        a_receber: sum(a_receber),
        a_pagar: sum(a_pagar),
        recebido: recebidoSum,
        inadimplencia: inadimplenciaSum,
        saldo: recebidoSum - sum(pago),
      },
      deltas: {
        a_receber: 0,
        a_pagar: 0,
        recebido: pct(recebidoSum, sum(recebidoPrev)),
        inadimplencia: pct(inadimplenciaSum, sum(inadimplentesPrev)),
        saldo: 0,
      },
      fluxo: Object.entries(fluxo)
        .sort()
        .map(([mes, v]) => ({ mes, ...v })),
    };
  });

// ============ OPERACIONAL ============
export const getOperationalReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => PeriodSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const companyId = await getCompanyId(supabase, userId);
    const { from, to } = defaultRange(data);

    const [tasksRes, cardsRes] = await Promise.all([
      supabase
        .from("tasks")
        .select("id, status, assigned_to, created_at, completed_at, due_date")
        .eq("company_id", companyId)
        .gte("created_at", from)
        .lte("created_at", to),
      supabase
        .from("production_cards")
        .select(
          "id, legal_phase, operational_status, assignee_id, created_at, completed_at, due_date",
        )
        .eq("company_id", companyId)
        .gte("created_at", from)
        .lte("created_at", to),
    ]);

    const tasks = tasksRes.data ?? [];
    const cards = cardsRes.data ?? [];

    const concluidas = tasks.filter((t) => t.status === "done");
    const tempos = concluidas
      .filter((t) => t.completed_at && t.created_at)
      .map((t) => (new Date(t.completed_at!).getTime() - new Date(t.created_at).getTime()) / 36e5);
    const tempo_medio_horas = tempos.length ? tempos.reduce((a, b) => a + b, 0) / tempos.length : 0;

    const now = Date.now();
    const atrasadas = tasks.filter(
      (t) => t.status !== "done" && t.due_date && new Date(t.due_date).getTime() < now,
    ).length;

    const phaseAgg: Record<string, { count: number; totalAgeH: number }> = {};
    for (const c of cards.filter((c) => !c.completed_at)) {
      const k = c.operational_status || "indef";
      const ageH = (Date.now() - new Date(c.created_at).getTime()) / 36e5;
      phaseAgg[k] = phaseAgg[k] || { count: 0, totalAgeH: 0 };
      phaseAgg[k].count++;
      phaseAgg[k].totalAgeH += ageH;
    }
    const gargalos = Object.entries(phaseAgg)
      .map(([fase, v]) => ({
        fase,
        count: v.count,
        tempo_medio_h: Math.round(v.totalAgeH / v.count),
      }))
      .sort((a, b) => b.tempo_medio_h - a.tempo_medio_h)
      .slice(0, 5);

    // Cards concluídos por colaborador
    const cardsByMember: Record<string, number> = {};
    for (const c of cards.filter((c) => c.completed_at)) {
      const k = c.assignee_id || "n/a";
      cardsByMember[k] = (cardsByMember[k] || 0) + 1;
    }

    return {
      totals: {
        tarefas_concluidas: concluidas.length,
        tarefas_atrasadas: atrasadas,
        cards_ativos: cards.filter((c) => !c.completed_at).length,
        tempo_medio_horas: Number(tempo_medio_horas.toFixed(1)),
      },
      deltas: {
        tarefas_concluidas: 0,
        tarefas_atrasadas: 0,
        cards_ativos: 0,
        tempo_medio_horas: 0,
      },
      gargalos,
      cards_por_colaborador: Object.entries(cardsByMember).map(([assignee_id, qty]) => ({
        assignee_id,
        qty,
      })),
    };
  });

// ============ EQUIPE — Performance ============
export const getTeamPerformance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => PeriodSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const companyId = await getCompanyId(supabase, userId);
    const { from, to } = defaultRange(data);

    const [membersRes, tasksRes, cardsRes, movsRes, contractsRes] = await Promise.all([
      supabase.from("company_members").select("user_id").eq("company_id", companyId),
      supabase
        .from("tasks")
        .select("id, status, assigned_to, completed_at, created_at")
        .eq("company_id", companyId)
        .gte("created_at", from)
        .lte("created_at", to),
      supabase
        .from("production_cards")
        .select("id, assignee_id, completed_at, created_at")
        .eq("company_id", companyId)
        .gte("created_at", from)
        .lte("created_at", to),
      supabase
        .from("process_movements")
        .select("id, created_by, created_at")
        .eq("company_id", companyId)
        .gte("created_at", from)
        .lte("created_at", to),
      supabase
        .from("contracts")
        .select("id, created_by, signed_at, status, created_at")
        .eq("company_id", companyId)
        .gte("created_at", from)
        .lte("created_at", to),
    ]);

    const memberIds = (membersRes.data ?? []).map((m: any) => m.user_id);
    const profilesRes = memberIds.length
      ? await supabase.from("profiles").select("id, full_name, avatar_url").in("id", memberIds)
      : { data: [] as any[] };
    const profiles: Record<string, { full_name: string | null; avatar_url: string | null }> = {};
    for (const p of profilesRes.data ?? []) profiles[p.id] = p;

    const tasks = tasksRes.data ?? [];
    const cards = cardsRes.data ?? [];
    const movs = movsRes.data ?? [];
    const contracts = contractsRes.data ?? [];

    const result = memberIds
      .map((uid: string) => {
        const myCards = cards.filter((c) => c.assignee_id === uid).length;
        const cardsDone = cards.filter((c) => c.assignee_id === uid && c.completed_at).length;
        const tasksDone = tasks.filter((t) => t.assigned_to === uid && t.status === "done").length;
        const myMovs = movs.filter((m) => m.created_by === uid).length;
        const myContracts = contracts.filter(
          (c) => c.created_by === uid && (c.status === "ativo" || c.signed_at),
        ).length;
        const score = cardsDone * 2 + tasksDone + myMovs + myContracts * 3;
        return {
          user_id: uid,
          full_name: profiles[uid]?.full_name ?? "Sem nome",
          avatar_url: profiles[uid]?.avatar_url ?? null,
          cards: myCards,
          cards_done: cardsDone,
          tasks_done: tasksDone,
          movimentacoes: myMovs,
          contratos: myContracts,
          score,
        };
      })
      .sort((a, b) => b.score - a.score);

    const max = Math.max(1, ...result.map((r) => r.score));
    return result.map((r) => ({ ...r, performance: Math.round((r.score / max) * 100) }));
  });

// ============ ATIVIDADES RECENTES ============
export const getRecentActivities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((_i: unknown) => ({}))
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const companyId = await getCompanyId(supabase, userId);

    const { data } = await supabase
      .from("activity_logs")
      .select("id, action, entity_type, entity_label, user_id, created_at, metadata")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(25);

    const ids = Array.from(new Set((data ?? []).map((a: any) => a.user_id)));
    const profilesRes = ids.length
      ? await supabase.from("profiles").select("id, full_name, avatar_url").in("id", ids)
      : { data: [] as any[] };
    const profiles: Record<string, any> = {};
    for (const p of profilesRes.data ?? []) profiles[p.id] = p;

    return (data ?? []).map((a: any) => ({
      id: a.id,
      action: a.action,
      entity_type: a.entity_type,
      entity_label: a.entity_label,
      created_at: a.created_at,
      user_name: profiles[a.user_id]?.full_name ?? "Usuário",
      avatar_url: profiles[a.user_id]?.avatar_url ?? null,
    }));
  });

// ============ ALERTAS ============
export const getSmartAlerts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((_i: unknown) => ({}))
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const companyId = await getCompanyId(supabase, userId);

    const now = new Date();
    const in7 = new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10);
    const today = now.toISOString().slice(0, 10);
    const today10Ago = new Date(now.getTime() - 10 * 86400000).toISOString();

    const [deadlinesRes, contractsRes, tasksRes] = await Promise.all([
      supabase
        .from("deadlines")
        .select("id, title, due_date, status")
        .eq("company_id", companyId)
        .neq("status", "completed")
        .lte("due_date", in7)
        .order("due_date", { ascending: true })
        .limit(20),
      supabase
        .from("contracts")
        .select("id, title, status, created_at")
        .eq("company_id", companyId)
        .eq("status", "rascunho")
        .lte("created_at", today10Ago)
        .limit(20),
      supabase
        .from("tasks")
        .select("id, title, due_date, status")
        .eq("company_id", companyId)
        .neq("status", "done")
        .lt("due_date", today)
        .limit(20),
    ]);

    return {
      prazos_vencendo: deadlinesRes.data ?? [],
      contratos_pendentes: contractsRes.data ?? [],
      tarefas_atrasadas: tasksRes.data ?? [],
    };
  });

// ============ KPI DRILLDOWN ============
const DrillSchema = z.object({
  kind: z.enum([
    "triagens",
    "contratos",
    "novos_clientes",
    "faturamento",
    "conversao",
    "ticket_medio",
    "processos",
    "prazos",
    "prazos_vencidos",
    "movimentacoes",
    "tarefas_concluidas",
    "a_receber",
    "a_pagar",
    "recebido",
    "inadimplencia",
    "tarefas_atrasadas",
    "cards_ativos",
  ]),
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(50),
});

export const getKpiDrilldown = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => DrillSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const companyId = await getCompanyId(supabase, userId);
    const { from, to } = defaultRange(data);
    const todayStr = new Date().toISOString().slice(0, 10);
    const limit = data.limit;

    type Row = {
      id: string;
      title: string;
      subtitle?: string;
      date?: string | null;
      value?: number;
      status?: string;
    };
    const map = <T>(arr: T[] | null | undefined, fn: (r: T) => Row): Row[] => (arr ?? []).map(fn);

    switch (data.kind) {
      case "triagens": {
        const r = await supabase
          .from("triagens")
          .select("id, nome, status, practice_area, created_at")
          .eq("company_id", companyId)
          .gte("created_at", from)
          .lte("created_at", to)
          .order("created_at", { ascending: false })
          .limit(limit);
        return map(r.data as any[], (t: any) => ({
          id: t.id,
          title: t.nome || "Triagem",
          subtitle: t.practice_area || undefined,
          status: t.status,
          date: t.created_at,
        }));
      }
      case "contratos": {
        const r = await supabase
          .from("contracts")
          .select("id, title, status, value, signed_at, created_at")
          .eq("company_id", companyId)
          .gte("created_at", from)
          .lte("created_at", to)
          .order("created_at", { ascending: false })
          .limit(limit);
        return map(r.data as any[], (c: any) => ({
          id: c.id,
          title: c.title,
          status: c.status,
          value: Number(c.value || 0),
          date: c.signed_at || c.created_at,
        }));
      }
      case "novos_clientes": {
        const r = await supabase
          .from("clients")
          .select("id, name, email, created_at")
          .eq("company_id", companyId)
          .gte("created_at", from)
          .lte("created_at", to)
          .order("created_at", { ascending: false })
          .limit(limit);
        return map(r.data as any[], (c: any) => ({
          id: c.id,
          title: c.name,
          subtitle: c.email || undefined,
          date: c.created_at,
        }));
      }
      case "faturamento":
      case "recebido":
      case "ticket_medio":
      case "conversao": {
        const r = await supabase
          .from("contracts")
          .select("id, title, value, signed_at, status, created_at")
          .eq("company_id", companyId)
          .gte("created_at", from)
          .lte("created_at", to)
          .order("created_at", { ascending: false })
          .limit(limit);
        const rows =
          data.kind === "faturamento" || data.kind === "recebido"
            ? (r.data ?? []).filter((c: any) => c.status === "ativo" || c.signed_at)
            : (r.data ?? []);
        return map(rows as any[], (c: any) => ({
          id: c.id,
          title: c.title,
          value: Number(c.value || 0),
          date: c.signed_at || c.created_at,
          status: c.status,
        }));
      }
      case "processos": {
        const r = await supabase
          .from("cases")
          .select("id, title, phase, status, practice_area, created_at")
          .eq("company_id", companyId)
          .gte("created_at", from)
          .lte("created_at", to)
          .order("created_at", { ascending: false })
          .limit(limit);
        return map(r.data as any[], (c: any) => ({
          id: c.id,
          title: c.title,
          subtitle: [c.practice_area, c.phase].filter(Boolean).join(" • ") || undefined,
          status: c.status,
          date: c.created_at,
        }));
      }
      case "prazos": {
        const r = await supabase
          .from("deadlines")
          .select("id, title, due_date, status, created_at")
          .eq("company_id", companyId)
          .gte("created_at", from)
          .lte("created_at", to)
          .order("due_date", { ascending: true })
          .limit(limit);
        return map(r.data as any[], (d: any) => ({
          id: d.id,
          title: d.title,
          status: d.status,
          date: d.due_date,
        }));
      }
      case "prazos_vencidos": {
        const r = await supabase
          .from("deadlines")
          .select("id, title, due_date, status")
          .eq("company_id", companyId)
          .neq("status", "completed")
          .lt("due_date", todayStr)
          .order("due_date", { ascending: true })
          .limit(limit);
        return map(r.data as any[], (d: any) => ({
          id: d.id,
          title: d.title,
          status: d.status,
          date: d.due_date,
        }));
      }
      case "movimentacoes": {
        const r = await supabase
          .from("process_movements")
          .select("id, title, movement_type, movement_date, case_id, created_at")
          .eq("company_id", companyId)
          .gte("created_at", from)
          .lte("created_at", to)
          .order("created_at", { ascending: false })
          .limit(limit);
        return map(r.data as any[], (m: any) => ({
          id: m.id,
          title: m.title,
          subtitle: m.movement_type || undefined,
          date: m.movement_date || m.created_at,
        }));
      }
      case "tarefas_concluidas": {
        const r = await supabase
          .from("tasks")
          .select("id, title, status, completed_at, due_date, priority")
          .eq("company_id", companyId)
          .eq("status", "done")
          .gte("created_at", from)
          .lte("created_at", to)
          .order("completed_at", { ascending: false })
          .limit(limit);
        return map(r.data as any[], (t: any) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          subtitle: t.priority || undefined,
          date: t.completed_at || t.due_date,
        }));
      }
      case "tarefas_atrasadas": {
        const r = await supabase
          .from("tasks")
          .select("id, title, status, due_date, priority")
          .eq("company_id", companyId)
          .neq("status", "done")
          .lt("due_date", todayStr)
          .order("due_date", { ascending: true })
          .limit(limit);
        return map(r.data as any[], (t: any) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          subtitle: t.priority || undefined,
          date: t.due_date,
        }));
      }
      case "cards_ativos": {
        const r = await supabase
          .from("production_cards")
          .select("id, title, operational_status, legal_phase, due_date, created_at")
          .eq("company_id", companyId)
          .is("completed_at", null)
          .order("created_at", { ascending: false })
          .limit(limit);
        return map(r.data as any[], (c: any) => ({
          id: c.id,
          title: c.title,
          subtitle: [c.legal_phase, c.operational_status].filter(Boolean).join(" • ") || undefined,
          date: c.due_date || c.created_at,
        }));
      }
      case "a_receber":
      case "a_pagar":
      case "inadimplencia": {
        let q = supabase
          .from("financial_entries")
          .select("id, description, amount, status, due_date, entry_type, category")
          .eq("company_id", companyId);
        if (data.kind === "a_pagar") {
          q = q.eq("entry_type", "despesa").neq("status", "pago");
        } else if (data.kind === "a_receber") {
          q = q.neq("entry_type", "despesa").neq("status", "pago");
        } else {
          q = q.neq("entry_type", "despesa").neq("status", "pago").lt("due_date", todayStr);
        }
        const r = await q.order("due_date", { ascending: true }).limit(limit);
        return map(r.data as any[], (e: any) => ({
          id: e.id,
          title: e.description,
          subtitle: e.category || undefined,
          value: Number(e.amount || 0),
          date: e.due_date,
          status: e.status,
        }));
      }
    }
    return [];
  });
