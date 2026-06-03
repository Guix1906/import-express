import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const FilterSchema = z
  .object({
    track: z.enum(["legal", "operational"]),
    assignee_id: z.string().uuid().optional().nullable(),
    practice_area: z.string().optional().nullable(),
    priority: z.string().optional().nullable(),
    client_id: z.string().uuid().optional().nullable(),
    from: z.string().optional().nullable(),
    to: z.string().optional().nullable(),
    search: z.string().optional().nullable(),
  })
  .strict();

export const listKanbanCards = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => FilterSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("active_company_id")
      .eq("id", userId)
      .maybeSingle();
    const companyId = profile?.active_company_id;
    if (!companyId) return { cards: [], members: [] };

    let q = supabase
      .from("production_cards")
      .select(
        "id, title, description, priority, assignee_id, client_id, client_name_snapshot, practice_area, demand_type, due_date, sla_hours, created_at, legal_phase, operational_status, legal_phase_changed_at, operational_status_changed_at",
      )
      .eq("company_id", companyId)
      .order("updated_at", { ascending: false })
      .limit(500);

    if (data.assignee_id) q = q.eq("assignee_id", data.assignee_id);
    if (data.practice_area) q = q.eq("practice_area", data.practice_area);
    if (data.priority) q = q.eq("priority", data.priority);
    if (data.client_id) q = q.eq("client_id", data.client_id);
    if (data.from) q = q.gte("created_at", data.from);
    if (data.to) q = q.lte("created_at", data.to);
    if (data.search) q = q.ilike("title", `%${data.search}%`);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const { data: members } = await supabase
      .from("company_members")
      .select("user_id, profiles:profiles!inner(id, full_name, avatar_url)")
      .eq("company_id", companyId);

    return {
      cards: rows ?? [],
      members:
        (members ?? []).map((m: any) => ({
          id: m.profiles?.id ?? m.user_id,
          name: m.profiles?.full_name ?? "—",
          avatar: m.profiles?.avatar_url ?? null,
        })) ?? [],
    };
  });

const MoveSchema = z.object({
  cardId: z.string().uuid(),
  track: z.enum(["legal", "operational"]),
  toValue: z.string().min(1).max(60),
});

export const moveCardOnTrack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => MoveSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("active_company_id")
      .eq("id", userId)
      .maybeSingle();
    const companyId = profile?.active_company_id;
    if (!companyId) throw new Error("Empresa não encontrada");

    const { data: card, error: cErr } = await supabase
      .from("production_cards")
      .select("id, title, assignee_id, legal_phase, operational_status")
      .eq("id", data.cardId)
      .eq("company_id", companyId)
      .single();
    if (cErr || !card) throw new Error("Card não encontrado");

    const isLegal = data.track === "legal";
    const fromValue = isLegal ? card.legal_phase : card.operational_status;
    if (fromValue === data.toValue) return { ok: true };

    const patch: Record<string, unknown> = isLegal
      ? { legal_phase: data.toValue, legal_phase_changed_at: new Date().toISOString() }
      : {
          operational_status: data.toValue,
          operational_status_changed_at: new Date().toISOString(),
        };

    const { error: uErr } = await supabase
      .from("production_cards")
      .update(patch as never)
      .eq("id", card.id);
    if (uErr) throw new Error(uErr.message);

    await supabase.from("card_phase_history").insert({
      company_id: companyId,
      card_id: card.id,
      actor_id: userId,
      track: data.track,
      from_value: fromValue,
      to_value: data.toValue,
    } as never);

    await supabase.from("activity_logs").insert({
      company_id: companyId,
      user_id: userId,
      action: "update",
      entity_type: isLegal ? "kanban_processual" : "kanban_operacional",
      entity_id: card.id,
      entity_label: card.title,
      metadata: { from: fromValue, to: data.toValue },
    } as never);

    if (card.assignee_id && card.assignee_id !== userId) {
      await supabase.from("notifications").insert({
        company_id: companyId,
        user_id: card.assignee_id,
        type: isLegal ? "kanban_processual_move" : "kanban_operacional_move",
        title: isLegal ? "Fase processual atualizada" : "Status operacional atualizado",
        body: `${card.title}: ${fromValue ?? "—"} → ${data.toValue}`,
        link: "/app/processos",
        payload: { card_id: card.id, track: data.track, to: data.toValue } as never,
      } as never);
    }

    return { ok: true };
  });

export const getKanbanMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("active_company_id")
      .eq("id", userId)
      .maybeSingle();
    const companyId = profile?.active_company_id;
    if (!companyId) return null;

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

    const [
      { count: overdue },
      { count: active },
      { count: contractsMonth },
      { data: moves },
      { data: opCards },
    ] = await Promise.all([
      supabase
        .from("production_cards")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .lt("due_date", now.toISOString())
        .neq("operational_status", "finalizado"),
      supabase
        .from("production_cards")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .neq("legal_phase", "arquivado"),
      supabase
        .from("contracts")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .gte("signed_at", startMonth),
      supabase
        .from("card_phase_history")
        .select("id, created_at")
        .eq("company_id", companyId)
        .gte("created_at", sevenDaysAgo),
      supabase
        .from("production_cards")
        .select("operational_status, operational_status_changed_at")
        .eq("company_id", companyId),
    ]);

    // Gargalos: status com maior tempo médio parado (em horas)
    const buckets = new Map<string, { total: number; n: number }>();
    (opCards ?? []).forEach((c: any) => {
      const t = c.operational_status_changed_at
        ? (now.getTime() - new Date(c.operational_status_changed_at).getTime()) / 3600000
        : 0;
      const b = buckets.get(c.operational_status) ?? { total: 0, n: 0 };
      b.total += t;
      b.n += 1;
      buckets.set(c.operational_status, b);
    });
    const bottlenecks = Array.from(buckets.entries())
      .map(([k, v]) => ({ status: k, avg_hours: v.n ? Math.round(v.total / v.n) : 0, count: v.n }))
      .sort((a, b) => b.avg_hours - a.avg_hours)
      .slice(0, 3);

    return {
      overdue: overdue ?? 0,
      active: active ?? 0,
      contracts_month: contractsMonth ?? 0,
      productivity_7d: moves?.length ?? 0,
      bottlenecks,
    };
  });
