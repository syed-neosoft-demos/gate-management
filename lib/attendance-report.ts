import { Employee, LogEntry } from "@/lib/types";

export type AttendanceDay = {
  date: string;
  milliseconds: number;
  firstIn?: number;
  lastOut?: number;
  visits: number;
  active: boolean;
  issues: string[];
  entries: LogEntry[];
};
export type PersonAttendance = {
  id: string; name: string; extId: string; dept: string; photo: string; registered: boolean;
  days: AttendanceDay[]; milliseconds: number; daysPresent: number; issues: number; active: boolean;
};
const formatters = new Map<string, Intl.DateTimeFormat>();
export function attendanceDate(timestamp: number, timeZone: string): string {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
    formatters.set(timeZone, formatter);
  }
  const parts = formatter.formatToParts(timestamp);
  const part = (type: string) => parts.find((item) => item.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
function nextDate(date: string): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}
/** Find the first instant of a local day, including DST transitions. */
export function attendanceDayStart(date: string, timeZone: string): number {
  const utc = Date.parse(`${date}T00:00:00Z`);
  let low = utc - 36 * 3600000;
  let high = utc + 36 * 3600000;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (attendanceDate(middle, timeZone) < date) low = middle + 1;
    else high = middle;
  }
  return low;
}
export function formatWorkDuration(milliseconds: number): string {
  const minutes = Math.floor(milliseconds / 60000);
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
}
export function attendanceMonthReport(employees: Employee[], logs: LogEntry[], month: string, timeZone: string, now = Date.now()) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Invalid report month");
  const [year, monthNumber] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const dates = Array.from({ length: daysInMonth }, (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`);
  const boundaries = dates.map((date) => attendanceDayStart(date, timeZone));
  boundaries.push(attendanceDayStart(nextDate(dates[dates.length - 1]), timeZone));
  const start = boundaries[0];
  const end = boundaries[boundaries.length - 1];
  const today = attendanceDate(now, timeZone);
  const ordered = logs.filter((entry) => entry.ts <= now).slice().sort((a, b) => a.ts - b.ts || a.id.localeCompare(b.id));
  const people = new Map<string, { id: string; name: string; extId: string; dept: string; photo: string; registered: boolean }>();
  employees.forEach((employee) => people.set(employee.id, { ...employee, registered: true }));
  for (const entry of ordered) {
    if (!people.has(entry.empId)) people.set(entry.empId, { id: entry.empId, name: entry.name, extId: entry.extId || "", dept: "Former employee", photo: "", registered: false });
  }
  const grouped = new Map<string, LogEntry[]>();
  for (const entry of ordered) {
    if (!grouped.has(entry.empId)) grouped.set(entry.empId, []);
    grouped.get(entry.empId)!.push(entry);
  }
  const reports: PersonAttendance[] = [...people.values()].map((person) => {
    const days = dates.map((date): AttendanceDay => ({ date, milliseconds: 0, visits: 0, active: false, issues: [], entries: [] }));
    const byDate = new Map(days.map((day) => [day.date, day]));
    const addInterval = (from: number, to: number, active: boolean) => {
      const clippedStart = Math.max(from, start);
      const clippedEnd = Math.min(to, end, now);
      if (clippedStart >= clippedEnd) return;
      for (let index = 0; index < days.length; index++) {
        const segmentStart = Math.max(clippedStart, boundaries[index]);
        const segmentEnd = Math.min(clippedEnd, boundaries[index + 1]);
        if (segmentStart >= segmentEnd) continue;
        const day = days[index];
        day.milliseconds += segmentEnd - segmentStart;
        day.firstIn = Math.min(day.firstIn ?? segmentStart, segmentStart);
        if (!active) day.lastOut = Math.max(day.lastOut ?? segmentEnd, segmentEnd);
        day.active ||= active;
      }
    };
    let pending: LogEntry | undefined;
    for (const entry of grouped.get(person.id) || []) {
      const day = byDate.get(attendanceDate(entry.ts, timeZone));
      if (day) {
        day.entries.push(entry);
        if (entry.type === "IN") { day.firstIn = Math.min(day.firstIn ?? entry.ts, entry.ts); }
        else day.lastOut = Math.max(day.lastOut ?? entry.ts, entry.ts);
      }
      if (entry.type === "IN") {
        if (pending) day?.issues.push("Repeated check-in before a check-out");
        else { pending = entry; if (day) day.visits++; }
      } else if (pending) {
        addInterval(pending.ts, entry.ts, false);
        if (entry.ts - pending.ts > 24 * 3600000) byDate.get(attendanceDate(pending.ts, timeZone))?.issues.push("Visit longer than 24 hours; verify check-out");
        pending = undefined;
      } else day?.issues.push("Check-out without a matching check-in");
    }
    if (pending) {
      const day = byDate.get(attendanceDate(pending.ts, timeZone));
      if (attendanceDate(pending.ts, timeZone) === today) {
        addInterval(pending.ts, now, true);
        if (day) day.active = true;
      } else day?.issues.push("Missing check-out; hours not counted");
    }
    return {
      ...person, days, milliseconds: days.reduce((sum, day) => sum + day.milliseconds, 0),
      daysPresent: days.filter((day) => day.entries.length > 0 || day.milliseconds > 0).length,
      issues: days.reduce((sum, day) => sum + day.issues.length, 0), active: days.some((day) => day.active),
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
  return {
    people: reports,
    daily: dates.map((date, index) => ({ date, milliseconds: reports.reduce((sum, person) => sum + person.days[index].milliseconds, 0), people: reports.filter((person) => person.days[index].entries.length > 0 || person.days[index].milliseconds > 0).length })),
    milliseconds: reports.reduce((sum, person) => sum + person.milliseconds, 0),
    personDays: reports.reduce((sum, person) => sum + person.daysPresent, 0),
    issues: reports.reduce((sum, person) => sum + person.issues, 0),
    presentPeople: reports.filter((person) => person.daysPresent > 0).length,
  };
}
