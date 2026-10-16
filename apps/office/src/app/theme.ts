import { create } from "zustand";

type Theme = "light" | "dark";
const KEY = "ta.theme";

function initial(): Theme {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* ignore */
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function apply(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export const useTheme = create<{ theme: Theme; toggle: () => void }>((set, get) => {
  const theme = initial();
  apply(theme);
  return {
    theme,
    toggle: () => {
      const next: Theme = get().theme === "dark" ? "light" : "dark";
      apply(next);
      try {
        localStorage.setItem(KEY, next);
      } catch {
        /* ignore */
      }
      set({ theme: next });
    },
  };
});
