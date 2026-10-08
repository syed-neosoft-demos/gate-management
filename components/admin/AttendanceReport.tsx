"use client";

import { useEffect, useMemo, useState } from "react";
import { useAdminContext } from "@/components/admin/AdminProvider";
import {
  attendanceDate,
  attendanceMonthReport,
  formatWorkDuration,
} from "@/lib/attendance-report";
import { downloadTextFile } from "@/lib/kiosk-utils";
import { EmployeeAvatar } from "@/components/shared/ui";

const cell = "px-3 py-3 border-b border-line text-left";
const input =
  "bg-panel-2 border border-line focus:border-scan rounded-lg px-3 py-2.5 outline-none text-sm text-ink";
const csv = (rows: unknown[][]) =>
  rows
    .map((row) =>
      row
        .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
        .join(","),
    )
    .join("\n");

export default function AttendanceReport() {
  const p = useAdminContext();
  const [now, setNow] = useState(Date.now());
  const [selectedDay, setSelectedDay] = useState("");
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const report = useMemo(
    () =>
      attendanceMonthReport(
        p.employees,
        p.logs,
        p.reportMonth,
        p.reportTimeZone,
        now,
      ),
    [p.employees, p.logs, p.reportMonth, p.reportTimeZone, now],
  );
  const selected = report.people.find(
    (person) => person.id === p.reportEmployeeId,
  );
  const daily = selected
    ? selected.days.map((day) => ({
        ...day,
        people: day.entries.length || day.milliseconds ? 1 : 0,
      }))
    : report.daily;
  const maxDaily = Math.max(...daily.map((day) => day.milliseconds), 1);
  const ranked = report.people
    .filter((person) => person.daysPresent > 0)
    .slice()
    .sort((a, b) => b.milliseconds - a.milliseconds);
  const maxPerson = Math.max(...ranked.map((person) => person.milliseconds), 1);
  const time = (timestamp?: number, date?: string) =>
    timestamp === undefined
      ? "—"
      : new Intl.DateTimeFormat("en", {
          timeZone: p.reportTimeZone,
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
        }).format(timestamp) +
        (date && attendanceDate(timestamp, p.reportTimeZone) !== date
          ? " (+1 day)"
          : "");
  const focusDay = daily.find((day) => day.date === selectedDay);
  const exportReport = () => {
    const rows: unknown[][] = selected
      ? [
          [
            "Employee",
            "ID",
            "Date",
            "First presence",
            "Last check-out",
            "Hours",
            "Check-ins",
            "Status",
            "Issues",
            "Time zone",
          ],
          ...selected.days.map((day) => [
            selected.name,
            selected.extId,
            day.date,
            time(day.firstIn, day.date),
            time(day.lastOut, day.date),
            (day.milliseconds / 3600000).toFixed(2),
            day.visits,
            day.active
              ? "Checked in (live)"
              : day.entries.length || day.milliseconds
                ? "Recorded"
                : "No records",
            day.issues.join("; "),
            p.reportTimeZone,
          ]),
        ]
      : [
          [
            "Employee",
            "ID",
            "Department",
            "Month",
            "Days with attendance",
            "Total hours",
            "Average hours per attended day",
            "Issues",
            "Time zone",
          ],
          ...report.people.map((person) => [
            person.name,
            person.extId,
            person.dept,
            p.reportMonth,
            person.daysPresent,
            (person.milliseconds / 3600000).toFixed(2),
            person.daysPresent
              ? (person.milliseconds / 3600000 / person.daysPresent).toFixed(2)
              : "0.00",
            person.issues,
            p.reportTimeZone,
          ]),
        ];
    downloadTextFile(
      csv(rows),
      `attendance_${p.reportMonth}_${selected?.id || "everyone"}.csv`,
      "text/csv",
    );
  };
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between gap-3 items-end">
        <div className="flex flex-wrap gap-3">
          <label className="text-xs text-ink-dim">
            Month
            <input
              aria-label="Report month"
              type="month"
              value={p.reportMonth}
              onChange={(event) => {
                if (event.target.value) {
                  p.setReportMonth(event.target.value);
                  setSelectedDay("");
                }
              }}
              className={`${input} block mt-2`}
            />
          </label>
          <label className="text-xs text-ink-dim">
            Employee
            <select
              aria-label="Employee report"
              value={selected?.id || "all"}
              onChange={(event) => {
                p.setReportEmployeeId(event.target.value);
                setSelectedDay("");
              }}
              className={`${input} block mt-2 max-w-[280px]`}
            >
              <option value="all">All employees</option>
              {report.people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                  {person.extId ? ` · ${person.extId}` : ""}
                  {person.registered ? "" : " (former)"}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          onClick={exportReport}
          className="bg-scan px-4 py-3 rounded-lg text-[#04241d] font-semibold text-sm"
        >
          Export monthly CSV
        </button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          [
            "Workplace time",
            formatWorkDuration(selected?.milliseconds ?? report.milliseconds),
          ],
          [
            selected ? "Days with attendance" : "Employees with attendance",
            selected?.daysPresent ?? report.presentPeople,
          ],
          [
            selected ? "Average per attended day" : "Total attendance days",
            selected
              ? formatWorkDuration(
                  selected.daysPresent
                    ? selected.milliseconds / selected.daysPresent
                    : 0,
                )
              : report.personDays,
          ],
          ["Records to review", selected?.issues ?? report.issues],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-xl border border-line bg-panel-2 p-4"
          >
            <p className="text-xs text-ink-dim mb-2">{label}</p>
            <p
              className={`text-2xl font-display font-bold ${label === "Records to review" && Number(value) ? "text-out" : "text-ink"}`}
            >
              {value}
            </p>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-line p-4">
        <div className="flex flex-wrap justify-between gap-2 mb-4">
          <h3 className="font-semibold text-sm">
            {selected
              ? `${selected.name} · daily hours`
              : "Daily workplace hours · all employees"}
          </h3>
          <span className="text-xs text-ink-dim">
            Select a bar to inspect a day
          </span>
        </div>
        <div className="overflow-x-auto">
          <div className="flex items-end gap-1 h-[180px] min-w-[620px] pb-6 relative">
            {daily.map((day) => (
              <button
                key={day.date}
                onClick={() => setSelectedDay(day.date)}
                aria-label={`${day.date}: ${formatWorkDuration(day.milliseconds)}, ${day.people} employees`}
                title={`${day.date}: ${formatWorkDuration(day.milliseconds)}`}
                className="group flex-1 h-full flex flex-col justify-end items-center gap-2 focus:outline-none focus:ring-2 focus:ring-scan rounded"
              >
                <span
                  className={`w-full max-w-[24px] rounded-t transition-colors ${day.date === selectedDay ? "bg-out" : day.milliseconds ? "bg-scan/70 group-hover:bg-scan" : "bg-line"}`}
                  style={{
                    height: Math.max((day.milliseconds / maxDaily) * 140, 2),
                  }}
                />
                <span className="text-[10px] text-ink-dim absolute bottom-0">
                  {Number(day.date.slice(-2))}
                </span>
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-ink-dim mt-3 min-h-4" aria-live="polite">
          {focusDay
            ? `${focusDay.date} · ${formatWorkDuration(focusDay.milliseconds)} · ${focusDay.people} ${focusDay.people === 1 ? "employee" : "employees"} with attendance`
            : `Peak: ${formatWorkDuration(maxDaily === 1 ? 0 : maxDaily)} · ${p.reportTimeZone}`}
        </p>
      </div>
      {!selected && (
        <>
          <div className="rounded-xl border border-line p-4">
            <h3 className="font-semibold text-sm mb-4">Hours by employee</h3>
            {ranked.length === 0 ? (
              <p className="text-sm text-ink-dim">
                No attendance records in this month.
              </p>
            ) : (
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                {ranked.map((person) => (
                  <button
                    key={person.id}
                    onClick={() => p.setReportEmployeeId(person.id)}
                    className="w-full text-left group rounded focus:outline-none focus:ring-2 focus:ring-scan"
                  >
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="group-hover:text-scan">
                        {person.name}
                      </span>
                      <span className="font-mono text-ink-dim">
                        {formatWorkDuration(person.milliseconds)}
                      </span>
                    </div>
                    <div className="h-2 rounded bg-panel-2">
                      <div
                        className="h-2 rounded bg-scan/70 group-hover:bg-scan"
                        style={{
                          width: `${(person.milliseconds / maxPerson) * 100}%`,
                        }}
                      />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="text-left font-semibold mb-3">
                Monthly employee summary
              </caption>
              <thead>
                <tr>
                  {[
                    "Employee",
                    "Days",
                    "Workplace time",
                    "Average / day",
                    "Review",
                    "",
                  ].map((title) => (
                    <th
                      key={title}
                      className={`${cell} text-xs text-ink-dim font-medium`}
                    >
                      {title}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.people.map((person) => (
                  <tr key={person.id} className="hover:bg-panel-2/50">
                    <td className={cell}>
                      <div className="flex items-center gap-2.5">
                        <EmployeeAvatar photo={person.photo} />
                        <div>
                          <p>{person.name}</p>
                          <p className="text-xs text-ink-dim">
                            {person.extId || "No employee ID"} ·{" "}
                            {person.dept || "No department"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className={cell}>{person.daysPresent}</td>
                    <td className={`${cell} font-mono whitespace-nowrap`}>
                      {formatWorkDuration(person.milliseconds)}
                      {person.active && (
                        <span className="block text-xs text-in font-sans">
                          Includes active visit
                        </span>
                      )}
                    </td>
                    <td className={`${cell} whitespace-nowrap`}>
                      {formatWorkDuration(
                        person.daysPresent
                          ? person.milliseconds / person.daysPresent
                          : 0,
                      )}
                    </td>
                    <td
                      className={`${cell} ${person.issues ? "text-out" : "text-ink-dim"}`}
                    >
                      {person.issues || "—"}
                    </td>
                    <td className={cell}>
                      <button
                        onClick={() => p.setReportEmployeeId(person.id)}
                        className="text-scan text-xs font-semibold whitespace-nowrap"
                      >
                        View month →
                      </button>
                    </td>
                  </tr>
                ))}
                {!report.people.length && (
                  <tr>
                    <td
                      colSpan={6}
                      className={`${cell} text-ink-dim text-center`}
                    >
                      Register employees to begin tracking attendance.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
      {selected && (
        <div className="overflow-x-auto">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">
              {selected.name} · daily attendance
            </h3>
            <button
              className="text-scan text-xs"
              onClick={() => p.setReportEmployeeId("all")}
            >
              ← All employees
            </button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr>
                {[
                  "Date",
                  "First presence",
                  "Last check-out",
                  "Time",
                  "Check-ins",
                  "Status / review",
                ].map((title) => (
                  <th
                    key={title}
                    className={`${cell} text-xs text-ink-dim font-medium`}
                  >
                    {title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {selected.days.map((day) => (
                <tr
                  key={day.date}
                  className={day.date === selectedDay ? "bg-panel-2" : ""}
                >
                  <td className={`${cell} whitespace-nowrap`}>{day.date}</td>
                  <td className={`${cell} font-mono`}>
                    {time(day.firstIn, day.date)}
                  </td>
                  <td className={`${cell} font-mono`}>
                    {time(day.lastOut, day.date)}
                  </td>
                  <td className={`${cell} font-mono whitespace-nowrap`}>
                    {formatWorkDuration(day.milliseconds)}
                  </td>
                  <td className={cell}>{day.visits}</td>
                  <td className={cell}>
                    {day.issues.length ? (
                      <div className="text-out text-xs">
                        {day.issues.join("; ")}
                      </div>
                    ) : (
                      <span
                        className={`text-xs ${day.active ? "text-in" : "text-ink-dim"}`}
                      >
                        {day.active
                          ? "Checked in · live"
                          : day.entries.length || day.milliseconds
                            ? "Recorded"
                            : "No records"}
                      </span>
                    )}
                    {day.entries.length > 0 && (
                      <details className="text-xs text-ink-dim mt-1">
                        <summary className="cursor-pointer">
                          {day.entries.length} scans
                        </summary>
                        <p className="mt-1">
                          {day.entries
                            .map((entry) => `${entry.type} ${time(entry.ts)}`)
                            .join(" · ")}
                        </p>
                      </details>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs leading-relaxed text-ink-dim">
        Hours use paired check-ins and check-outs, including multiple visits and
        overnight shifts. Current-day open visits count up to now and update
        every minute. Older missing check-outs contribute no hours. “No records”
        does not imply absence. Days and times use {p.reportTimeZone}.
      </p>
    </div>
  );
}
