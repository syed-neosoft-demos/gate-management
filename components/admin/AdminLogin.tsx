"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminUser } from "@/lib/admin-types";
import {
  adminRequest,
  AdminRequestError,
  PasswordResult,
} from "@/lib/admin-client";

const input =
  "mt-2 bg-panel-2 px-3 py-3 border border-line focus:border-scan rounded-lg outline-none w-full text-ink text-sm";
export default function AdminLogin({
  initialUser,
}: {
  initialUser: AdminUser | null;
}) {
  const router = useRouter();
  const [user, setUser] = useState(initialUser);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const changing = user?.mustChangePassword;
  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      let account: AdminUser;
      if (changing) {
        if (newPassword !== confirmPassword)
          throw new Error("New passwords do not match.");
        const result = await adminRequest<PasswordResult>("password", {
          currentPassword: password,
          password: newPassword,
        });
        account = result.user!;
      } else
        account = (
          await adminRequest<{ user: AdminUser }>("login", {
            username,
            password,
          })
        ).user;
      if (account.mustChangePassword) {
        setUser(account);
        return;
      }
      setPassword("");
      setNewPassword("");
      setConfirmPassword("");
      router.replace("/admin/attendance");
      router.refresh();
    } catch (failure) {
      if (
        failure instanceof AdminRequestError &&
        failure.status === 401 &&
        changing
      )
        setUser(null);
      setError(
        failure instanceof Error ? failure.message : "Could not sign in.",
      );
    } finally {
      setBusy(false);
    }
  };
  const cancel = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await adminRequest("logout", {});
      router.replace("/");
      router.refresh();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Could not sign out.",
      );
      setBusy(false);
    }
  };
  return (
    <main className="h-screen overflow-y-auto flex items-center justify-center p-6">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        className="bg-panel shadow-[0_30px_80px_rgba(0,0,0,0.6)] p-7 border border-line rounded-2xl w-full max-w-[420px]"
      >
        <h1 className="mb-2 font-display font-bold text-2xl">
          {changing ? "Set your password" : "Admin sign-in"}
        </h1>
        <p className="mb-6 text-sm text-ink-dim">
          {changing
            ? `Replace the temporary password for ${user.username} to continue.`
            : "Sign in with your admin or super admin account."}
        </p>
        {!changing && (
          <label className="block mb-4 text-xs text-ink-dim">
            Username
            <input
              autoFocus
              autoComplete="username"
              required
              maxLength={40}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className={input}
            />
          </label>
        )}
        <label className="block mb-4 text-xs text-ink-dim">
          {changing ? "Current temporary password" : "Password"}
          <input
            type="password"
            required
            autoComplete="current-password"
            maxLength={128}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={input}
          />
        </label>
        {changing && (
          <>
            <label className="block mb-4 text-xs text-ink-dim">
              New password (at least 10 characters)
              <input
                type="password"
                required
                minLength={10}
                maxLength={128}
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className={input}
              />
            </label>
            <label className="block mb-4 text-xs text-ink-dim">
              Confirm new password
              <input
                type="password"
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className={input}
              />
            </label>
          </>
        )}
        <p role="alert" className="text-sm text-danger mb-3">
          {error}
        </p>
        <button
          disabled={busy}
          type="submit"
          className="bg-scan disabled:opacity-50 py-3 rounded-lg w-full font-semibold text-[#04241d] text-sm"
        >
          {busy
            ? "Please wait…"
            : changing
              ? "Change password and continue"
              : "Sign in"}
        </button>
        {changing ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              void cancel();
            }}
            className="mt-4 block text-center text-sm text-ink-dim w-full"
          >
            Cancel and return to kiosk
          </button>
        ) : (
          <Link
            href="/"
            className="mt-4 block text-center text-sm text-ink-dim"
          >
            Back to employee kiosk
          </Link>
        )}
      </form>
    </main>
  );
}
