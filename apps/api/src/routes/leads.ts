import { desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { leadStatusSchema, quoteRequestSchema } from "@teamadvert/shared/schemas";
import { customers, leads, leadStatuses } from "@teamadvert/db";
import { recordAudit } from "../lib/audit";
import { ApiError, badRequest, idParam, notFound, readJson } from "../lib/errors";
import { notify } from "../lib/notify";
import { clientIp } from "../lib/request";
import { requireAuth, requireRole } from "../middleware/auth";
import { ROLES, type AppEnv } from "../types";

/** Public website form. No login; protected by a honeypot field and a per-IP limit. */
export const publicRoutes = new Hono<AppEnv>().post("/quote", async (c) => {
  const { db, quoteLimiter } = c.var;
  const ip = clientIp(c);
  const retryAfter = quoteLimiter.hit(ip ?? "unknown");
  if (retryAfter) {
    c.header("Retry-After", String(retryAfter));
    throw new ApiError(429, "Too many requests. Please call us or try again later.");
  }

  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  // Bots fill every field; pretend success so they don't retry
  if (body && typeof body.website === "string" && body.website.length > 0) return c.json({ ok: true }, 201);

  const parsed = quoteRequestSchema.safeParse(body);
  if (!parsed.success) throw badRequest("Please check the form", { issues: parsed.error.issues });
  const { website: _honeypot, ...input } = parsed.data;

  await db.transaction(async (tx) => {
    const [lead] = await tx
      .insert(leads)
      .values({
        name: input.name,
        phone: input.phone,
        email: input.email || null,
        company: input.company || null,
        service: input.service || null,
        message: input.message,
        ip: ip?.slice(0, 64),
      })
      .returning();
    await notify(tx, "CustomerAlert", `New quote request from ${lead.name}${lead.service ? ` (${lead.service})` : ""}`, { data: { leadId: lead.id } });
  });
  return c.json({ ok: true }, 201);
});

/** Office follow-up of website quote requests. */
export const leadRoutes = new Hono<AppEnv>()
  .use(requireAuth, requireRole(ROLES.Admin, ROLES.Sales))

  .get("/", async (c) => {
    const status = c.req.query("status");
    const where = status && (leadStatuses as readonly string[]).includes(status) ? eq(leads.status, status as (typeof leadStatuses)[number]) : undefined;
    return c.json(await c.var.db.select().from(leads).where(where).orderBy(desc(leads.createdAt)).limit(200));
  })

  .patch("/:id", async (c) => {
    const { db, user } = c.var;
    const id = idParam(c);
    const { status, customerId } = await readJson(c, leadStatusSchema);
    if (customerId) {
      const [customer] = await db.select({ id: customers.id }).from(customers).where(eq(customers.id, customerId));
      if (!customer) throw notFound("Customer");
    }
    const [row] = await db
      .update(leads)
      .set({ status, ...(customerId ? { customerId } : {}) })
      .where(eq(leads.id, id))
      .returning();
    if (!row) throw notFound("Quote request");
    await recordAudit(db, { userId: user.id, entity: "lead", entityId: id, action: status, after: { status, customerId } });
    return c.json(row);
  });
