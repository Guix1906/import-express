import { Link } from "@tanstack/react-router";
import { Scale } from "lucide-react";
import type { ReactNode } from "react";

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Left: form */}
      <div className="flex flex-col justify-between p-8 lg:p-14">
        <Link to="/" className="inline-flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground shadow-soft">
            <Scale className="h-4 w-4" />
          </span>
          Lexia
        </Link>

        <div className="mx-auto w-full max-w-sm">
          <h1 className="text-2xl font-semibold">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-6 text-sm text-muted-foreground">{footer}</div>}
        </div>

        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Lexia · Plataforma jurídica
        </p>
      </div>

      {/* Right: visual */}
      <div className="hidden lg:flex relative overflow-hidden bg-primary-soft">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,oklch(0.55_0.18_258/0.18),transparent_60%),radial-gradient(circle_at_80%_80%,oklch(0.7_0.15_220/0.18),transparent_55%)]" />
        <div className="relative z-10 m-auto max-w-md p-12">
          <div className="rounded-2xl border bg-card/80 backdrop-blur-sm p-6 shadow-elevated">
            <p className="text-sm font-medium text-primary">Gestão jurídica moderna</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight leading-snug">
              Processos, clientes e equipe — em um único painel claro e elegante.
            </p>
            <div className="mt-6 grid grid-cols-3 gap-3 text-xs">
              {["Processos", "Clientes", "Agenda"].map((l) => (
                <div key={l} className="rounded-md border bg-background/60 px-3 py-2 text-center">
                  {l}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
