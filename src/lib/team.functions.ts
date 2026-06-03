import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type AppRole = "owner" | "admin" | "lawyer" | "assistant" | "viewer";

const InviteSchema = z.object({
  companyId: z.string().uuid(),
  email: z.string().email().max(255),
  role: z.enum(["owner", "admin", "lawyer", "assistant", "viewer"]),
  fullName: z.string().trim().min(1).max(255).optional().nullable(),
});

const CompanySchema = z.object({
  companyId: z.string().uuid(),
});

export const listCompanyTeamMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CompanySchema.parse(input))
  .handler(async ({ data }) => {
    const { data: members, error: membersErr } = await supabaseAdmin
      .from("company_members")
      .select("user_id")
      .eq("company_id", data.companyId);
    if (membersErr) throw new Error(membersErr.message);

    const ids = Array.from(new Set((members ?? []).map((member) => member.user_id)));
    if (ids.length === 0) return [];

    const [{ data: profiles, error: profilesErr }, { data: roles, error: rolesErr }] =
      await Promise.all([
        supabaseAdmin.from("profiles").select("id, full_name").in("id", ids),
        supabaseAdmin
          .from("user_roles")
          .select("user_id, role")
          .eq("company_id", data.companyId)
          .in("user_id", ids),
      ]);
    if (profilesErr) throw new Error(profilesErr.message);
    if (rolesErr) throw new Error(rolesErr.message);

    const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name]));
    const rolesByUser = new Map<string, AppRole[]>();

    for (const role of roles ?? []) {
      const userRoles = rolesByUser.get(role.user_id) ?? [];
      userRoles.push(role.role as AppRole);
      rolesByUser.set(role.user_id, userRoles);
    }

    return ids.map((id) => ({
      user_id: id,
      full_name: profileById.get(id) ?? null,
      roles: rolesByUser.get(id) ?? [],
    }));
  });

export const inviteMemberByEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InviteSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const email = data.email.trim().toLowerCase();

    let foundUserId: string | null = null;
    for (let page = 1; page <= 20 && !foundUserId; page++) {
      const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: 200,
      });
      if (error) throw new Error(error.message);
      const match = list.users.find((user) => (user.email ?? "").toLowerCase() === email);
      if (match) foundUserId = match.id;
      if (list.users.length < 200) break;
    }

    if (foundUserId && foundUserId === userId) {
      const { data: me } = await supabaseAdmin.auth.admin.getUserById(userId);
      const myEmail = (me?.user?.email ?? "").toLowerCase();
      if (myEmail !== email) foundUserId = null;
    }

    let createdNew = false;
    let inviteAction: "added" | "invited" = "added";

    if (!foundUserId) {
      const { data: invited, error: invErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        email,
        {
          data: { full_name: data.fullName ?? undefined },
        },
      );

      if (invErr || !invited?.user?.id) {
        const tempPassword = `${crypto.randomUUID()}Aa1!`;
        const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: tempPassword,
          email_confirm: false,
          user_metadata: { full_name: data.fullName ?? undefined },
        });
        if (cErr || !created?.user?.id) {
          throw new Error(invErr?.message || cErr?.message || "Falha ao criar usuário convidado.");
        }
        foundUserId = created.user.id;
        createdNew = true;
        inviteAction = "added";
      } else {
        foundUserId = invited.user.id;
        createdNew = true;
        inviteAction = "invited";
      }
    }

    if (!foundUserId) throw new Error("Não foi possível identificar o usuário convidado.");

    if (createdNew && data.fullName) {
      await supabaseAdmin
        .from("profiles")
        .upsert({ id: foundUserId, full_name: data.fullName }, { onConflict: "id" });
    }

    const { error: memberErr } = await supabaseAdmin
      .from("company_members")
      .upsert(
        { company_id: data.companyId, user_id: foundUserId },
        { onConflict: "company_id,user_id" },
      );
    if (memberErr) throw new Error(memberErr.message);

    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .upsert(
        { user_id: foundUserId, company_id: data.companyId, role: data.role },
        { onConflict: "user_id,company_id,role" },
      );
    if (roleErr) throw new Error(roleErr.message);

    return {
      userId: foundUserId,
      email,
      action: inviteAction,
      createdNew,
    };
  });

const RoleMutationSchema = z.object({
  companyId: z.string().uuid(),
  targetUserId: z.string().uuid(),
  role: z.enum(["owner", "admin", "lawyer", "assistant", "viewer"]),
});

const MemberMutationSchema = z.object({
  companyId: z.string().uuid(),
  targetUserId: z.string().uuid(),
});

export const addCompanyRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RoleMutationSchema.parse(input))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("user_roles")
      .upsert(
        { user_id: data.targetUserId, company_id: data.companyId, role: data.role },
        { onConflict: "user_id,company_id,role" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeCompanyRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RoleMutationSchema.parse(input))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.targetUserId)
      .eq("company_id", data.companyId)
      .eq("role", data.role);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeCompanyMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => MemberMutationSchema.parse(input))
  .handler(async ({ data }) => {
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.targetUserId)
      .eq("company_id", data.companyId);
    if (roleErr) throw new Error(roleErr.message);

    const { error: memberErr } = await supabaseAdmin
      .from("company_members")
      .delete()
      .eq("user_id", data.targetUserId)
      .eq("company_id", data.companyId);
    if (memberErr) throw new Error(memberErr.message);

    return { ok: true };
  });
