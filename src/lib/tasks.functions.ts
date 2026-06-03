import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const idInput = z.object({ id: z.string().uuid() });

export const deleteTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => idInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verifica que a tarefa pertence a uma empresa da qual o usuário é membro.
    const { data: task, error: fetchErr } = await supabase
      .from("tasks")
      .select("id, company_id")
      .eq("id", data.id)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!task) throw new Error("Tarefa não encontrada");

    const { data: membership } = await supabase
      .from("company_members")
      .select("user_id")
      .eq("company_id", task.company_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!membership) throw new Error("Sem permissão");

    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", data.id)
      .eq("company_id", task.company_id);
    if (error) {
      console.error("[deleteTask] failed", error);
      throw new Error(error.message);
    }
    return { ok: true };
  });
