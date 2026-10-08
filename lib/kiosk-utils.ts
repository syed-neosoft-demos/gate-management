import { attendanceDate } from "@/lib/attendance-report";
import { Employee, LogEntry, LogType, isoDate } from "@/lib/types";

export function averageDescriptors(samples: Float32Array[]): number[] {
  if (samples.length === 0) return [];
  const average = new Array(samples[0].length).fill(0);
  samples.forEach((sample) => {
    for (let index = 0; index < sample.length; index++) {
      average[index] += sample[index] / samples.length;
    }
  });
  return average;
}

export function nextAttendanceType(
  logs: LogEntry[],
  employeeId: string,
): LogType {
  const latest = logs
    .filter((entry) => entry.empId === employeeId)
    .sort((a, b) => b.ts - a.ts)[0];
  return latest?.type === "IN" ? "OUT" : "IN";
}

export function attendanceStats(logs: LogEntry[], now = Date.now()) {
  const today = isoDate(now);
  const todayLogs = logs.filter((entry) => isoDate(entry.ts) === today);
  return {
    in: todayLogs.filter((entry) => entry.type === "IN").length,
    out: todayLogs.filter((entry) => entry.type === "OUT").length,
  };
}

export function filterLogs(logs: LogEntry[], date?: string): LogEntry[] {
  const sorted = logs.slice().sort((a, b) => b.ts - a.ts);
  return date ? sorted.filter((entry) => isoDate(entry.ts) === date) : sorted;
}

export function sortEmployees(employees: Employee[]): Employee[] {
  return employees.slice().sort((a, b) => a.name.localeCompare(b.name));
}

export function createAttendanceCsv(
  logs: LogEntry[],
  timeZone?: string,
): string {
  const rows = [
    ["Name", "ID", "Type", "Date", "Time", "Timestamp"],
    ...logs.map((entry) => [
      entry.name,
      entry.extId || "",
      entry.type,
      timeZone ? attendanceDate(entry.ts, timeZone) : isoDate(entry.ts),
      new Date(entry.ts).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZone,
      }),
      new Date(entry.ts).toISOString(),
    ]),
  ];
  return rows
    .map((row) =>
      row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","),
    )
    .join("\n");
}

export function downloadTextFile(
  contents: string,
  filename: string,
  type: string,
) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
