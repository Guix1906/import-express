import { useEffect, type ReactNode } from "react";

export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.documentElement.classList.remove("dark");
    try {
      localStorage.removeItem("lexia-theme");
    } catch {}
  }, []);
  return <>{children}</>;
}

export const useTheme = () => ({ theme: "light" as const, toggle: () => {}, setTheme: () => {} });
