import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export type ActiveCompanyState = {
  companyId: string | null;
  companyName: string | null;
  fullName: string | null;
  role: string | null;
  hasWorkspace: boolean;
};

export function useActiveCompany() {
  const { user } = useAuth();
  const { data, isLoading, error } = useQuery({
    queryKey: ["active-company", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("active_company_id, full_name")
        .eq("id", user!.id)
        .maybeSingle();
      let companyId = profile?.active_company_id ?? null;
      if (!companyId) {
        const { data: m } = await supabase
          .from("company_members")
          .select("company_id")
          .eq("user_id", user!.id)
          .limit(1)
          .maybeSingle();
        companyId = m?.company_id ?? null;
      }

      if (!companyId) {
        return {
          companyId: null,
          companyName: null,
          fullName: profile?.full_name ?? null,
          role: null,
          hasWorkspace: false,
        } satisfies ActiveCompanyState;
      }

      const [{ data: company }, { data: roleRow }] = await Promise.all([
        supabase.from("companies").select("id, name").eq("id", companyId).maybeSingle(),
        supabase
          .from("user_roles")
          .select("role")
          .eq("company_id", companyId)
          .eq("user_id", user!.id)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle(),
      ]);

      const role = roleRow?.role ?? (profile?.active_company_id ? "owner" : null);

      return {
        companyId,
        companyName: company?.name ?? null,
        fullName: profile?.full_name ?? null,
        role,
        hasWorkspace: true,
      } satisfies ActiveCompanyState;
    },
  });
  return {
    companyId: data?.companyId ?? null,
    companyName: data?.companyName ?? null,
    fullName: data?.fullName ?? null,
    role: data?.role ?? null,
    hasWorkspace: data?.hasWorkspace ?? false,
    isLoading,
    error,
  };
}
