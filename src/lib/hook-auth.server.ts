// Helper compartilhado para validar chamadas autenticadas
// nos hooks públicos /api/public/hooks/* (cron + admin).
//
// Aceita o header `x-internal-hook-secret` com o valor de
// `INTERNAL_HOOK_SECRET` (segredo dedicado, rotacionável).
// Comparação em tempo constante para evitar timing attacks.
import { timingSafeEqual } from "node:crypto";

export function checkPublicHookAuth(request: Request): Response | null {
  const provided =
    request.headers.get("x-internal-hook-secret") ??
    request.headers.get("X-Internal-Hook-Secret") ??
    "";
  const expected = process.env.INTERNAL_HOOK_SECRET ?? "";

  if (!expected) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  const ok = a.length === b.length && timingSafeEqual(a, b);

  if (!ok) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return null;
}
