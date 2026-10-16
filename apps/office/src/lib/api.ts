// Thin fetch wrapper for the same-origin API. The session is an httpOnly cookie, sent automatically.

export type FieldIssue = { path: (string | number)[]; message: string };

export class ApiError extends Error {
  readonly status: number;
  readonly issues?: FieldIssue[];
  constructor(status: number, message: string, issues?: FieldIssue[]) {
    super(message);
    this.status = status;
    this.issues = issues;
  }
}

type QueryValue = string | number | boolean | null | undefined;
export type Query = Record<string, QueryValue>;

const BASE = "/api";
let unauthorizedHandler: (() => void) | undefined;

/** Called on any 401 except a failed login (e.g. the session expired). */
export function onUnauthorized(handler: () => void) {
  unauthorizedHandler = handler;
}

function buildUrl(path: string, query?: Query) {
  const url = new URL(BASE + path, window.location.origin);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  }
  return url.pathname + url.search;
}

export async function request<T>(method: string, path: string, { body, query }: { body?: unknown; query?: Query } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(buildUrl(path, query), {
      method,
      credentials: "same-origin",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.");
  }

  const text = await res.text();
  const data = text ? safeJson(text) : undefined;
  if (!res.ok) {
    if (res.status === 401 && path !== "/auth/login") unauthorizedHandler?.();
    const payload = (data ?? {}) as { message?: string; issues?: FieldIssue[] };
    throw new ApiError(res.status, payload.message ?? `Request failed (${res.status})`, payload.issues);
  }
  return data as T;
}

function safeJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export const api = {
  get: <T>(path: string, query?: Query) => request<T>("GET", path, { query }),
  post: <T>(path: string, body: unknown = {}) => request<T>("POST", path, { body }),
  put: <T>(path: string, body: unknown) => request<T>("PUT", path, { body }),
  patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, { body }),
};

/** A readable message for toasts, including the first validation issue. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const first = err.issues?.[0];
    return first ? `${err.message}: ${first.path.join(".") || "input"} — ${first.message}` : err.message;
  }
  return err instanceof Error ? err.message : "Something went wrong";
}
