// Settings: users, PINs and backups. Messages containing a PIN are deleted from the chat after use.
import { type Command, UsageError } from "../context";
import { b, day, esc, lines } from "../format";
import { InputError } from "../forms";
import { findRole, findUser } from "../lookup";

const PIN = /^\d{4}$/;

export const adminCommands: Command[] = [
  {
    name: "users",
    group: "Settings",
    summary: "Office users and their roles (Admin)",
    async run(ctx) {
      const rows = await ctx.api.get<any[]>("/users");
      await ctx.reply(
        lines(
          b("Office users"),
          ...rows.map(
            (u) =>
              `• ${b(u.username)} — ${esc(u.role.name)}${u.isActive ? "" : " (disabled)"}${u.lastLoginAt ? ` · last login ${day(u.lastLoginAt)}` : ""}\n   ${esc(u.accessGrants.filter((g: any) => g.granted).map((g: any) => g.accessRole.code).join(", "))}`,
          ),
        ),
      );
    },
  },
  {
    name: "newuser",
    group: "Settings",
    summary: "Add an office user (Admin): /newuser sara 1234 Sales",
    usage: "<code>/newuser sara 1234 Sales</code> — username, 4-digit PIN, role (Admin, Finance, Sales, Designer, Production). They get every access area; change it with /setaccess. This message is deleted afterwards because it contains a PIN.",
    async run(ctx) {
      const [username, pin, roleName] = ctx.args.split(/\s+/);
      await ctx.forget();
      if (!username || !pin || !roleName) throw new UsageError();
      if (!PIN.test(pin)) throw new InputError("The PIN must be exactly 4 digits.");
      const role = await findRole(ctx.api, roleName);
      const user = await ctx.api.post("/users", { username, pin, roleId: role.id });
      await ctx.reply(`👤 Office user ${b(user.username)} (${esc(role.name)}) created. Your message with the PIN was deleted.`);
    },
  },
  {
    name: "setrole",
    group: "Settings",
    summary: "Change a user's role (Admin): /setrole sara Finance",
    async run(ctx) {
      const [username, roleName] = ctx.args.split(/\s+/);
      if (!username || !roleName) throw new UsageError();
      const [user, role] = await Promise.all([findUser(ctx.api, username), findRole(ctx.api, roleName)]);
      await ctx.api.patch(`/users/${user.id}/role`, { roleId: role.id });
      await ctx.reply(`${b(user.username)} is now ${b(role.name)}.`);
    },
  },
  {
    name: "setaccess",
    group: "Settings",
    summary: "Choose which office areas a user sees (Admin): /setaccess sara jobs proformas",
    usage:
      "<code>/setaccess sara dashboard proformas jobs customers</code>\nAreas: dashboard, reports, jobs, proformas, customers, suppliers, items, finance, notifications, settings. The list replaces the old one.",
    async run(ctx) {
      const [username, ...codes] = ctx.args.split(/[\s,]+/).filter(Boolean);
      if (!username || !codes.length) throw new UsageError();
      const [user, areas] = await Promise.all([findUser(ctx.api, username), ctx.api.get<any[]>("/users/access-roles")]);
      const ids = codes.map((c) => {
        const area = areas.find((a) => a.code.toLowerCase() === c.toLowerCase());
        if (!area) throw new InputError(`Unknown area "${c}". Areas: ${areas.map((a) => a.code).join(", ")}`);
        return area.id;
      });
      await ctx.api.put(`/users/${user.id}/access`, { accessRoleIds: ids });
      await ctx.reply(`${b(user.username)} can now open: ${esc(codes.join(", "))}.`);
    },
  },
  {
    name: "resetpin",
    group: "Settings",
    summary: "Give a user a new PIN (Admin): /resetpin sara 4321",
    async run(ctx) {
      const [username, pin] = ctx.args.split(/\s+/);
      await ctx.forget();
      if (!username || !pin) throw new UsageError();
      if (!PIN.test(pin)) throw new InputError("The PIN must be exactly 4 digits.");
      const user = await findUser(ctx.api, username);
      await ctx.api.post(`/users/${user.id}/reset-pin`, { pin });
      await ctx.reply(`🔑 New PIN set for ${b(user.username)}; they are logged out everywhere. Your message with the PIN was deleted.`);
    },
  },
  {
    name: "disableuser",
    group: "Settings",
    summary: "Block a user from logging in (Admin): /disableuser sara",
    async run(ctx) {
      if (!ctx.args) throw new UsageError();
      const user = await findUser(ctx.api, ctx.args);
      await ctx.api.patch(`/users/${user.id}/status`, { isActive: false });
      await ctx.reply(`⛔ ${b(user.username)} disabled and logged out.`);
    },
  },
  {
    name: "enableuser",
    group: "Settings",
    summary: "Let a disabled user log in again (Admin): /enableuser sara",
    async run(ctx) {
      if (!ctx.args) throw new UsageError();
      const user = await findUser(ctx.api, ctx.args);
      await ctx.api.patch(`/users/${user.id}/status`, { isActive: true });
      await ctx.reply(`✅ ${b(user.username)} enabled.`);
    },
  },
  {
    name: "changepin",
    group: "Settings",
    summary: "Change your own office PIN: /changepin 1234 5678",
    async run(ctx) {
      const [currentPin, newPin] = ctx.args.split(/\s+/);
      await ctx.forget();
      if (!currentPin || !newPin) throw new UsageError();
      if (!PIN.test(newPin)) throw new InputError("The new PIN must be exactly 4 digits.");
      await ctx.api.post("/auth/change-pin", { currentPin, newPin });
      await ctx.reply("🔑 Your office PIN was changed; other office sessions were logged out. Your message with the PINs was deleted.");
    },
  },
  {
    name: "backup",
    group: "Settings",
    summary: "Back up the database now (Admin)",
    async run(ctx) {
      const result = await ctx.api.post("/backups/run");
      await ctx.reply(`💾 ${esc(result.message)} (${esc(result.backup?.path?.split("/").pop() ?? "")}).`);
    },
  },
  {
    name: "backups",
    group: "Settings",
    summary: "Recent backups (Admin)",
    async run(ctx) {
      const rows = await ctx.api.get<any[]>("/backups");
      if (!rows.length) return ctx.reply("No backups yet. Run one with /backup.");
      await ctx.reply(lines(b("Recent backups"), ...rows.slice(0, 10).map((r) => `• ${day(r.createdAt)} — ${esc(r.status)} · ${esc(String(r.path ?? "").split("/").pop())}`)));
    },
  },
];
