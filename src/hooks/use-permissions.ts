import { useActiveCompany } from "@/hooks/use-active-company";

export type AppRole = "owner" | "admin" | "lawyer" | "assistant" | "viewer";

const roleRank: Record<AppRole, number> = {
  viewer: 0,
  assistant: 1,
  lawyer: 2,
  admin: 3,
  owner: 4,
};

export function usePermissions() {
  const { role, companyId, hasWorkspace, isLoading } = useActiveCompany();
  const appRole = role as AppRole | null;

  const hasRole = (...roles: AppRole[]) => !!appRole && roles.includes(appRole);
  const atLeast = (minimum: AppRole) => !!appRole && roleRank[appRole] >= roleRank[minimum];

  return {
    role: appRole,
    companyId,
    hasWorkspace,
    isLoading,
    isOwner: hasRole("owner"),
    isAdmin: hasRole("owner", "admin"),
    isLawyer: hasRole("owner", "admin", "lawyer"),
    isAssistant: hasRole("assistant"),
    canManageTeam: atLeast("admin"),
    canManageCompany: atLeast("admin"),
    canViewFinance: hasRole("owner", "admin"),
    canEditFinance: hasRole("owner", "admin"),
    canDeleteRecords: hasRole("owner", "admin"),
    canCreateTriage: hasRole("owner", "admin", "lawyer", "assistant"),
    canEditLegalAnalysis: hasRole("owner", "admin", "lawyer"),
    hasRole,
    atLeast,
  };
}
