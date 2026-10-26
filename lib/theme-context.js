import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext({
  theme: "light",
  mounted: false,
  toggle: () => {},
  setTheme: () => {},
});

const STORAGE_KEY = "simplify-theme";

function aplicarClasseNoDom(theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (theme === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}

function persistir(theme) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* storage bloqueado: ignora */
  }
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    if (typeof window === "undefined") return "light";
    return document.documentElement.classList.contains("dark")
      ? "dark"
      : "light";
  });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Se o usuário nunca escolheu manualmente, acompanha o sistema
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e) => {
      try {
        if (localStorage.getItem(STORAGE_KEY)) return;
      } catch {
        /* ignora */
      }
      const next = e.matches ? "dark" : "light";
      setThemeState(next);
      aplicarClasseNoDom(next);
    };
    mql.addEventListener?.("change", handler);
    return () => mql.removeEventListener?.("change", handler);
  }, []);

  // Aplica/persiste sempre que o state muda (fallback p/ setTheme externo)
  useEffect(() => {
    if (!mounted) return;
    aplicarClasseNoDom(theme);
  }, [theme, mounted]);

  function setTheme(t) {
    const next = t === "dark" ? "dark" : "light";
    // aplica imediatamente no DOM para o usuário ver a mudança sem esperar
    aplicarClasseNoDom(next);
    persistir(next);
    setThemeState(next);
  }

  function toggle() {
    setThemeState((t) => {
      const next = t === "dark" ? "light" : "dark";
      // aplica imediatamente, sem esperar render/effect
      aplicarClasseNoDom(next);
      persistir(next);
      return next;
    });
  }

  return (
    <ThemeContext.Provider value={{ theme, mounted, toggle, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
