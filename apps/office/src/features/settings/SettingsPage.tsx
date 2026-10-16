import { useState, type ChangeEvent, type FormEvent } from "react";
import { DatabaseBackup, KeyRound, Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useChangePin } from "../../auth/hooks";
import { useCan } from "../../auth/permissions";
import { useSession } from "../../auth/session";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import { DataList } from "../../components/ui/DataList";
import { Badge, Card, CardHeader, EmptyState } from "../../components/ui/display";
import { Checkbox, Field, FormError, Input, Select } from "../../components/ui/form";
import { FilterTabs, PageHeader } from "../../components/ui/page";
import { errorMessage } from "../../lib/api";
import { dateTime } from "../../lib/format";
import {
  useAccessRoles,
  useBackups,
  useCreateUser,
  useResetUserPin,
  useRoles,
  useRunBackup,
  useSetUserAccess,
  useSetUserRole,
  useSetUserStatus,
  useUsers,
} from "../../lib/queries";
import type { ManagedUser } from "../../lib/types";

const pinInput = (value: string, set: (v: string) => void) => ({
  type: "password",
  inputMode: "numeric" as const,
  maxLength: 4,
  value,
  onChange: (e: ChangeEvent<HTMLInputElement>) => set(e.target.value.replace(/\D/g, "")),
  className: "tracking-[0.4em]",
});

function ChangePin() {
  const change = useChangePin();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (next.length !== 4) return setProblem("The new PIN must be 4 digits.");
    if (next !== confirm) return setProblem("The new PINs don't match.");
    setProblem(null);
    change.mutate(
      { currentPin: current, newPin: next },
      {
        onSuccess: () => {
          toast.success("PIN changed. Other devices were signed out.");
          setCurrent("");
          setNext("");
          setConfirm("");
        },
      },
    );
  };
  return (
    <Card>
      <CardHeader title="Change your PIN" description="Changing it signs you out on your other devices." />
      <form onSubmit={submit} className="grid gap-3 p-4 sm:grid-cols-3 md:p-5" noValidate>
        <div className="sm:col-span-3"><FormError message={change.error ? errorMessage(change.error) : problem} /></div>
        <Field label="Current PIN">{(p) => <Input {...p} {...pinInput(current, setCurrent)} autoComplete="current-password" />}</Field>
        <Field label="New PIN">{(p) => <Input {...p} {...pinInput(next, setNext)} autoComplete="new-password" />}</Field>
        <Field label="Repeat new PIN">{(p) => <Input {...p} {...pinInput(confirm, setConfirm)} autoComplete="new-password" />}</Field>
        <div className="sm:col-span-3"><Button type="submit" icon={KeyRound} loading={change.isPending} disabled={current.length !== 4}>Change PIN</Button></div>
      </form>
    </Card>
  );
}

