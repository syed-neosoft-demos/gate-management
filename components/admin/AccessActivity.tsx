"use client";

import { useState } from "react";
import { AdminAudit } from "@/lib/admin-types";

const input =
  "mt-1.5 bg-panel-2 px-3 py-2.5 border border-line focus:border-scan rounded-lg outline-none w-full text-ink text-sm";
const roleLabel = (role: string) =>
  role === "superadmin"
    ? "Super admin"
    : role === "admin"
      ? "Admin"
      : "Anonymous";

export default function AccessActivity({
  events,
  loading,
  timeZone,
  onRefresh,
}: {
  events: AdminAudit[];
  loading: boolean;
  timeZone: string;
  onRefresh: () => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [page, setPage] = useState(1);
  const visibleEvents = events
    .filter(
      (event) =>
        (roleFilter === "all" || event.role === roleFilter) &&
        `${event.actor} ${event.target || ""} ${event.action.replace(/_/g, " ")} ${event.ip}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) => b.ts - a.ts);
  const pageCount = Math.max(1, Math.ceil(visibleEvents.length / 15));
  const currentPage = Math.min(page, pageCount);
  const pageEvents = visibleEvents.slice(
    (currentPage - 1) * 15,
    currentPage * 15,
  );
  const stamp = (ts: number) =>
    new Intl.DateTimeFormat("en", {
      timeZone,
      dateStyle: "medium",
      timeStyle: "short",
    }).format(ts);
  return (
    <div>
      <div className="flex flex-wrap justify-between gap-3 items-center mb-3">
        <h3 className="font-semibold text-sm">Access activity</h3>
        <button
          disabled={loading}
          onClick={() => {
            void onRefresh();
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
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
        <select
          aria-label="Filter access logs by role"
          className={`${input} sm:max-w-[180px]`}
          value={roleFilter}
          onChange={(event) => {
            setRoleFilter(event.target.value);
            setPage(1);
          }}
        >
          <option value="all">All roles</option>
          <option value="admin">Admin</option>
          <option value="superadmin">Super admin</option>
          <option value="anonymous">Anonymous / failed login</option>
        </select>
      </div>
      <p className="text-xs text-ink-dim mb-3">
        {visibleEvents.length} events · newest first · latest 2,000 events
        retained · {timeZone}
      </p>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-panel">
            <tr>
              {["Time", "Account / role", "Action", "Result", "Source"].map(
                (heading) => (
                  <th
                    key={heading}
                    className="border-b border-line p-3 text-ink-dim text-left"
                  >
                    {heading}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {pageEvents.map((event) => (
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
                  {event.target && (
                    <p className="mt-1 break-all text-ink-dim">
                      Target: {event.target}
                    </p>
                  )}
                </td>
                <td
                  className={`border-b border-line p-3 ${event.outcome === "success" ? "text-in" : "text-danger"}`}
                >
                  {event.outcome}
                </td>
                <td className="border-b border-line p-3">
                  <details>
                    <summary className="cursor-pointer text-ink-dim">
                      Source details
                    </summary>
                    <p className="mt-2">{event.ip}</p>
                    <p className="mt-1 max-w-[240px] break-words text-ink-dim">
                      {event.userAgent || "Browser unavailable"}
                    </p>
                  </details>
                </td>
              </tr>
            ))}
            {!visibleEvents.length && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-ink-dim">
                  {loading
                    ? "Loading access events…"
                    : "No matching access events."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 text-xs text-ink-dim">
        <span>
          Page {currentPage} of {pageCount} · 15 events per page
        </span>
        <div className="flex gap-2">
          <button
            className="rounded-lg border border-line px-3 py-2 disabled:opacity-40"
            disabled={currentPage === 1}
            onClick={() => setPage(currentPage - 1)}
          >
            Previous
          </button>
          <button
            className="rounded-lg border border-line px-3 py-2 disabled:opacity-40"
            disabled={currentPage === pageCount}
            onClick={() => setPage(currentPage + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
