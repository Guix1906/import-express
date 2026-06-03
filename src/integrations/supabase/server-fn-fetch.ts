import { createIsomorphicFn } from "@tanstack/react-start";

export const installServerFnAuthFetch = createIsomorphicFn()
  .server(() => {})
  .client(() => {
    const lexiaWindow = window as Window & { __lexiaServerFnFetchInstalled?: boolean };
    if (lexiaWindow.__lexiaServerFnFetchInstalled) return;
    lexiaWindow.__lexiaServerFnFetchInstalled = true;

    // Lazy import to avoid pulling supabase client into server bundle paths
    import("./client").then(({ supabase }) => {
      const originalFetch = window.fetch.bind(window);
      window.fetch = async (input, init) => {
        try {
          const url =
            typeof input === "string"
              ? input
              : input instanceof URL
                ? input.toString()
                : (input as Request).url;
          if (url.includes("/_serverFn/")) {
            const { data } = await supabase.auth.getSession();
            const token = data.session?.access_token;
            if (token) {
              const headers = new Headers(init?.headers ?? {});
              if (!headers.has("authorization")) {
                headers.set("authorization", `Bearer ${token}`);
              }
              return originalFetch(input as RequestInfo, { ...init, headers });
            }
          }
        } catch (error) {
          console.warn(
            "[auth] server function auth fetch fallback: could not attach bearer token",
            error instanceof Error ? error.message : error,
          );
        }
        return originalFetch(input as RequestInfo, init);
      };
    });
  });
