// The Telegram bot end to end: webhook security, who may use it, and the office workflow driven by commands
// and buttons. Telegram itself is replaced by a fake client that records what the bot sends.
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { jobOrders, proformas, roles } from "@teamadvert/db";
import { createApp } from "../app";
import { parseTelegramUsers } from "../config";
import { FixedWindowLimiter } from "../lib/rateLimit";
import { type TelegramClient, TelegramError } from "../telegram/client";
import { ACTIONS, COMMANDS } from "../telegram/commands";
import { createHarness, type TestHarness } from "../test/harness";

const SECRET = "test-webhook-secret-123";
const ADMIN_TG = 1001;
const PRODUCTION_TG = 1002;
const STRANGER_TG = 9999;

let h: TestHarness;
let app: ReturnType<typeof createApp>;
let sent: { method: string; params: Record<string, any> }[] = [];
let updateId = 1;

/** Telegram's HTML mode allows only a few tags and rejects the whole message otherwise ("can't parse entities"). */
function invalidHtml(text: string) {
  const tags = [...text.matchAll(/<\/?([a-z]+)(?:\s[^>]*)?>/gi)];
  const unknown = tags.find((t) => !["b", "i", "code", "pre", "a"].includes(t[1].toLowerCase()));
  if (unknown) return `unsupported tag ${unknown[0]}`;
  for (const tag of ["b", "i", "code", "pre", "a"]) {
    const open = tags.filter((t) => t[1] === tag && !t[0].startsWith("</")).length;
    const close = tags.filter((t) => t[1] === tag && t[0].startsWith("</")).length;
    if (open !== close) return `unbalanced <${tag}>`;
  }
  if (/<(?![a-z/])/i.test(text.replace(/<\/?[a-z]+(?:\s[^>]*)?>/gi, ""))) return "stray <";
  return undefined;
}

let rejected: string[] = [];

const fakeTelegram: TelegramClient = {
  async call<T>(method: string, params: Record<string, unknown> = {}) {
    if (method === "sendMessage") {
      const problem = invalidHtml(String(params.text));
      if (problem) {
        rejected.push(`${problem} in: ${String(params.text).slice(0, 120)}`);
        throw new TelegramError(`Telegram sendMessage failed: Bad Request: can't parse entities: ${problem}`);
      }
    }
    sent.push({ method, params: params as Record<string, any> });
    return { message_id: sent.length } as T;
  },
};

beforeAll(async () => {
  h = await createHarness();
  const admin = await h.login();
  const [production] = await h.db.select().from(roles).where(eq(roles.name, "Production"));
  expect((await h.request("POST", "/api/users", { cookie: admin, body: { username: "pete", pin: "1111", roleId: production.id } })).status).toBe(201);

  const config = { ...h.config, telegram: { token: "x", webhookSecret: SECRET, users: parseTelegramUsers(`${ADMIN_TG}:admin, ${PRODUCTION_TG}:pete`) } };
  const limiter = () => new FixedWindowLimiter(1000, 60_000);
  app = createApp({
    db: h.db,
    config,
    loginLimiter: limiter(),
    quoteLimiter: limiter(),
    verifyLimiter: limiter(),
    cbeVerifier: async () => ({ success: true }),
    telegram: fakeTelegram,
  });
});
afterAll(async () => {
  await h.close();
});
beforeEach(() => {
  sent = [];
});

const post = (body: unknown, secret = SECRET) =>
  app.request("/api/telegram/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Telegram-Bot-Api-Secret-Token": secret },
    body: JSON.stringify(body),
  });

/** Sends a text message from a Telegram user and returns the texts the bot replied with. */
async function say(text: string, from = ADMIN_TG, chatType = "private") {
  sent = [];
  const res = await post({ update_id: updateId++, message: { message_id: 50, date: 0, chat: { id: from, type: chatType }, from: { id: from }, text } });
  expect(res.status).toBe(200);
  return replies();
}

/** Presses an inline button. */
async function press(data: string, from = ADMIN_TG) {
  sent = [];
  await post({ update_id: updateId++, callback_query: { id: "cb", from: { id: from }, data, message: { message_id: 51, date: 0, chat: { id: from, type: "private" } } } });
  return replies();
}

const replies = () => sent.filter((s) => s.method === "sendMessage").map((s) => s.params.text as string);
const buttons = () =>
  sent
    .filter((s) => s.method === "sendMessage")
    .flatMap((s) => s.params.reply_markup?.inline_keyboard?.flat() ?? [])
    .map((button: { text: string; callback_data?: string }) => button);

describe("webhook security", () => {
  it("answers 404 without the secret header and runs nothing", async () => {
    const res = await post({ update_id: updateId++, message: { message_id: 1, date: 0, chat: { id: ADMIN_TG, type: "private" }, from: { id: ADMIN_TG }, text: "/start" } }, "wrong");
    expect(res.status).toBe(404);
    expect(sent).toHaveLength(0);
  });

  it("tells strangers it is private (with their Telegram ID) and shows them nothing", async () => {
    const [reply] = await say("/proformas", STRANGER_TG);
    expect(reply).toContain("private office bot");
    expect(reply).toContain(String(STRANGER_TG));
  });

  it("ignores group chats, even from a linked user", async () => {
    expect(await say("/dashboard", ADMIN_TG, "group")).toEqual([]);
  });

  it("never runs the same update twice (Telegram retries slow answers)", async () => {
    const update = { update_id: 5000, message: { message_id: 1, date: 0, chat: { id: ADMIN_TG, type: "private" }, from: { id: ADMIN_TG }, text: "/start" } };
    await post(update);
    await post(update);
    expect(replies()).toHaveLength(1);
  });
});

