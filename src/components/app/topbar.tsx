import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, LogOut, User as UserIcon, Building2, Sparkles } from "lucide-react";
import { NotificationBell } from "@/components/app/notification-bell";
import { GlobalSearch } from "@/components/app/global-search";
import { NewCaseWizard } from "@/components/app/new-case-wizard";
import { useAuth } from "@/hooks/use-auth";
import { useActiveCompany } from "@/hooks/use-active-company";
import { usePermissions } from "@/hooks/use-permissions";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { MobileSidebarTrigger } from "@/components/app/sidebar";

type Company = { id: string; name: string };

const roleLabels: Record<string, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  lawyer: "Advogado",
  assistant: "Secretária",
};

export function Topbar() {
  const { user, signOut } = useAuth();
  const { companyId, fullName } = useActiveCompany();
  const { role } = usePermissions();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [activeOverride, setActiveOverride] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);

  useEffect(() => setActiveOverride(null), [companyId]);

  const { data: companies = [] } = useQuery({
    queryKey: ["topbar-companies", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: memberships } = await supabase
        .from("company_members")
        .select("companies(id, name)")
        .eq("user_id", user!.id);
      return (memberships ?? [])
        .map((m: { companies: Company | null }) => m.companies)
        .filter((c): c is Company => !!c)
        .sort((a, b) => a.name.localeCompare(b.name));
    },
  });

  const activeId = activeOverride ?? companyId;

  const setActive = async (id: string) => {
    setActiveOverride(id);
    if (user) await supabase.from("profiles").update({ active_company_id: id }).eq("id", user.id);
    queryClient.invalidateQueries({ queryKey: ["active-company", user?.id] });
  };

  const initials = (fullName || user?.email || "?")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const activeCompany = companies.find((c) => c.id === activeId);

  return (
    <header className="sticky top-0 z-20 h-14 border-b bg-background/80 backdrop-blur">
      <div className="flex h-full items-center gap-3 px-4 md:px-6">
        <MobileSidebarTrigger />
        {/* Empresa ativa */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2 -ml-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium truncate max-w-[180px]">
                {activeCompany?.name ?? "Selecionar empresa"}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel>Suas empresas</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {companies.map((c) => (
              <DropdownMenuItem key={c.id} onClick={() => setActive(c.id)}>
                <Building2 className="h-4 w-4 mr-2 text-muted-foreground" />
                <span className="truncate">{c.name}</span>
                {c.id === activeId && <span className="ml-auto text-xs text-primary">ativa</span>}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate({ to: "/app/onboarding" })}>
              <Building2 className="h-4 w-4 mr-2 text-muted-foreground" />
              Configurar acesso
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <GlobalSearch />

        <div className="ml-auto flex items-center gap-1.5">
          <Button
            onClick={() => setWizardOpen(true)}
            size="sm"
            className="gap-2 bg-gradient-to-r from-primary to-primary/85 hover:from-primary/95 hover:to-primary/80 shadow-soft"
          >
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline">Novo Caso</span>
          </Button>
          <NotificationBell />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-accent transition">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground hidden sm:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{fullName || "Usuário"}</span>
                  <span className="text-xs text-muted-foreground truncate">{user?.email}</span>
                  {role && (
                    <span className="mt-1 text-[10px] uppercase tracking-wide text-primary">
                      {roleLabels[role] ?? role}
                    </span>
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate({ to: "/app/configuracoes" })}>
                <UserIcon className="h-4 w-4 mr-2" /> Perfil
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={async () => {
                  await signOut();
                  navigate({ to: "/login" });
                }}
              >
                <LogOut className="h-4 w-4 mr-2" /> Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <NewCaseWizard open={wizardOpen} onOpenChange={setWizardOpen} />
    </header>
  );
}
