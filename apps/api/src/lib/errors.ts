import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { z } from "zod";

/** Thrown from handlers; app.onError turns it into `{ message, ...extra }` with the given status. */
export class ApiError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    message: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export const badRequest = (message: string, extra?: Record<string, unknown>) => new ApiError(400, message, extra);
export const notFound = (what = "Resource") => new ApiError(404, `${what} not found`);

/** Parses and validates the JSON body, throwing 400 with zod issues on failure (same shape as the legacy API). */
export async function readJson<T extends z.ZodType>(c: Context, schema: T): Promise<z.infer<T>> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw badRequest("Invalid JSON body");
  }
  const result = schema.safeParse(body);
  if (!result.success) throw badRequest("Validation failed", { issues: result.error.issues });
  return result.data;
}

/** Parses a positive integer route param, throwing 400 otherwise. */
export function idParam(c: Context, name = "id"): number {
  const value = Number(c.req.param(name));
  if (!Number.isInteger(value) || value <= 0) throw badRequest(`Invalid ${name}`);
  return value;
}
