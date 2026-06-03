import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, CheckCircle2, Loader2, Scale, ShieldCheck, UsersRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_app/app/onboarding")({
  component: OnboardingPage,
});

const schema = z.object({
  fullName: z.string().trim().min(2, "Informe seu nome").max(120),
  companyName: z.string().trim().min(2, "Informe o nome do escritório").max(160),
});

function OnboardingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    fullName: user?.user_metadata?.full_name ?? user?.email?.split("@")[0] ?? "",
    companyName: user?.user_metadata?.company_name ?? "",
  });

  const complete = useMutation({
    mutationFn: async () => {
      const parsed = schema.safeParse(form);
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);

      const { data, error } = await supabase.rpc(
        "ensure_user_workspace" as never,
        {
          _company_name: parsed.data.companyName,
          _full_name: parsed.data.fullName,
        } as never,
      );
      if (error) throw error;
      return data as string;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["active-company", user?.id] });
      await queryClient.invalidateQueries({ queryKey: ["topbar-companies", user?.id] });
      toast.success("Escritório configurado", {
        description: "Seu ambiente está pronto para operar.",
      });
      navigate({ to: "/app" });
    },
    onError: (error: Error) => {
      toast.error("Não foi possível configurar o escritório", { description: error.message });
    },
  });

  return (
    <div className="mx-auto flex min-h-[calc(100vh-7rem)] max-w-6xl items-center">
      <div className="grid w-full gap-8 lg:grid-cols-[1fr_420px] lg:items-center">
        <section className="space-y-6">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <Scale className="h-7 w-7" />
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
              Primeiro acesso
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">
              Configure seu escritório para começar com segurança.
            </h1>
            <p className="mt-4 max-w-2xl text-base text-muted-foreground">
              Todo dado do Juris Luxe é separado por empresa. Esta etapa cria o workspace, vincula
              seu usuário como proprietário e libera os módulos do sistema.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <TrustItem
              icon={Building2}
              title="Empresa isolada"
              text="Dados filtrados por company_id."
            />
            <TrustItem icon={UsersRound} title="Equipe preparada" text="Você entra como owner." />
            <TrustItem
              icon={ShieldCheck}
              title="Base auditável"
              text="Pronto para permissões e logs."
            />
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-lg font-semibold">Dados iniciais</h2>
            <p className="text-sm text-muted-foreground">Você pode ajustar isso depois.</p>
          </div>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="fullName">Seu nome</Label>
              <Input
                id="fullName"
                value={form.fullName}
                onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="companyName">Nome do escritório</Label>
              <Input
                id="companyName"
                value={form.companyName}
                placeholder="Ex: Silva & Associados"
                onChange={(e) => setForm((p) => ({ ...p, companyName: e.target.value }))}
              />
            </div>
            <Button
              className="w-full gap-2"
              disabled={complete.isPending}
              onClick={() => complete.mutate()}
            >
              {complete.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Finalizar configuração
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}

function TrustItem({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Building2;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <Icon className="h-5 w-5 text-primary" />
      <p className="mt-3 text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{text}</p>
    </div>
  );
}
