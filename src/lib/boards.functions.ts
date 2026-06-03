import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const CreateBoardSchema = z.object({
  companyId: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).optional().nullable(),
  boardType: z.string().trim().min(1).max(60).default("advogado"),
  color: z.string().trim().min(1).max(40).default("blue"),
  gradient: z.string().trim().max(160).optional().nullable(),
  icon: z.string().trim().max(20).optional().nullable(),
  ownerId: z.string().uuid().optional().nullable(),
  roleLabel: z.string().trim().max(60).optional().nullable(),
});

const DEFAULT_COLUMNS = [
  { key: "para_producao", title: "Para Producao" },
  { key: "para_protocolo", title: "Para Protocolo" },
  { key: "em_revisao", title: "Em Revisao" },
  { key: "finalizados", title: "Finalizados" },
];

export const createBoardWithDefaults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CreateBoardSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const [{ data: membership, error: membershipError }, { data: role, error: roleError }] =
      await Promise.all([
        supabaseAdmin
          .from("company_members")
          .select("user_id")
          .eq("company_id", data.companyId)
          .eq("user_id", userId)
          .maybeSingle(),
        supabaseAdmin
          .from("user_roles")
          .select("user_id, role")
          .eq("company_id", data.companyId)
          .eq("user_id", userId)
          .limit(1)
          .maybeSingle(),
      ]);

    if (membershipError) throw new Error(membershipError.message);
    if (roleError) throw new Error(roleError.message);
    if (!membership && !role) {
      throw new Error("Sem permissao para criar quadro neste escritorio.");
    }

    if (!membership && role) {
      const { error: repairError } = await supabaseAdmin.from("company_members").insert({
        company_id: data.companyId,
        user_id: userId,
      });
      if (repairError && repairError.code !== "23505") throw new Error(repairError.message);
    }

    const ownerId = data.ownerId || userId;
    const { data: board, error: boardError } = await supabaseAdmin
      .from("boards")
      .insert({
        company_id: data.companyId,
        name: data.name,
        description: data.description || null,
        board_type: data.boardType,
        color: data.color,
        gradient: data.gradient || null,
        icon: data.icon || null,
        owner_id: ownerId,
        role_label: data.roleLabel || null,
        created_by: userId,
      })
      .select()
      .single();

    if (boardError) throw new Error(boardError.message);

    const { error: columnsError } = await supabaseAdmin.from("board_columns").insert(
      DEFAULT_COLUMNS.map((column, position) => ({
        company_id: data.companyId,
        board_id: board.id,
        key: column.key,
        title: column.title,
        position,
      })),
    );
    if (columnsError) throw new Error(columnsError.message);

    const { error: memberError } = await supabaseAdmin.from("board_members").insert({
      company_id: data.companyId,
      board_id: board.id,
      user_id: ownerId,
    });
    if (memberError && memberError.code !== "23505") throw new Error(memberError.message);

    return board;
  });
