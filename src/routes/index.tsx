import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return (
    <main className="min-h-screen px-6 py-12">
      <section className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--muted-foreground)]">
            Sistema Advocacia
          </p>
          <h1 className="mt-5 text-5xl font-black tracking-tight md:text-7xl">
            O sistema está pronto para abrir.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--muted-foreground)]">
            A base do projeto foi restaurada com uma inicialização segura e proteção contra chamadas cruzadas em funções do servidor.
          </p>
        </div>
        <div className="rounded-[2rem] border border-[var(--border)] bg-white/75 p-6 shadow-2xl shadow-slate-950/10">
          <div className="rounded-3xl bg-[var(--muted)] p-6">
            <p className="text-sm font-semibold text-[var(--muted-foreground)]">Status</p>
            <p className="mt-3 text-3xl font-bold">Operacional</p>
            <div className="mt-8 grid gap-3">
              {["Rotas carregadas", "Shell restaurado", "Proteção CSRF ativa"].map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-2xl bg-[var(--background)] p-4">
                  <span className="h-2.5 w-2.5 rounded-full bg-[var(--accent)]" />
                  <span className="font-medium">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}