import { create } from "zustand";
import type { SessionUser } from "../lib/types";

// The session is an httpOnly cookie; only the (non-secret) profile is cached so the UI can render
// immediately on reload. The server re-checks it via /auth/me.
const KEY = "ta.user";

function read(): SessionUser | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SessionUser) : null;
  } catch {
    return null;
  }
}

function write(user: SessionUser | null) {
  try {
    if (user) localStorage.setItem(KEY, JSON.stringify(user));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable: the cookie session still works */
  }
}

type SessionState = {
  user: SessionUser | null;
  setUser: (user: SessionUser) => void;
  clear: () => void;
};

export const useSession = create<SessionState>((set) => ({
  user: read(),
  setUser: (user) => {
    write(user);
    set({ user });
  },
  clear: () => {
    write(null);
    set({ user: null });
  },
}));