describe("commands", () => {
  it("greets the linked office user by name and role", async () => {
    const [reply] = await say("/start");
    expect(reply).toContain("<b>admin</b> (Admin)");
  });

  it("shows how to use a command when its form is missing", async () => {
    const [reply] = await say("/newproforma");
    expect(reply).toContain("How to use <b>/newproforma</b>");
    expect(reply).toContain("customer: CID0001");
  });

  it("explains unknown commands and plain text", async () => {
    expect((await say("/nope"))[0]).toContain("Unknown command /nope");
    expect((await say("hello"))[0]).toContain("/help");
  });

  it("has valid, unique command names and short enough button data", () => {
    const names = COMMANDS.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
    for (const c of COMMANDS) {
      expect(c.name).toMatch(/^[a-z0-9_]{1,32}$/);
      expect(c.summary.length).toBeLessThanOrEqual(256);
    }
    expect(new Set(ACTIONS.map((a) => a.prefix)).size).toBe(ACTIONS.length);
  });
});

describe("office workflow through the bot", () => {
  let proformaId: number;
  let jobId: number;

  it("adds a customer", async () => {
    const [reply] = await say("/newcustomer\nname: Abebe Kebede\ncompany: Sunrise Trading\nphone: 0911000000");
    expect(reply).toContain("added as <code>CID0001</code>");
  });

  it("creates a draft proforma with a catalogue item and a typed line", async () => {
    expect((await say("/newitem\nname: Roll-up stand\nselling price: 4,000"))[0]).toContain("ITEM0001");
    const [created, card] = await say("/newproforma\ncustomer: CID0001\nvalidity: 15\nITEM0001 | 2\nFlex banner 3x2m | 1 pcs | 1500 | 100");
    expect(created).toMatch(/Draft proforma <b>TAPI-0001-\d\d<\/b> created/);
    expect(card).toContain("Roll-up stand — 2 × ETB 4,000.00");
    // 8,000 + 1,400 after discount, plus 15% VAT
    expect(card).toContain("Total: ETB 10,810.00");
    const [row] = await h.db.select().from(proformas);
    proformaId = row.id;
    expect(buttons()).toContainEqual({ text: "✅ Approve", callback_data: `pa:${proformaId}` });
  });

  it("approves with the button, then converts the proforma into a job order", async () => {
    expect((await press(`pa:${proformaId}`))[0]).toContain("approved");
    expect(buttons()).toContainEqual({ text: "🔁 Convert to job", callback_data: `pc:${proformaId}` });
    expect((await press(`pc:${proformaId}`))[0]).toMatch(/Job order <b>TAJO-001-\d\d<\/b> created/);
    const [job] = await h.db.select().from(jobOrders);
    jobId = job.id;
    expect(job.status).toBe("pending_approval");
  });

  it("does not let Production approve the job", async () => {
    const [reply] = await press(`ja:${jobId}`, PRODUCTION_TG);
    expect(reply).toContain("Your office role (Production) can't do that");
  });

  it("moves the job through approval and production", async () => {
    await press(`ja:${jobId}`);
    await press(`jm:${jobId}:start`, PRODUCTION_TG);
    const replies = await say(`/jobstatus TAJO-001 done`, PRODUCTION_TG);
    expect(replies[0]).toContain("is now <b>Completed</b>");
  });

  it("records a full cash payment, which closes the completed job", async () => {
    const [reply] = await say("/pay TAJO-001 10,810 cash");
    expect(reply).toContain("Payment #1 of <b>ETB 10,810.00</b> recorded");
    const [job] = await h.db.select().from(jobOrders).where(eq(jobOrders.id, jobId));
    expect(job.status).toBe("closed");
  });

  it("explains bad input instead of guessing", async () => {
    expect((await say("/pay TAJO-001 lots cash"))[0]).toContain("Amount must be a number");
    expect((await say("/newproforma\ncustomer: Nobody Here\nThing | 1 | 10"))[0]).toContain('No customer matches "Nobody Here"');
  });
});

describe("every read-only command, with data in the database", () => {
  const commands = [
    "/start", "/help", "/help newjob", "/me", "/dashboard", "/report 3", "/search sunrise", "/notifications", "/notifications all",
    "/proformas", "/proformas approved", "/proforma TAPI-0001", "/jobs", "/jobs closed", "/job TAJO-001", "/payments", "/payments TAJO-001",
    "/leads", "/customers", "/customer CID0001", "/suppliers", "/items", "/item ITEM0001", "/categories", "/users", "/backups",
  ];

  it.each(commands)("%s answers with valid Telegram HTML", async (text) => {
    rejected = [];
    const replies = await say(text);
    expect(rejected).toEqual([]);
    expect(replies.length).toBeGreaterThan(0);
    expect(replies.join("\n")).not.toContain("Something went wrong");
  });
});

describe("settings", () => {
  it("deletes messages that contain a PIN and checks the PIN format", async () => {
    const replies = await say("/newuser sara 12 Sales");
    expect(sent.some((s) => s.method === "deleteMessage")).toBe(true);
    expect(replies[0]).toContain("PIN must be exactly 4 digits");
    expect((await say("/newuser sara 4321 Sales"))[0]).toContain("Office user <b>sara</b> (Sales) created");
  });
});
