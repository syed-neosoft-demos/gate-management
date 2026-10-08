"use client";

import { useEffect, useState } from "react";
import { AdminAudit, AdminRole, AdminUser } from "@/lib/admin-types";
import { adminRequest, PasswordResult } from "@/lib/admin-client";
import { useAdminContext } from "@/components/admin/AdminProvider";

const input =
  "mt-1.5 bg-panel-2 px-3 py-2.5 border border-line focus:border-scan rounded-lg outline-none w-full text-ink text-sm";
const button =
  "bg-scan disabled:opacity-50 mt-4 px-4 py-2.5 rounded-lg text-[#04241d] font-semibold text-sm";
const roleLabel = (role: string) =>
  role === "superadmin"
    ? "Super admin"
    : role === "admin"
      ? "Admin"
      : "Anonymous";

export default function AdminAccess() {
  const p = useAdminContext();
  const superadmin = p.adminUser?.role === "superadmin";
  const [accounts, setAccounts] = useState<AdminUser[]>([]);
  const [events, setEvents] = useState<AdminAudit[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState({ text: "", ok: false });
  const [issued, setIssued] = useState<{
    username: string;
    password: string;
  } | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [generateOwn, setGenerateOwn] = useState(false);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<AdminRole>("admin");
  const [createPassword, setCreatePassword] = useState("");
  const [generateCreate, setGenerateCreate] = useState(true);
  const [resetUsername, setResetUsername] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetCurrentPassword, setResetCurrentPassword] = useState("");
  const [generateReset, setGenerateReset] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const load = async () => {
    if (!superadmin) return;
    const [users, logs] = await Promise.all([
      adminRequest<AdminUser[]>("accounts"),
      adminRequest<AdminAudit[]>("audit"),
    ]);
    setAccounts(users);
    setEvents(logs);
  };
  useEffect(() => {
    let active = true;
    if (superadmin) {
      setBusy(true);
      void load()
        .catch((error) => {
          if (active) setMessage({ text: error.message, ok: false });
        })
        .finally(() => {
          if (active) setBusy(false);
        });
    }
    return () => {
      active = false;
    };
  }, [superadmin]);
  const run = async (operation: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setMessage({ text: "", ok: false });
    setIssued(null);
    try {
      await operation();
    } catch (error) {
      setMessage({
        text:
          error instanceof Error
            ? error.message
            : "Could not complete the action.",
        ok: false,
      });
    } finally {
      setBusy(false);
    }
  };
  const changeOwn = () =>
    run(async () => {
      if (!generateOwn && newPassword !== confirmPassword)
        throw new Error("New passwords do not match.");
      const result = await adminRequest<PasswordResult>("password", {
        currentPassword,
        password: newPassword,
        generate: generateOwn,
      });
      if (result.user) p.setAdminUser(result.user);
      if (result.generatedPassword)
        setIssued({
          username: p.adminUser!.username,
          password: result.generatedPassword,
        });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage({
        text: "Password changed. All other sessions were signed out.",
        ok: true,
      });
      await load();
    });
  const create = () =>
    run(async () => {
      const result = await adminRequest<PasswordResult>("accounts", {
        username,
        name,
        role,
        password: createPassword,
        generate: generateCreate,
      });
      if (result.generatedPassword)
        setIssued({
          username: result.user!.username,
          password: result.generatedPassword,
        });
      setUsername("");
      setName("");
      setCreatePassword("");
      setMessage({
        text: "Account created. The new user must change their temporary password on first sign-in.",
        ok: true,
      });
      await load();
    });
  const reset = () =>
    run(async () => {
      if (!resetUsername) throw new Error("Select an account.");
      const result = await adminRequest<PasswordResult>("password", {
        username: resetUsername,
        currentPassword: resetCurrentPassword,
        password: resetPassword,
        generate: generateReset,
      });
      if (result.generatedPassword)
        setIssued({
          username: resetUsername,
          password: result.generatedPassword,
        });
      setResetPassword("");
      setResetCurrentPassword("");
      setMessage({
        text: "Password reset. Existing sessions were revoked; the user must change their temporary password.",
        ok: true,
      });
      await load();
    });
  const visibleEvents = events.filter(
    (event) =>
      (roleFilter === "all" || event.role === roleFilter) &&
      `${event.actor} ${event.target || ""} ${event.action} ${event.ip}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const stamp = (ts: number) =>
    new Intl.DateTimeFormat("en", {
      timeZone: p.reportTimeZone,
      dateStyle: "medium",
      timeStyle: "short",
    }).format(ts);
  return (
    <div className="space-y-6">
      <p className="text-sm text-ink-dim">
        Signed in as <span className="text-ink">{p.adminUser?.name}</span> ·{" "}
        {p.adminUser?.username} · {roleLabel(p.adminUser?.role || "admin")}
      </p>
      <p
        role="status"
        className={`text-sm ${message.ok ? "text-in" : "text-danger"}`}
      >
        {message.text}
      </p>
      {issued && (
        <div className="rounded-xl border border-scan/50 bg-scan/5 p-4">
          <p className="font-semibold text-sm mb-2">
            New password for {issued.username}
          </p>
          <p className="text-xs text-ink-dim mb-3">
            Shown once. Save it before leaving this tab, and share it privately
            with the account holder.
          </p>
          <div className="flex flex-wrap gap-3 items-center">
            <code className="font-mono text-scan break-all select-all">
              {issued.password}
            </code>
            <button
              onClick={() => {
                void navigator.clipboard
                  .writeText(issued.password)
                  .catch(() =>
                    setMessage({
                      text: "Could not copy. Select the password and copy it manually.",
                      ok: false,
                    }),
                  );
              }}
              className="text-xs border border-line rounded px-3 py-1.5"
            >
              Copy
            </button>
            <button
              onClick={() => setIssued(null)}
              className="text-xs text-ink-dim"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
      <form
        className="rounded-xl border border-line p-5"
        onSubmit={(event) => {
          event.preventDefault();
          void changeOwn();
        }}
      >
        <h3 className="font-semibold text-sm mb-4">Your password</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="text-xs text-ink-dim">
            Current password
            <input
              type="password"
              required
              maxLength={128}
              autoComplete="current-password"
              className={input}
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </label>
          <div className="flex items-center">
            <label className="text-sm text-ink-dim flex gap-2">
              <input
                type="checkbox"
                checked={generateOwn}
                onChange={(event) => setGenerateOwn(event.target.checked)}
              />
              Generate a secure password
            </label>
          </div>
        </div>
        {!generateOwn && (
          <div className="grid sm:grid-cols-2 gap-4 mt-4">
            <label className="text-xs text-ink-dim">
              New password
              <input
                type="password"
                required
                minLength={10}
                maxLength={128}
                autoComplete="new-password"
                className={input}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </label>
            <label className="text-xs text-ink-dim">
              Confirm new password
              <input
                type="password"
                required
                autoComplete="new-password"
                className={input}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </label>
          </div>
        )}
        <button disabled={busy} className={button}>
          {generateOwn ? "Generate and change password" : "Change password"}
        </button>
      </form>
      {superadmin && (
        <>
          <div className="grid lg:grid-cols-2 gap-4">
            <form
              className="rounded-xl border border-line p-5"
              onSubmit={(event) => {
                event.preventDefault();
                void create();
              }}
            >
              <h3 className="font-semibold text-sm mb-4">
                Create an admin account
              </h3>
              <div className="space-y-3">
                <label className="block text-xs text-ink-dim">
                  Name
                  <input
                    required
                    maxLength={80}
                    className={input}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </label>
                <label className="block text-xs text-ink-dim">
                  Username
                  <input
                    required
                    minLength={3}
                    maxLength={40}
                    pattern="[a-z0-9][a-z0-9._-]{2,39}"
                    autoComplete="off"
                    className={input}
                    value={username}
                    onChange={(event) =>
                      setUsername(event.target.value.toLowerCase())
                    }
                  />
                </label>
                <label className="block text-xs text-ink-dim">
                  Role
                  <select
                    className={input}
                    value={role}
                    onChange={(event) =>
                      setRole(event.target.value as AdminRole)
                    }
                  >
                    <option value="admin">Admin</option>
                    <option value="superadmin">Super admin</option>
                  </select>
                </label>
                <label className="flex gap-2 text-sm text-ink-dim">
                  <input
                    type="checkbox"
                    checked={generateCreate}
                    onChange={(event) =>
                      setGenerateCreate(event.target.checked)
                    }
                  />
                  Generate a temporary password
                </label>
                {!generateCreate && (
                  <label className="block text-xs text-ink-dim">
                    Temporary password
                    <input
                      required
                      type="password"
                      minLength={10}
                      maxLength={128}
                      autoComplete="new-password"
                      className={input}
                      value={createPassword}
                      onChange={(event) =>
                        setCreatePassword(event.target.value)
                      }
                    />
                  </label>
                )}
              </div>
              <button disabled={busy} className={button}>
                Create account
              </button>
            </form>
            <form
              className="rounded-xl border border-line p-5"
              onSubmit={(event) => {
                event.preventDefault();
                if (
                  confirm(
                    `Reset the password for ${resetUsername}? All their current sessions will be revoked.`,
                  )
                )
                  void reset();
              }}
            >
              <h3 className="font-semibold text-sm mb-4">
                Reset an account password
              </h3>
              <div className="space-y-3">
                <label className="block text-xs text-ink-dim">
                  Account
                  <select
                    required
                    className={input}
                    value={resetUsername}
                    onChange={(event) => setResetUsername(event.target.value)}
                  >
                    <option value="">Select an account</option>
                    {accounts
                      .filter(
                        (account) => account.username !== p.adminUser?.username,
                      )
                      .map((account) => (
                        <option key={account.username} value={account.username}>
                          {account.name} · {account.username} ·{" "}
                          {roleLabel(account.role)}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="block text-xs text-ink-dim">
                  Your current password
                  <input
                    type="password"
                    required
                    maxLength={128}
                    autoComplete="current-password"
                    className={input}
                    value={resetCurrentPassword}
                    onChange={(event) =>
                      setResetCurrentPassword(event.target.value)
                    }
                  />
                </label>
                <label className="flex gap-2 text-sm text-ink-dim">
                  <input
                    type="checkbox"
                    checked={generateReset}
                    onChange={(event) => setGenerateReset(event.target.checked)}
                  />
                  Generate a temporary password
                </label>
                {!generateReset && (
                  <label className="block text-xs text-ink-dim">
                    New temporary password
                    <input
                      required
                      type="password"
                      minLength={10}
                      maxLength={128}
                      autoComplete="new-password"
                      className={input}
                      value={resetPassword}
                      onChange={(event) => setResetPassword(event.target.value)}
                    />
                  </label>
                )}
              </div>
              <p className="text-xs text-ink-dim mt-4">
                Use “Your password” to update your own account.
              </p>
              <button disabled={busy || !resetUsername} className={button}>
                Reset password
              </button>
            </form>
          </div>
          <div className="overflow-x-auto">
            <h3 className="font-semibold text-sm mb-3">Admin accounts</h3>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  {[
                    "Name / username",
                    "Role",
                    "Last sign-in",
                    "Password status",
                  ].map((heading) => (
                    <th
                      key={heading}
                      className="border-b border-line p-3 text-xs text-ink-dim text-left"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => (
                  <tr key={account.username}>
                    <td className="border-b border-line p-3">
                      {account.name}
                      <p className="text-xs text-ink-dim">{account.username}</p>
                    </td>
                    <td className="border-b border-line p-3">
                      {roleLabel(account.role)}
                    </td>
                    <td className="border-b border-line p-3 text-xs">
                      {account.lastLoginAt
                        ? stamp(account.lastLoginAt)
                        : "Never"}
                    </td>
                    <td className="border-b border-line p-3 text-xs">
                      {account.mustChangePassword
                        ? "Change required"
                        : "Updated"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <div className="flex flex-wrap justify-between gap-3 items-center mb-3">
              <h3 className="font-semibold text-sm">
                Admin access and activity
              </h3>
              <button
                disabled={busy}
                onClick={() => {
                  void run(load);
                }}
                className="text-scan text-xs disabled:opacity-50"
              >
                Refresh access logs
              </button>
            </div>
            <div className="flex flex-wrap gap-3 mb-3">
              <input
                aria-label="Search access logs"
                placeholder="Search user, action, or IP"
                className={`${input} sm:max-w-[300px]`}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <select
                aria-label="Filter access logs by role"
                className={`${input} sm:max-w-[180px]`}
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value)}
              >
                <option value="all">All roles</option>
                <option value="admin">Admin</option>
                <option value="superadmin">Super admin</option>
                <option value="anonymous">Anonymous / failed login</option>
              </select>
            </div>
            <p className="text-xs text-ink-dim mb-3">
              {visibleEvents.length} events · newest first · latest 2,000 events
              retained · {p.reportTimeZone}
            </p>
            <div className="overflow-auto max-h-[420px]">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-panel">
                  <tr>
                    {[
                      "Time",
                      "Account / role",
                      "Action",
                      "Target",
                      "Result",
                      "Source",
                    ].map((heading) => (
                      <th
                        key={heading}
                        className="border-b border-line p-3 text-ink-dim text-left"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleEvents.map((event) => (
                    <tr key={event.id}>
                      <td className="border-b border-line p-3 whitespace-nowrap">
                        {stamp(event.ts)}
                      </td>
                      <td className="border-b border-line p-3">
                        {event.actor}
                        <span className="block text-ink-dim mt-1">
                          {roleLabel(event.role)}
                        </span>
                      </td>
                      <td className="border-b border-line p-3">
                        {event.action.replace(/_/g, " ")}
                      </td>
                      <td className="border-b border-line p-3 break-all">
                        {event.target || "—"}
                      </td>
                      <td
                        className={`border-b border-line p-3 ${event.outcome === "success" ? "text-in" : "text-danger"}`}
                      >
                        {event.outcome}
                      </td>
                      <td
                        className="border-b border-line p-3"
                        title={event.userAgent}
                      >
                        {event.ip}
                      </td>
                    </tr>
                  ))}
                  {!visibleEvents.length && (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-ink-dim">
                        No matching access events.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
      {!superadmin && (
        <p className="text-xs text-ink-dim">
          Admins can view attendance, manage employees, and change their own
          password. Super admins manage accounts, organization settings, resets,
          and access logs.
        </p>
      )}
    </div>
  );
}
