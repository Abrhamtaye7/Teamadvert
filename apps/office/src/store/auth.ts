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

function cachedUser(): User | null {
  try {
    const raw = storage.get();
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  // Restored synchronously so the route guard sees it on the first render (legacy restored it in an
  // effect, after the guard had already redirected to /login, so every refresh landed on the dashboard).
  user: cachedUser(),
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

/** Confirms the cached session with the server and refreshes the profile (a 401 clears it). */
export function hydrateAuth() {
  if (useAuthStore.getState().user) {
    api
      .get("/auth/me")
      .then((res) => useAuthStore.getState().setSession({ user: res.data }))
      .catch(() => undefined);
  }
}
