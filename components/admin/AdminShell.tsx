"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAdminContext } from "@/components/admin/AdminProvider";

const navigation = [
  { href: "/admin/attendance", label: "Monthly attendance" },
  { href: "/admin/logs", label: "Attendance logs" },
  { href: "/admin/employees", label: "Employees" },
  { href: "/admin/settings", label: "Settings", superadmin: true },
  { href: "/admin/access", label: "Admin access" },
];
export default function AdminShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const p = useAdminContext();
  const pathname = usePathname();
  return (
    <div className="h-screen flex flex-col bg-bg">
      <header className="flex flex-wrap flex-shrink-0 items-center justify-between gap-3 px-5 sm:px-8 py-5 border-b border-line bg-panel">
        <div>
          <Link
            href="/admin/attendance"
            className="font-display font-bold text-xl"
          >
            {p.settingsOrgName || "FaceGate"} · Admin
          </Link>
          <p className="text-xs text-ink-dim mt-1">
            {p.adminUser.name} ·{" "}
            {p.adminUser.role === "superadmin" ? "Super admin" : "Admin"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/" className="text-xs text-ink-dim hover:text-scan">
            Employee kiosk ↗
          </Link>
          <button
            disabled={p.adminRefreshing}
            onClick={() => {
              void p.refreshAdmin();
            }}
            className="text-xs text-scan border border-line px-3 py-2 rounded-lg disabled:opacity-50"
          >
            {p.adminRefreshing ? "Refreshing…" : "Refresh data"}
          </button>
          <button
            onClick={() => {
              void p.signOut();
            }}
            className="text-sm text-ink-dim hover:text-ink border border-line px-3 py-2 rounded-lg"
          >
            Sign out
          </button>
        </div>
      </header>
      <nav
        aria-label="Admin navigation"
        className="flex flex-shrink-0 gap-5 px-5 sm:px-8 bg-panel border-b border-line overflow-x-auto"
      >
        {navigation
          .filter(
            (item) => !item.superadmin || p.adminUser.role === "superadmin",
          )
          .map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`whitespace-nowrap border-b-2 py-4 text-sm font-semibold ${active ? "border-scan text-ink" : "border-transparent text-ink-dim hover:text-ink"}`}
              >
                {item.label}
              </Link>
            );
          })}
      </nav>
      <main className="flex-1 overflow-y-auto p-5 sm:p-8">
        <div className="mx-auto max-w-[1180px]">
          {p.adminRefreshError && (
            <p role="alert" className="mb-5 text-sm text-danger">
              {p.adminRefreshError}
            </p>
          )}
          {p.adminLoading ? (
            <p className="text-ink-dim text-sm">Loading admin data…</p>
          ) : (
            children
          )}
        </div>
      </main>
    </div>
  );
}
