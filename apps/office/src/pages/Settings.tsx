import { useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import { useAuthStore } from "../store/auth";

interface Role {
  id: number;
  name: string;
}

interface AccessRole {
  id: number;
  code: string;
  label: string;
  description?: string | null;
}

interface UserAccessGrant {
  accessRole: AccessRole;
}

interface ManagedUser {
  id: number;
  username: string;
  role: Role;
  accessGrants: UserAccessGrant[];
}

export default function Settings() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === "Admin";
  const [pinForm, setPinForm] = useState({ currentPin: "", newPin: "" });
  const [pinMessage, setPinMessage] = useState<string | null>(null);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [accessRoles, setAccessRoles] = useState<AccessRole[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [newUser, setNewUser] = useState({ username: "", pin: "", roleId: 0, accessRoleIds: [] as number[] });
  const [loadingUsers, setLoadingUsers] = useState(false);

  const selectedUser = useMemo(() => users.find((u) => u.id === selectedUserId) || null, [users, selectedUserId]);

  const loadAdminData = async () => {
    if (!isAdmin) return;
    setLoadingUsers(true);
    try {
      const [usersRes, rolesRes, accessRes] = await Promise.all([
        api.get("/users"),
        api.get("/users/roles"),
        api.get("/users/access-roles"),
      ]);
      setUsers(usersRes.data);
      setRoles(rolesRes.data);
      setAccessRoles(accessRes.data);
      if (!selectedUserId && usersRes.data.length) {
        setSelectedUserId(usersRes.data[0].id);
      }
      setNewUser((prev) => ({ ...prev, roleId: rolesRes.data[0]?.id ?? 0 }));
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    loadAdminData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const changePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinMessage(null);
    try {
      await api.post("/auth/change-pin", pinForm);
      setPinForm({ currentPin: "", newPin: "" });
      setPinMessage("PIN updated successfully.");
    } catch (err: any) {
      setPinMessage(err?.response?.data?.message || "Failed to change PIN");
    }
  };

  const grantAccess = async (userId: number, accessRoleIds: number[]) => {
    await api.put(`/users/${userId}/access`, { accessRoleIds });
    loadAdminData();
  };

  const updateUserRole = async (userId: number, roleId: number) => {
    await api.patch(`/users/${userId}/role`, { roleId });
    loadAdminData();
  };

  const handleAccessToggle = (accessRoleId: number, checked: boolean) => {
    if (!selectedUser) return;
    const current = selectedUser.accessGrants.map((grant) => grant.accessRole.id);
    const updated = checked ? Array.from(new Set([...current, accessRoleId])) : current.filter((id) => id !== accessRoleId);
    grantAccess(selectedUser.id, updated);
  };

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.username || newUser.pin.length !== 4 || !newUser.roleId) {
      setPinMessage("Please provide username, 4-digit PIN, and role");
      return;
    }
    setCreating(true);
    try {
      await api.post("/users", newUser);
      setNewUser({ username: "", pin: "", roleId: roles[0]?.id ?? 0, accessRoleIds: [] });
      loadAdminData();
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const toggleNewUserAccess = (accessRoleId: number, checked: boolean) => {
    setNewUser((prev) => {
      const set = new Set(prev.accessRoleIds);
      if (checked) set.add(accessRoleId);
      else set.delete(accessRoleId);
      return { ...prev, accessRoleIds: Array.from(set) };
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-slate-500">Manage your account and, if you are an admin, manage access for the team.</p>
      </div>

      <div className="card max-w-lg">
        <h3 className="mb-2 text-lg font-semibold">Change PIN</h3>
        <form className="space-y-3" onSubmit={changePin}>
          <input
            className="input"
            placeholder="Current PIN"
            type="password"
            value={pinForm.currentPin}
            onChange={(e) => setPinForm({ ...pinForm, currentPin: e.target.value })}
          />
          <input
            className="input"
            placeholder="New PIN"
            type="password"
            value={pinForm.newPin}
            onChange={(e) => setPinForm({ ...pinForm, newPin: e.target.value })}
          />
          <button className="btn" type="submit">Update PIN</button>
          {pinMessage && <p className="text-sm text-slate-500">{pinMessage}</p>}
        </form>
      </div>

      {isAdmin && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Users</h3>
              {loadingUsers && <span className="text-xs text-slate-500">Loading...</span>}
            </div>
            <div className="space-y-2">
              {users.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setSelectedUserId(u.id)}
                  className={`w-full rounded-md border px-3 py-2 text-left text-sm transition ${
                    selectedUserId === u.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-slate-200 hover:border-primary/40 dark:border-slate-800"
                  }`}
                >
                  <div className="font-semibold">{u.username}</div>
                  <div className="text-xs text-slate-500">Role: {u.role.name}</div>
                </button>
              ))}
              {users.length === 0 && <p className="text-sm text-slate-500">No users yet.</p>}
            </div>

            <div className="mt-6 border-t border-slate-100 pt-4 dark:border-slate-800">
              <h4 className="mb-2 font-semibold">Create new user</h4>
              <form className="space-y-2" onSubmit={createUser}>
                <input className="input" placeholder="Username" value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} />
                <input className="input" type="password" placeholder="PIN (4 digits)" value={newUser.pin} onChange={(e) => setNewUser({ ...newUser, pin: e.target.value })} />
                <select className="input" value={newUser.roleId} onChange={(e) => setNewUser({ ...newUser, roleId: Number(e.target.value) })}>
                  <option value={0}>Select role</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
                <div className="rounded-lg border border-dashed border-slate-300 p-3 text-xs dark:border-slate-700">
                  <p className="mb-2 font-semibold">Access list</p>
                  <div className="grid gap-2 md:grid-cols-2">
                    {accessRoles.map((access) => (
                      <label key={access.id} className="flex cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          checked={newUser.accessRoleIds.includes(access.id)}
                          onChange={(e) => toggleNewUserAccess(access.id, e.target.checked)}
                        />
                        <span>
                          <span className="font-semibold">{access.label}</span>
                          <span className="block text-[11px] text-slate-500">{access.description}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                <button className="btn w-full" type="submit" disabled={creating}>
                  {creating ? "Creating..." : "Create User"}
                </button>
              </form>
            </div>
          </div>

          <div className="card">
            <h3 className="mb-3 text-lg font-semibold">Access management</h3>
            {selectedUser ? (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-semibold text-slate-600">Role</p>
                  <select className="input" value={selectedUser.role.id} onChange={(e) => updateUserRole(selectedUser.id, Number(e.target.value))}>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-600">Access list</p>
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    {accessRoles.map((access) => {
                      const checked = selectedUser.accessGrants.some((grant) => grant.accessRole.id === access.id);
                      return (
                        <label key={access.id} className="flex cursor-pointer items-start gap-2 rounded-md border border-slate-200 p-3 text-sm dark:border-slate-700">
                          <input type="checkbox" checked={checked} onChange={(e) => handleAccessToggle(access.id, e.target.checked)} />
                          <span>
                            <span className="font-semibold">{access.label}</span>
                            <span className="block text-xs text-slate-500">{access.description}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Select a user to manage access.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
