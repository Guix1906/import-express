/* eslint-disable @typescript-eslint/no-explicit-any */
import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Calendar,
  Users,
  Briefcase,
  DollarSign,
  FileText,
  Settings,
  Scale,
  ChevronLeft,
  Menu,
  BarChart3,
  LifeBuoy,
  Users2,
  KanbanSquare,
  Building2,
  ClipboardList,
  FileSignature,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  badge?: { text: string; tone: "new" | "ai" | "alert" };
};

type NavSection = { label: string; items: NavItem[] };

// Sidebar enxuta — apenas o essencial para o dia a dia.
// Módulos avançados (Triagem, Pré-atendimentos, Publicações, Kanbans, Auditoria,
// Atendimentos) continuam acessíveis via ficha do cliente, contexto interno
// das telas principais e busca global (Cmd/Ctrl+K).
const navSections: NavSection[] = [
  {
    label: "Principal",
    items: [
      { to: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
      { to: "/app/triagem", label: "Triagem", icon: ClipboardList },
      { to: "/app/meu-quadro", label: "Meu Quadro", icon: KanbanSquare },
      { to: "/app/clientes", label: "Clientes", icon: Users },
      { to: "/app/processos", label: "Processos", icon: Briefcase },
      { to: "/app/agenda", label: "Agenda", icon: Calendar },
    ],
  },
  {
    label: "Gestão",
    items: [
      { to: "/app/producao-escritorio", label: "Produção", icon: Building2 },

      { to: "/app/financeiro", label: "Financeiro", icon: DollarSign },
      { to: "/app/contratos", label: "Contratos", icon: FileSignature },
      { to: "/app/documentos", label: "Documentos", icon: FileText },
      { to: "/app/equipe", label: "Equipe", icon: Users2 },
      { to: "/app/relatorios", label: "Relatórios", icon: BarChart3 },
    ],
  },
];

const footerNav: NavItem[] = [
  { to: "/app/suporte", label: "Suporte", icon: LifeBuoy },
  { to: "/app/configuracoes", label: "Configurações", icon: Settings },
];

function NavItems({
  pathname,
  collapsed,
  onNavigate,
}: {
  pathname: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const renderItem = (item: NavItem) => {
    const active =
      "exact" in item && item.exact
        ? pathname === item.to
        : pathname === item.to || pathname.startsWith(item.to + "/");
    const Icon = item.icon;
    return (
      <Link
        key={item.to}
        to={item.to as any}
        onClick={onNavigate}
        title={collapsed ? item.label : undefined}
        className={cn(
          "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-all duration-200",
          active
            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-soft"
            : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground hover:translate-x-0.5",
        )}
      >
        {active && (
          <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r-full bg-primary" />
        )}
        <Icon className={cn("h-4 w-4 shrink-0 transition-colors", active && "text-primary")} />
        {!collapsed && (
          <>
            <span className="truncate flex-1">{item.label}</span>
            {item.badge && <NavBadge tone={item.badge.tone}>{item.badge.text}</NavBadge>}
          </>
        )}
      </Link>
    );
  };

  return (
    <>
      <nav className="flex-1 px-2 py-3 space-y-3 overflow-y-auto">
        {navSections.map((section) => (
          <div key={section.label} className="space-y-0.5">
            {!collapsed && (
              <div className="px-3 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {section.label}
              </div>
            )}
            {section.items.map(renderItem)}
          </div>
        ))}
      </nav>

      <div className="border-t p-2 space-y-0.5">
        {footerNav.map((item) => {
          const active = pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to as any}
              onClick={onNavigate}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-all duration-200",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              )}
            >
              <Icon className={cn("h-4 w-4 shrink-0", active && "text-primary")} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </div>
    </>
  );
}

function NavBadge({ tone, children }: { tone: "new" | "ai" | "alert"; children: React.ReactNode }) {
  const tones = {
    new: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    ai: "bg-gradient-to-r from-violet-500/20 to-primary/20 text-primary",
    alert: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  } as const;
  return (
    <span
      className={cn(
        "ml-auto inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold tracking-wide uppercase",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

function Brand({ collapsed }: { collapsed?: boolean }) {
  return (
    <div className="flex h-14 items-center gap-2 border-b px-4 shrink-0">
      <div className="grid h-8 w-8 place-items-center rounded-md bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-soft shrink-0">
        <Scale className="h-4 w-4" />
      </div>
      {!collapsed && (
        <div className="flex flex-col leading-tight">
          <span className="font-semibold tracking-tight">Lexia</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Jurídico
          </span>
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [collapsed, setCollapsed] = useState(false);

  // Preload de rotas fica desativado no router para evitar chunks/redirects
  // extras no hover. As telas carregam somente no clique efetivo.

  return (
    <aside
      className={cn(
        "hidden md:flex fixed inset-y-0 left-0 z-30 flex-col border-r bg-sidebar text-sidebar-foreground transition-[width] duration-300 ease-out",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <Brand collapsed={collapsed} />
      <NavItems pathname={pathname} collapsed={collapsed} />
      <div className="border-t p-2">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground transition-colors"
        >
          <ChevronLeft
            className={cn("h-4 w-4 transition-transform duration-300", collapsed && "rotate-180")}
          />
          {!collapsed && <span>Recolher</span>}
        </button>
      </div>
    </aside>
  );
}

export function MobileSidebarTrigger() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden h-9 w-9 -ml-1">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="p-0 w-64 flex flex-col bg-sidebar text-sidebar-foreground"
      >
        <VisuallyHidden>
          <SheetTitle>Menu</SheetTitle>
        </VisuallyHidden>
        <Brand />
        <NavItems pathname={pathname} onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
