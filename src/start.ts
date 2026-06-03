import { createMiddleware, createStart } from "@tanstack/react-start";

function hasTrustedOrigin(request: Request): boolean {
  const requestOrigin = new URL(request.url).origin;
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const fetchSite = request.headers.get("sec-fetch-site");

  if (fetchSite === "cross-site") {
    return false;
  }

  if (origin) {
    return origin === requestOrigin;
  }

  if (referer) {
    return new URL(referer).origin === requestOrigin;
  }

  return fetchSite === "same-origin" || fetchSite === "same-site" || fetchSite === "none";
}

const csrfMiddleware = createMiddleware({ type: "request" }).server(
  async ({ request, serverFnMeta, next }) => {
    if (serverFnMeta && !hasTrustedOrigin(request)) {
      return new Response("Forbidden", { status: 403 });
    }

    return next();
  },
);

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware],
}));