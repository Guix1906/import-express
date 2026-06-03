import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/register")({
  component: RegisterPage,
});

const schema = z.object({
  full_name: z.string().trim().min(2, "Informe seu nome").max(120),
  company_name: z.string().trim().min(2, "Informe o nome do escritório").max(120),
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(8, "Mínimo 8 caracteres").max(72),
});

function RegisterPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [form, setForm] = useState({ full_name: "", company_name: "", email: "", password: "" });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/app`,
        data: {
          full_name: parsed.data.full_name,
          company_name: parsed.data.company_name,
        },
      },
    });
    setLoading(false);
    if (error) {
      toast.error("Não foi possível criar a conta", { description: error.message });
      return;
    }
    if (data.session?.user) {
      console.info("[auth] signup success with active session", { userId: data.session.user.id });
      toast.success("Conta criada!", { description: "Bem-vindo à Lexia." });
      navigate({ to: "/app" });
      return;
    }
    console.info("[auth] signup success pending email confirmation");
    setPendingEmail(parsed.data.email);
    toast.success("Conta criada!", {
      description: "Enviamos um link de confirmação para o e-mail informado.",
    });
  };

  const resendConfirmation = async () => {
    const parsed = schema.pick({ email: true }).safeParse({ email: pendingEmail || form.email });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setResending(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: parsed.data.email,
      options: {
        emailRedirectTo: `${window.location.origin}/app`,
      },
    });
    setResending(false);
    if (error) {
      toast.error("Não foi possível reenviar", { description: error.message });
      return;
    }
    toast.success("E-mail reenviado", {
      description: "Confira a caixa de entrada, spam e promoções.",
    });
  };

  return (
    <AuthLayout
      title="Criar sua conta"
      subtitle="Comece em segundos. Seu escritório é criado automaticamente."
      footer={
        <>
          Já tem conta?{" "}
          <Link to="/login" className="text-primary font-medium hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      {pendingEmail ? (
        <div className="space-y-4">
          <div className="rounded-lg border bg-primary/5 p-4 text-sm">
            <p className="font-medium">Confirme seu e-mail para entrar.</p>
            <p className="mt-1 text-muted-foreground">
              Enviamos o link para <strong>{pendingEmail}</strong>. Se não chegar em alguns minutos,
              verifique spam/promoções ou reenvie.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={resending}
            onClick={resendConfirmation}
          >
            {resending ? "Reenviando..." : "Reenviar e-mail de confirmação"}
          </Button>
          <Button type="button" className="w-full" onClick={() => navigate({ to: "/login" })}>
            Ir para login
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="full_name">Seu nome</Label>
            <Input id="full_name" required value={form.full_name} onChange={set("full_name")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="company_name">Nome do escritório</Label>
            <Input
              id="company_name"
              required
              value={form.company_name}
              onChange={set("company_name")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail profissional</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={form.email}
              onChange={set("email")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              value={form.password}
              onChange={set("password")}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Criando..." : "Criar conta"}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
