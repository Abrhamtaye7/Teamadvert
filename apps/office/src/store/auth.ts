import { create } from "zustand";
import api from "../lib/api";

export type User = {
  id: number;
  username: string;
  role: string;
  permissions?: Record<string, boolean> | null;
  access?: string[];
};

type AuthState = {
  user: User | null;
  setSession: (payload: { user: User }) => void;
  clearSession: () => void;
  logout: () => Promise<void>;
};

// The session itself lives in an httpOnly cookie; only the (non-secret) user profile is cached for the UI.
const USER_KEY = "user";

const storage = {
  get: () => {
    try {
      return localStorage.getItem(USER_KEY);
    } catch {
      return null;
    }
  },
  set: (value: string | null) => {
    try {
      if (value === null) localStorage.removeItem(USER_KEY);
      else localStorage.setItem(USER_KEY, value);
    } catch {
      /* storage unavailable: the cookie session still works */
    }
  },
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  setSession: ({ user }) => {
    storage.set(JSON.stringify(user));
    set({ user });
  },
  clearSession: () => {
    storage.set(null);
    set({ user: null });
  },
  logout: async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      useAuthStore.getState().clearSession();
    }
  },
}));

/** Restores the cached user, then confirms the session with the server (a 401 clears it). */
export function hydrateAuth() {
  const cached = storage.get();
  if (cached && !useAuthStore.getState().user) {
    try {
      useAuthStore.setState({ user: JSON.parse(cached) });
    } catch {
      storage.set(null);
    }
  }
  if (useAuthStore.getState().user) {
    api
      .get("/auth/me")
      .then((res) => useAuthStore.getState().setSession({ user: res.data }))
      .catch(() => undefined);
  }
}
