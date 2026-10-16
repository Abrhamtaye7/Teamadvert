import { useCallback } from "react";
import { useSearchParams } from "react-router";

/**
 * List filters kept in the URL (?q=…&page=2), so the back button and shared links keep them.
 * Changing any filter other than `page` resets to page 1.
 */
export function useUrlState<K extends string>(keys: readonly K[]) {
  const [params, setParams] = useSearchParams();
  const values = Object.fromEntries(keys.map((k) => [k, params.get(k) ?? ""])) as Record<K, string>;
  const set = useCallback(
    (patch: Partial<Record<K, string>>) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(patch) as [string, string | undefined][]) {
            if (value) next.set(key, value);
            else next.delete(key);
          }
          if (!("page" in patch)) next.delete("page");
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );
  return [values, set] as const;
}
