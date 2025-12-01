import { create } from "zustand";

export type User = {
  id: number;
  username: string;
  role: string;
  permissions?: Record<string, boolean> | null;
};

type AuthState = {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  setSession: (payload: { user: User; accessToken: string; refreshToken?: string }) => void;
  logout: () => void;
};

const read = (key: string) => (typeof localStorage === "undefined" ? null : localStorage.getItem(key));

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  setSession: ({ user, accessToken, refreshToken }) => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("accessToken", accessToken);
      if (refreshToken) localStorage.setItem("refreshToken", refreshToken);
      localStorage.setItem("user", JSON.stringify(user));
    }
    set({ user, accessToken, refreshToken: refreshToken ?? null });
  },
  logout: () => {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("user");
    }
    set({ user: null, accessToken: null, refreshToken: null });
  },
}));

export function hydrateAuth() {
  const token = read("accessToken");
  const refreshToken = read("refreshToken");
  const userRaw = read("user");
  if (token && userRaw) {
    try {
      useAuthStore.setState({ accessToken: token, refreshToken, user: JSON.parse(userRaw) });
    } catch (err) {
      console.error("Failed to hydrate auth", err);
    }
  }
}
