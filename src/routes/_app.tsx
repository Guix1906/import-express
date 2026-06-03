import { createFileRoute, Outlet, Navigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { Scale } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useActiveCompany } from "@/hooks/use-active-company";
import { Sidebar } from "@/components/app/sidebar";
import { Topbar } from "@/components/app/topbar";

export const Route = createFileRoute("/_app")({
  component: AppShell,
});

function FullPageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="relative grid h-16 w-16 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
          <Scale className="h-7 w-7 animate-pulse" />
          <span className="absolute inset-0 rounded-2xl border border-primary/30 animate-ping" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold tracking-wide">Juris Luxe</p>
          <p className="text-xs text-muted-foreground">Preparando seu escritório</p>
        </div>
      </div>
    </div>
  );
}

function AppShell() {
  const { loading, user, status } = useAuth();
  const { hasWorkspace, isLoading: companyLoading } = useActiveCompany();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isOnboarding = pathname === "/app/onboarding";

  useEffect(() => {
    if (status === "unauthenticated") {
      console.info("[auth] redirect reason: private route without restored session");
    }
  }, [status]);

  if (typeof window === "undefined") return <FullPageSpinner />;
  if (loading || (status === "authenticated" && companyLoading)) return <FullPageSpinner />;
  if (status === "unauthenticated" || !user) return <Navigate to="/login" replace />;
  if (!hasWorkspace && !isOnboarding) return <Navigate to="/app/onboarding" replace />;
  if (hasWorkspace && isOnboarding) return <Navigate to="/app" replace />;

  return (
    <div className="min-h-screen bg-background">
      {!isOnboarding && <Sidebar />}
      <div className={isOnboarding ? "" : "md:pl-60"}>
        {!isOnboarding && <Topbar />}
        <main className="p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
