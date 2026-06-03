import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listCompanyTeamMembers } from "@/lib/team.functions";

export type CompanyMember = {
  user_id: string;
  full_name: string | null;
  role: string | null;
};

export function useCompanyMembers(companyId: string | null) {
  const listMembersFn = useServerFn(listCompanyTeamMembers);
  const { data = [] } = useQuery({
    queryKey: ["company-members", companyId],
    enabled: !!companyId,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const roleRank: Record<string, number> = {
        owner: 4,
        admin: 3,
        lawyer: 2,
        assistant: 1,
        viewer: 0,
      };
      const members = await listMembersFn({ data: { companyId: companyId! } });

      return members.map((member) => {
        const role =
          member.roles.slice().sort((a, b) => (roleRank[b] ?? -1) - (roleRank[a] ?? -1))[0] ?? null;

        return {
          user_id: member.user_id,
          full_name: member.full_name,
          role,
        };
      }) as CompanyMember[];
    },
  });
  const map = new Map<string, string>();
  data.forEach((m) => map.set(m.user_id, m.full_name ?? "Membro"));
  return { members: data, byId: map };
}
