import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Scale, Briefcase, Users, Calendar, Shield, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="border-b">
        <div className="mx-auto max-w-6xl flex h-16 items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground shadow-soft">
              <Scale className="h-4 w-4" />
            </span>
            Lexia
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/login">Entrar</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/register">
                Começar grátis <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_30%_0%,oklch(0.55_0.18_258/0.12),transparent_55%),radial-gradient(circle_at_80%_20%,oklch(0.7_0.15_220/0.1),transparent_50%)]" />
        <div className="mx-auto max-w-4xl px-6 py-24 lg:py-32 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-soft">
            <Sparkles className="h-3 w-3 text-primary" /> Nova plataforma jurídica
          </span>
          <h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight">
            O sistema do seu escritório,
            <br />
            <span className="text-primary">simples e elegante.</span>
          </h1>
          <p className="mt-5 text-lg text-muted-foreground max-w-2xl mx-auto">
            Gerencie processos, clientes, prazos e equipe em uma só plataforma — multiempresa,
            segura e desenhada para o trabalho jurídico moderno.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/register">
                Criar conta grátis <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/login">Já tenho conta</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 pb-24 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            icon: Briefcase,
            title: "Processos",
            desc: "Acompanhe andamentos, prazos e movimentações.",
          },
          { icon: Users, title: "Clientes", desc: "CRM jurídico com histórico completo." },
          { icon: Calendar, title: "Agenda", desc: "Audiências, reuniões e prazos sob controle." },
          {
            icon: Shield,
            title: "Multiempresa",
            desc: "Gerencie vários escritórios com segurança.",
          },
        ].map((f) => (
          <div
            key={f.title}
            className="rounded-xl border bg-card p-5 shadow-soft hover:shadow-elevated transition-shadow"
          >
            <div className="grid h-9 w-9 place-items-center rounded-md bg-primary-soft text-primary">
              <f.icon className="h-4 w-4" />
            </div>
            <h3 className="mt-4 font-semibold">{f.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
