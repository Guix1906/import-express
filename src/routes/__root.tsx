import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Sistema Advocacia" },
      {
        name: "description",
        content: "Sistema de gestão jurídica pronto para abrir com segurança.",
      },
    ],
  }),
  shellComponent: DocumentShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function DocumentShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return <Outlet />;
}

function NotFoundComponent() {
  return (
    <main className="min-h-screen px-6 py-16">
      <section className="mx-auto max-w-xl rounded-3xl border border-[var(--border)] bg-white/70 p-8 shadow-xl shadow-slate-950/5">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
          Página não encontrada
        </p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight">Esta rota não existe.</h1>
        <p className="mt-4 text-[var(--muted-foreground)]">
          Volte para a página inicial para continuar usando o sistema.
        </p>
        <Link
          to="/"
          className="mt-8 inline-flex rounded-full bg-[var(--primary)] px-5 py-3 font-semibold text-[var(--primary-foreground)]"
        >
          Abrir início
        </Link>
      </section>
    </main>
  );
}