import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { SessionUser } from "../lib/types";
import { useSession } from "./session";

export function useLogin() {
  const setUser = useSession((s) => s.setUser);
  return useMutation({
    mutationFn: (input: { username: string; pin: string }) => api.post<{ user: SessionUser }>("/auth/login", input),
    onSuccess: ({ user }) => setUser(user),
  });
}

export function useLogout() {
  const clear = useSession((s) => s.clear);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/auth/logout"),
    onSettled: () => {
      clear();
      queryClient.clear();
    },
  });
}

/** Re-validates the cached session on load and refreshes the profile (role/access may have changed). */
export function useMe(enabled: boolean) {
  const setUser = useSession((s) => s.setUser);
  return useQuery({
    queryKey: ["me"],
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const me = await api.get<SessionUser>("/auth/me");
      setUser(me);
      return me;
    },
  });
}

export function useChangePin() {
  return useMutation({
    mutationFn: (input: { currentPin: string; newPin: string }) => api.post<{ message: string }>("/auth/change-pin", input),
  });
}
