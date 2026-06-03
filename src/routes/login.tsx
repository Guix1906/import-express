import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

const schema = z.object({
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(6, "Mínimo 6 caracteres").max(72),
});

const getLoginErrorMessage = (error: unknown) => {
  const message = error instanceof Error ? error.message : "";
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return "E-mail ou senha incorretos. Confira os dados ou redefina sua senha.";
  }

  if (normalized.includes("email not confirmed")) {
    return "Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada antes de entrar.";
  }

  return message || "Não foi possível autenticar agora. Tente novamente.";
};

function LoginPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading, status, signIn } = useAuth();
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Se já está logado (ex: voltou pra /login com sessão ativa), manda pro app
  useEffect(() => {
    if (status === "authenticated" && user) {
      console.info("[auth] redirect reason: login page with active session");
      navigate({ to: "/app" });
    }
  }, [status, user, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setErrorMessage("");
    setLoading(true);
    try {
      await signIn(parsed.data);
      navigate({ to: "/app" });
    } catch (error) {
      const message = getLoginErrorMessage(error);
      setErrorMessage(message);
      toast.error("Não foi possível entrar", { description: message });
    } finally {
      setLoading(false);
    }
  };

  const resendConfirmation = async () => {
    const parsed = schema.pick({ email: true }).safeParse({ email });
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
    toast.success("E-mail de confirmação reenviado", {
      description: "Confira a caixa de entrada, spam e promoções.",
    });
  };

  return (
    <AuthLayout
      title="Bem-vindo de volta"
      subtitle="Entre com seu e-mail e senha para continuar."
      footer={
        <>
          Ainda não tem conta?{" "}
          <Link to="/register" className="text-primary font-medium hover:underline">
            Criar conta
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            aria-invalid={Boolean(errorMessage)}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errorMessage) setErrorMessage("");
            }}
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Senha</Label>
            <Link
              to="/forgot-password"
              className="text-xs text-muted-foreground hover:text-primary"
            >
              Esqueci minha senha
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            aria-invalid={Boolean(errorMessage)}
            onChange={(e) => {
              setPassword(e.target.value);
              if (errorMessage) setErrorMessage("");
            }}
          />
        </div>
        {errorMessage ? (
          <div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <p>{errorMessage}</p>
            {errorMessage.toLowerCase().includes("confirmado") ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-full border-destructive/30 bg-background text-foreground"
                disabled={resending}
                onClick={resendConfirmation}
              >
                {resending ? "Reenviando..." : "Reenviar confirmação"}
              </Button>
            ) : null}
          </div>
        ) : null}
        <Button type="submit" className="w-full" disabled={loading || authLoading}>
          {loading || authLoading ? "Entrando..." : "Entrar"}
        </Button>
      </form>
    </AuthLayout>
  );
}