function UserDialog({ user, open, onClose }: { user?: ManagedUser; open: boolean; onClose: () => void }) {
  const me = useSession((s) => s.user);
  const roles = useRoles();
  const access = useAccessRoles();
  const create = useCreateUser();
  const setRole = useSetUserRole();
  const setAccess = useSetUserAccess();
  const resetPin = useResetUserPin();
  const setStatus = useSetUserStatus();
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [roleId, setRoleId] = useState(String(user?.roleId ?? ""));
  const [granted, setGranted] = useState<number[]>(user ? user.accessGrants.map((g) => g.accessRoleId) : []);
  const [problem, setProblem] = useState<string | null>(null);
  const error = create.error ?? setRole.error ?? setAccess.error ?? resetPin.error ?? setStatus.error;
  const self = user?.id === me?.id;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) {
      if (username.trim().length < 3) return setProblem("Usernames need at least 3 characters.");
      if (pin.length !== 4) return setProblem("Set a 4-digit PIN.");
      if (!roleId) return setProblem("Choose a role.");
    } else if (pin && pin.length !== 4) {
      return setProblem("A reset PIN must be 4 digits.");
    }
    setProblem(null);
    try {
      if (!user) {
        await create.mutateAsync({ username: username.trim(), pin, roleId: Number(roleId), accessRoleIds: granted });
        toast.success(`User ${username.trim()} created`);
      } else {
        if (Number(roleId) !== user.roleId) await setRole.mutateAsync({ id: user.id, roleId: Number(roleId) });
        await setAccess.mutateAsync({ id: user.id, accessRoleIds: granted });
        if (pin) await resetPin.mutateAsync({ id: user.id, pin });
        toast.success("User updated");
      }
      onClose();
    } catch {
      /* shown via `error` */
    }
  };

  const toggleStatus = () =>
    user &&
    setStatus.mutate(
      { id: user.id, isActive: !user.isActive },
      {
        onSuccess: () => {
          toast.success(user.isActive ? "User deactivated" : "User activated");
          onClose();
        },
      },
    );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={user ? user.username : "New user"}
      description={user ? `Last login ${dateTime(user.lastLoginAt)}` : "Leave all sections unticked to give access to everything."}
      footer={
        <>
          {user && !self && (
            <Button variant={user.isActive ? "danger" : "success"} className="mr-auto" loading={setStatus.isPending} onClick={toggleStatus}>
              {user.isActive ? "Deactivate" : "Activate"}
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="user-form" loading={create.isPending || setRole.isPending || setAccess.isPending || resetPin.isPending}>Save</Button>
        </>
      }
    >
      <form id="user-form" onSubmit={save} className="space-y-4" noValidate>
        <FormError message={error ? errorMessage(error) : problem} />
        <div className="grid gap-3 sm:grid-cols-3">
          {!user && <Field label="Username" required>{(p) => <Input {...p} value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" />}</Field>}
          <Field label={user ? "Reset PIN" : "PIN"} required={!user} hint={user ? "Leave empty to keep it. Also unlocks the account." : undefined}>
            {(p) => <Input {...p} {...pinInput(pin, setPin)} autoComplete="new-password" />}
          </Field>
          <Field label="Role" required hint={self ? "You can't change your own role." : undefined}>
            {(p) => (
              <Select {...p} value={roleId} onChange={(e) => setRoleId(e.target.value)} disabled={self}>
                <option value="">Choose…</option>
                {(roles.data ?? []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </Select>
            )}
          </Field>
        </div>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Sections they can open</legend>
          <div className="grid grid-cols-2 gap-x-4 sm:grid-cols-3">
            {(access.data ?? []).map((a) => (
              <Checkbox key={a.id} label={a.label} checked={granted.includes(a.id)} onChange={(e) => setGranted(e.target.checked ? [...granted, a.id] : granted.filter((id) => id !== a.id))} />
            ))}
          </div>
        </fieldset>
      </form>
    </Dialog>
  );
}

function UsersPanel() {
  const { data, isLoading, error } = useUsers();
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [creating, setCreating] = useState(false);
  const locked = (u: ManagedUser) => !!u.lockedUntil && new Date(u.lockedUntil) > new Date();
  return (
    <Card>
      <CardHeader title="Team members" description="Roles decide what people can do; sections decide what they see." action={<Button size="sm" icon={Plus} onClick={() => setCreating(true)}>Add user</Button>} />
      <DataList
        rows={data}
        loading={isLoading}
        error={error ? errorMessage(error) : null}
        rowKey={(u) => u.id}
        onRowClick={setEditing}
        columns={[
          { key: "u", header: "User", cell: (u) => <span className="font-medium">{u.username}</span> },
          { key: "r", header: "Role", cell: (u) => <Badge tone="blue">{u.role.name}</Badge> },
          { key: "a", header: "Sections", cell: (u) => `${u.accessGrants.length}` },
          { key: "l", header: "Last login", cell: (u) => dateTime(u.lastLoginAt) },
          { key: "s", header: "Status", cell: (u) => (!u.isActive ? <Badge tone="red">Inactive</Badge> : locked(u) ? <Badge tone="yellow">Locked</Badge> : <Badge tone="green">Active</Badge>) },
        ]}
        card={(u) => (
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{u.username}</p>
              <p className="text-xs text-ink-subtle">Last login {dateTime(u.lastLoginAt)}</p>
            </div>
            <div className="flex gap-1.5">
              <Badge tone="blue">{u.role.name}</Badge>
              {!u.isActive && <Badge tone="red">Inactive</Badge>}
              {u.isActive && locked(u) && <Badge tone="yellow">Locked</Badge>}
            </div>
          </div>
        )}
      />
      <UserDialog key={editing?.id ?? "none"} user={editing ?? undefined} open={!!editing} onClose={() => setEditing(null)} />
      <UserDialog key={creating ? "new" : "closed"} open={creating} onClose={() => setCreating(false)} />
    </Card>
  );
}

function BackupsPanel() {
  const { data, isLoading } = useBackups(true);
  const run = useRunBackup();
  return (
    <Card>
      <CardHeader
        title="Backups"
        description="A full copy of the database. Runs weekly automatically; run one now before big changes."
        action={
          <Button size="sm" icon={DatabaseBackup} loading={run.isPending} onClick={() => run.mutate(undefined, { onSuccess: (r) => toast.success(r.message), onError: (err) => toast.error(errorMessage(err)) })}>
            Back up now
          </Button>
        }
      />
      <DataList
        rows={data}
        loading={isLoading}
        rowKey={(b) => b.id}
        empty={<EmptyState icon={DatabaseBackup} title="No backups yet" />}
        columns={[
          { key: "d", header: "When", cell: (b) => dateTime(b.createdAt) },
          { key: "s", header: "Status", cell: (b) => <Badge tone={b.status === "ok" ? "green" : "red"}>{b.status}</Badge> },
          { key: "p", header: "File", cell: (b) => <span className="break-all font-mono text-xs text-ink-muted">{b.path.split("/").pop()}</span> },
        ]}
        card={(b) => (
          <div className="flex items-center justify-between">
            <span className="text-sm">{dateTime(b.createdAt)}</span>
            <Badge tone={b.status === "ok" ? "green" : "red"}>{b.status}</Badge>
          </div>
        )}
      />
    </Card>
  );
}

type Tab = "account" | "users" | "backups";

export default function SettingsPage() {
  const can = useCan();
  const user = useSession((s) => s.user);
  const [tab, setTab] = useState<Tab>("account");
  const tabs: { value: Tab; label: string }[] = [{ value: "account", label: "My account" }];
  if (can("users.manage")) tabs.push({ value: "users", label: "Users" });
  if (can("backups.run")) tabs.push({ value: "backups", label: "Backups" });

  return (
    <>
      <PageHeader title="Settings" description={`Signed in as ${user?.username} (${user?.role})`} />
      {tabs.length > 1 && (
        <div className="mb-4">
          <FilterTabs value={tab} onChange={setTab} options={tabs} />
        </div>
      )}
      <div className="space-y-4">
        {tab === "account" && (
          <>
            <ChangePin />
            <Card className="flex items-start gap-3 p-4 md:p-5">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-600" />
              <p className="text-sm text-ink-muted">
                For security you're signed out after 2 hours without activity, and accounts lock for 15 minutes after 5 wrong PINs.
                {can("users.manage") && " As an admin you can unlock someone by resetting their PIN under Users."}
              </p>
            </Card>
          </>
        )}
        {tab === "users" && <UsersPanel />}
        {tab === "backups" && <BackupsPanel />}
      </div>
    </>
  );
}
