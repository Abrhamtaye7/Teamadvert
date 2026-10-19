// Calls the office API in-process as the linked office user, so the bot gets exactly the same permissions,
// validation, audit trail and notifications as someone using /office.
import { SESSION_COOKIE } from "../lib/sessions";

/** Runs a request through the API app (no network hop). */
export type CallApi = (req: Request) => Response | Promise<Response>;

export class OfficeError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

type Query = Record<string, string | number | undefined>;

export type OfficeApi = {
  get<T = any>(path: string, query?: Query): Promise<T>;
  post<T = any>(path: string, body?: unknown): Promise<T>;
  put<T = any>(path: string, body?: unknown): Promise<T>;
  patch<T = any>(path: string, body?: unknown): Promise<T>;
};

type Issue = { path?: (string | number)[]; message?: string };

/** The API's error body as one readable sentence, e.g. "items.0.quantity: Number must be greater than 0". */
function errorMessage(status: number, json: unknown) {
  const body = (json ?? {}) as { message?: string; issues?: Issue[] };
  const issue = body.issues?.[0];
  if (issue?.message) return issue.path?.length ? `${issue.path.join(".")}: ${issue.message}` : issue.message;
  return body.message ?? `Request failed (${status})`;
}

/**
 * `session(renew)` returns a session token for the linked office user; with `renew` it must create a new one
 * (the old one expired). Each call retries once after a 401.
 */
export function createOfficeApi(callApi: CallApi, session: (renew: boolean) => Promise<string>): OfficeApi {
  async function send<T>(method: string, path: string, { query, body }: { query?: Query; body?: unknown }) {
    const url = new URL(`http://telegram.internal/api${path}`);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
    }
    for (const renew of [false, true]) {
      const res = await callApi(
        new Request(url, {
          method,
          headers: {
            Cookie: `${SESSION_COOKIE}=${await session(renew)}`,
            "User-Agent": "Team Advert Telegram bot",
            ...(body === undefined ? {} : { "Content-Type": "application/json" }),
          },
          body: body === undefined ? undefined : JSON.stringify(body),
        }),
      );
      if (res.status === 401 && !renew) continue;
      const text = await res.text();
      const json = text ? JSON.parse(text) : undefined;
      if (!res.ok) throw new OfficeError(res.status, errorMessage(res.status, json));
      return json as T;
    }
    throw new OfficeError(401, "Office session could not be created");
  }

  return {
    get: (path, query) => send("GET", path, { query }),
    post: (path, body) => send("POST", path, { body: body ?? {} }),
    put: (path, body) => send("PUT", path, { body }),
    patch: (path, body) => send("PATCH", path, { body }),
  };
}
