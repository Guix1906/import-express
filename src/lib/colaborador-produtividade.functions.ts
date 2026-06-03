import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CollaboratorCardRow = {
  id: string;
  title: string;
  client_name: string | null;
  process_number: string | null;
  practice_area: string | null;
  operational_status: string;
  priority: string;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  is_creator: boolean;
  is_assignee: boolean;
};

export type CollaboratorEventRow = {
  id: string;
  card_id: string;
  card_title: string | null;
  event_type: string;
  created_at: string;
};

export type CollaboratorMonthlyPoint = {
  month: string;
  criados: number;
  finalizados: number;
  movimentacoes: number;
};

export type CollaboratorProductivity = {
  member: {
    user_id: string;
    full_name: string | null;
    avatar_url: string | null;
    role: string | null;
  } | null;
  kpis: {
    criados_por_ele: number;
    atribuidos: number;
    em_producao: number;
    em_revisao: number;
    protocolados: number;
    concluidos: number;
    arquivados: number;
    atrasados: number;
    documentos: number;
    comentarios: number;
    movimentacoes: number;
    produtividade: number; // %
  };
  cards: CollaboratorCardRow[];
  events: CollaboratorEventRow[];
  monthly: CollaboratorMonthlyPoint[];
};

const FINALIZADOS = new Set(["finalizado"]);
const ARQUIVADOS = new Set(["arquivado"]);
const PROTOCOLADOS = new Set(["protocolado"]);
const EM_PRODUCAO = new Set([
  "em_producao",
  "aguardando_documentos",
  "em_analise",
  "acompanhamento",
  "pendencias",
]);

export const getCollaboratorProductivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ user_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<CollaboratorProductivity> => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("active_company_id")
      .eq("id", userId)
      .maybeSingle();
    const companyId = profile?.active_company_id;

    const empty: CollaboratorProductivity = {
      member: null,
      kpis: {
        criados_por_ele: 0,
        atribuidos: 0,
        em_producao: 0,
        em_revisao: 0,
        protocolados: 0,
        concluidos: 0,
        arquivados: 0,
        atrasados: 0,
        documentos: 0,
        comentarios: 0,
        movimentacoes: 0,
        produtividade: 0,
      },
      cards: [],
      events: [],
      monthly: [],
    };
    if (!companyId) return empty;

    const target = data.user_id;

    const [profRes, roleRes, cardsRes, docsCountRes, commentsCountRes, eventsRes] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .eq("id", target)
          .maybeSingle(),
        supabase
          .from("user_roles")
          .select("role")
          .eq("company_id", companyId)
          .eq("user_id", target),
        supabase
          .from("production_cards")
          .select(
            "id, title, client_name_snapshot, process_number, practice_area, operational_status, priority, due_date, completed_at, created_at, created_by, assignee_id",
          )
          .eq("company_id", companyId)
          .or(`created_by.eq.${target},assignee_id.eq.${target}`)
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("documents")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
          .eq("uploaded_by", target),
        supabase
          .from("production_card_comments")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
          .eq("author_id", target),
        supabase
          .from("production_card_events")
          .select("id, card_id, event_type, created_at")
          .eq("company_id", companyId)
          .eq("actor_id", target)
          .order("created_at", { ascending: false })
          .limit(100),
      ]);

    const roleRank: Record<string, number> = { owner: 3, admin: 2, lawyer: 1, member: 0 };
    let role: string | null = null;
    (roleRes.data ?? []).forEach((r: { role: string }) => {
      if (!role || (roleRank[r.role] ?? -1) > (roleRank[role] ?? -1)) role = r.role;
    });

    const cards = cardsRes.data ?? [];
    const now = new Date();
    let criados = 0,
      atribuidos = 0,
      em_producao = 0,
      em_revisao = 0,
      protocolados = 0,
      concluidos = 0,
      arquivados = 0,
      atrasados = 0;

    const monthly = new Map<string, CollaboratorMonthlyPoint>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthly.set(key, { month: key, criados: 0, finalizados: 0, movimentacoes: 0 });
    }

    const cardRows: CollaboratorCardRow[] = cards.map((c: any) => {
      const isCreator = c.created_by === target;
      const isAssignee = c.assignee_id === target;
      if (isCreator) criados++;
      if (isAssignee) atribuidos++;
      const st = c.operational_status ?? "";
      if (isAssignee) {
        if (FINALIZADOS.has(st)) concluidos++;
        else if (ARQUIVADOS.has(st)) arquivados++;
        else if (PROTOCOLADOS.has(st)) protocolados++;
        if (st === "em_revisao") em_revisao++;
        if (EM_PRODUCAO.has(st)) em_producao++;
        if (c.due_date && new Date(c.due_date) < now && !FINALIZADOS.has(st) && !ARQUIVADOS.has(st))
          atrasados++;
      }
      if (isCreator && c.created_at) {
        const d = new Date(c.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const m = monthly.get(key);
        if (m) m.criados++;
      }
      if (isAssignee && c.completed_at) {
        const d = new Date(c.completed_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const m = monthly.get(key);
        if (m) m.finalizados++;
      }
      return {
        id: c.id,
        title: c.title,
        client_name: c.client_name_snapshot,
        process_number: c.process_number,
        practice_area: c.practice_area,
        operational_status: st,
        priority: c.priority,
        due_date: c.due_date,
        completed_at: c.completed_at,
        created_at: c.created_at,
        is_creator: isCreator,
        is_assignee: isAssignee,
      };
    });

    const eventsRaw = eventsRes.data ?? [];
    const cardTitleById = new Map(cards.map((c: any) => [c.id, c.title as string]));
    const events: CollaboratorEventRow[] = eventsRaw.map((e: any) => ({
      id: e.id,
      card_id: e.card_id,
      card_title: cardTitleById.get(e.card_id) ?? null,
      event_type: e.event_type,
      created_at: e.created_at,
    }));
    eventsRaw.forEach((e: any) => {
      if (!e.created_at) return;
      const d = new Date(e.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const m = monthly.get(key);
      if (m) m.movimentacoes++;
    });

    const produtividade = atribuidos ? Math.round((concluidos / atribuidos) * 100) : 0;

    return {
      member: profRes.data
        ? {
            user_id: profRes.data.id,
            full_name: profRes.data.full_name,
            avatar_url: profRes.data.avatar_url,
            role,
          }
        : { user_id: target, full_name: null, avatar_url: null, role },
      kpis: {
        criados_por_ele: criados,
        atribuidos,
        em_producao,
        em_revisao,
        protocolados,
        concluidos,
        arquivados,
        atrasados,
        documentos: docsCountRes.count ?? 0,
        comentarios: commentsCountRes.count ?? 0,
        movimentacoes: eventsRaw.length,
        produtividade,
      },
      cards: cardRows,
      events,
      monthly: Array.from(monthly.values()),
    };
  });
