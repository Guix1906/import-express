import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const RespondSchema = z.object({
  ticketId: z.string().uuid(),
  newStatus: z.enum(["open", "in_progress", "resolved", "closed"]),
  response: z.string().trim().max(5000).optional().nullable(),
});

export const respondSupportTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RespondSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Fetch ticket to learn company_id
    const { data: ticket, error: tErr } = await supabase
      .from("support_tickets")
      .select("id, company_id")
      .eq("id", data.ticketId)
      .maybeSingle();
    if (tErr) throw new Error(tErr.message);
    if (!ticket) throw new Error("Ticket não encontrado.");

    // Server-side authorization: caller must be owner/admin of the company
    const { data: roles, error: rErr } = await supabase
      .from("user_roles")
      .select("role")
      .eq("company_id", ticket.company_id)
      .eq("user_id", userId);
    if (rErr) throw new Error(rErr.message);
    const isAdmin = (roles ?? []).some((r) => r.role === "owner" || r.role === "admin");
    if (!isAdmin) throw new Error("Sem permissão para responder este ticket.");

    const patch: Record<string, unknown> = { status: data.newStatus };
    if (data.response !== undefined && data.response !== null) {
      const trimmed = data.response.trim();
      if (!trimmed) throw new Error("Escreva a resposta.");
      patch.response = trimmed;
      patch.responded_at = new Date().toISOString();
      patch.responded_by = userId;
    }
    if (data.newStatus === "closed") {
      patch.closed_at = new Date().toISOString();
    }

    const { error: uErr } = await supabaseAdmin
      .from("support_tickets")
      .update(patch as never)
      .eq("id", data.ticketId);
    if (uErr) throw new Error(uErr.message);

    return { ok: true };
  });
