import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthCtx = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  status: AuthStatus;
  signIn: (credentials: { email: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({
  user: null,
  session: null,
  loading: true,
  status: "loading",
  signIn: async () => {},
  signOut: async () => {},
});

const authLog = (message: string, extra?: Record<string, unknown>) => {
  console.info(`[auth] ${message}`, extra ?? {});
};

const authWarn = (message: string, error?: unknown) => {
  console.warn(`[auth] ${message}`, error instanceof Error ? error.message : (error ?? ""));
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const sessionRef = useRef<Session | null>(null);

  const applySession = (nextSession: Session | null, reason: string) => {
    sessionRef.current = nextSession;
    setSession(nextSession);
    setStatus(nextSession?.user ? "authenticated" : "unauthenticated");
    authLog(reason, {
      status: nextSession?.user ? "authenticated" : "unauthenticated",
      userId: nextSession?.user?.id ?? null,
      expiresAt: nextSession?.expires_at ?? null,
    });
  };

  useEffect(() => {
    let mounted = true;

    const restoreSession = async () => {
      setStatus("loading");
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        const restoredSession = data.session ?? null;
        if (!restoredSession) {
          if (!mounted) return;
          applySession(null, "token restore: no stored session");
          return;
        }

        if (!mounted) return;
        applySession(restoredSession, "token restore: session restored");
      } catch (error) {
        authWarn("token restore failed", error);
        if (!mounted) return;
        applySession(null, "token restore: failed");
      }
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (!mounted) return;
      if (event === "INITIAL_SESSION") {
        authLog("initial session event received; waiting explicit restore", {
          hasSession: Boolean(s?.user),
        });
        return;
      }

      sessionRef.current = s;
      setSession(s);
      setStatus(s?.user ? "authenticated" : "unauthenticated");
      if (event === "SIGNED_OUT") queryClient.clear();
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        queryClient.invalidateQueries();
      }
      authLog(`state change: ${event}`, {
        status: s?.user ? "authenticated" : "unauthenticated",
        userId: s?.user?.id ?? null,
      });
    });

    restoreSession();

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [queryClient]);

  const value = useMemo<AuthCtx>(
    () => ({
      user: session?.user ?? null,
      session,
      loading: status === "loading",
      status,
      signIn: async (credentials) => {
        setStatus("loading");
        try {
          const { data, error } = await supabase.auth.signInWithPassword(credentials);
          if (error) throw error;
          if (!data.session?.user) {
            throw new Error("Sessão não retornada pelo provedor de autenticação.");
          }
          setSession(data.session);
          setStatus("authenticated");
          authLog("login success", { userId: data.session.user.id });
        } catch (error) {
          const previousSession = sessionRef.current;
          setSession(previousSession);
          setStatus(previousSession?.user ? "authenticated" : "unauthenticated");
          authWarn("login error", error);
          throw error;
        }
      },
      signOut: async () => {
        setStatus("loading");
        try {
          const { error } = await supabase.auth.signOut();
          if (error) throw error;
          authLog("logout success");
        } catch (error) {
          authWarn("logout error", error);
          throw error;
        } finally {
          sessionRef.current = null;
          setSession(null);
          setStatus("unauthenticated");
        }
      },
    }),
    [session, status],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
