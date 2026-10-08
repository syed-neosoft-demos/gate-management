"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminAudit, AdminRole, AdminUser } from "@/lib/admin-types";
import { adminRequest, PasswordResult } from "@/lib/admin-client";
import AccessActivity from "@/components/admin/AccessActivity";
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
  const [section, setSection] = useState<"accounts" | "password" | "activity">(
    superadmin ? "accounts" : "password",
  );
  const [editor, setEditor] = useState<"create" | "reset" | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
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
  const load = useCallback(async () => {
    if (!superadmin || section === "password") return;
    if (section === "accounts")
      setAccounts(await adminRequest<AdminUser[]>("accounts"));
    else setEvents(await adminRequest<AdminAudit[]>("audit"));
  }, [superadmin, section]);
  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      await load();
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Could not load access data.",
      );
    } finally {
      setLoading(false);
    }
  }, [load]);
  useEffect(() => {
    let active = true;
    setLoading(superadmin && section !== "password");
    setLoadError("");
    const fetchSection = async () => {
      try {
        if (!superadmin || section === "password") return;
        if (section === "accounts") {
          const users = await adminRequest<AdminUser[]>("accounts");
          if (active) setAccounts(users);
        } else {
          const logs = await adminRequest<AdminAudit[]>("audit");
          if (active) setEvents(logs);
        }
      } catch (error) {
        if (active)
          setLoadError(
            error instanceof Error
              ? error.message
              : "Could not load access data.",
          );
      } finally {
        if (active) setLoading(false);
      }
    };
    void fetchSection();
    return () => {
      active = false;
    };
  }, [superadmin, section]);
  const openEditor = (next: "create" | "reset" | null, account = "") => {
    setEditor(next);
    setResetUsername(account);
    setResetCurrentPassword("");
    setResetPassword("");
    setCreatePassword("");
    setName("");
    setUsername("");
    setRole("admin");
    setGenerateCreate(true);
    setGenerateReset(true);
    setMessage({ text: "", ok: false });
  };
  const run = async (operation: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setMessage({ text: "", ok: false });
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
      await refresh();
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
      setEditor(null);
      setUsername("");
      setName("");
      setCreatePassword("");
      setMessage({
        text: "Account created. The new user must change their temporary password on first sign-in.",
        ok: true,
      });
      await refresh();
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
      setEditor(null);
      setResetPassword("");
      setResetCurrentPassword("");
      setMessage({
        text: "Password reset. Existing sessions were revoked; the user must change their temporary password.",
        ok: true,
      });
      await refresh();
    });
  const stamp = (ts: number) =>
    new Intl.DateTimeFormat("en", {
      timeZone: p.reportTimeZone,
      dateStyle: "medium",
      timeStyle: "short",
    }).format(ts);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Admin access</h1>
        <p className="mt-2 text-sm text-ink-dim">
          {superadmin
            ? "Manage admin accounts, passwords, and sign-in activity."
            : "Manage the password for your admin account."}
        </p>
      </div>
      <nav
        aria-label="Admin access sections"
        className="flex flex-wrap gap-2 border-b border-line pb-4"
      >
        {(superadmin
          ? (["accounts", "password", "activity"] as const)
          : (["password"] as const)
        ).map((item) => (
          <button
            key={item}
            type="button"
            disabled={busy}
            aria-current={section === item ? "page" : undefined}
            onClick={() => {
              setSection(item);
              openEditor(null);
            }}
            className={`rounded-lg px-4 py-2.5 text-sm font-medium disabled:opacity-50 ${section === item ? "bg-scan/10 text-scan" : "text-ink-dim hover:bg-panel-2 hover:text-ink"}`}
          >
            {item === "accounts"
              ? "Accounts"
              : item === "password"
                ? "My password"
                : "Activity"}
          </button>
        ))}
      </nav>
      {loadError && (
        <div
          role="alert"
          className="rounded-lg border border-danger/30 p-3 text-sm text-danger"
        >
          {loadError}{" "}
          <button
            onClick={() => void refresh()}
            disabled={loading}
            className="ml-3 underline"
          >
            Retry
          </button>
        </div>
      )}
      {message.text && (
        <p
          role="status"
          className={`text-sm ${message.ok ? "text-in" : "text-danger"}`}
        >
          {message.text}
        </p>
      )}
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
                void navigator.clipboard.writeText(issued.password).catch(() =>
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
      {section === "password" && (
        <form
          className="max-w-2xl rounded-xl border border-line p-5"
          onSubmit={(event) => {
            event.preventDefault();
            void changeOwn();
          }}
        >
          <h2 className="font-semibold mb-2">Change your password</h2>
          <p className="mb-5 text-sm text-ink-dim">
            Signed in as {p.adminUser.username}. Changing your password signs
            out your other sessions.
          </p>
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
      )}
      {superadmin && (
        <>
          {section === "accounts" && (
            <section className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold">
                    Admin accounts{" "}
                    <span className="ml-2 text-sm font-normal text-ink-dim">
                      {accounts.length}
                    </span>
                  </h2>
                  <p className="mt-1 text-xs text-ink-dim">
                    Admins manage employees and attendance. Super admins also
                    manage access and settings.
                  </p>
                </div>
                <button
                  disabled={busy || loading}
                  onClick={() => openEditor(editor ? null : "create")}
                  className="rounded-lg bg-scan px-4 py-2.5 text-sm font-semibold text-[#04241d] disabled:opacity-50"
                >
                  {editor ? "Back to accounts" : "+ Add admin"}
                </button>
              </div>
              <div className="max-w-xl">
                {editor === "create" && (
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
                )}
                {editor === "reset" && (
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
                      <div className="rounded-lg bg-panel-2 p-3 text-sm">
                        <span className="text-ink-dim">Account</span>
                        <p className="mt-1 font-medium">{resetUsername}</p>
                      </div>
                      <p className="text-sm text-ink-dim">
                        This will sign out all sessions for this account. They
                        must change the temporary password at their next
                        sign-in.
                      </p>
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
                          onChange={(event) =>
                            setGenerateReset(event.target.checked)
                          }
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
                            onChange={(event) =>
                              setResetPassword(event.target.value)
                            }
                          />
                        </label>
                      )}
                    </div>
                    <p className="text-xs text-ink-dim mt-4">
                      Use “My password” to update your own account.
                    </p>
                    <button
                      disabled={busy || !resetUsername}
                      className={button}
                    >
                      Reset password
                    </button>
                  </form>
                )}
              </div>
              {!editor && (
                <div className="overflow-x-auto rounded-xl border border-line">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        {[
                          "Name / username",
                          "Role",
                          "Last sign-in",
                          "Password status",
                          "Actions",
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
                      {!accounts.length && (
                        <tr>
                          <td
                            colSpan={5}
                            className="p-8 text-center text-sm text-ink-dim"
                          >
                            {loading
                              ? "Loading accounts…"
                              : "No admin accounts found."}
                          </td>
                        </tr>
                      )}
                      {accounts.map((account) => (
                        <tr key={account.username}>
                          <td className="border-b border-line p-3">
                            {account.name}
                            <p className="text-xs text-ink-dim">
                              {account.username}
                            </p>
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
                          <td className="border-b border-line p-3 text-right whitespace-nowrap">
                            <button
                              disabled={busy || loading}
                              className="text-xs text-scan disabled:opacity-50"
                              onClick={() => {
                                if (account.username === p.adminUser.username)
                                  setSection("password");
                                else openEditor("reset", account.username);
                              }}
                            >
                              {account.username === p.adminUser.username
                                ? "My password"
                                : "Reset password"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
          {section === "activity" && (
            <AccessActivity
              events={events}
              loading={loading}
              timeZone={p.reportTimeZone}
              onRefresh={refresh}
            />
          )}
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
