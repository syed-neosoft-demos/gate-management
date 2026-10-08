export type Employee = {
  id: string;
  name: string;
  extId: string;
  dept: string;
  descriptor: number[];
  /** Runtime display URL/data URL. Persisted images are addressed by photoKey. */
  photo: string;
  photoKey?: string;
  createdAt: number;
};

export type LogType = "IN" | "OUT";

export type LogEntry = {
  id: string;
  empId: string;
  name: string;
  extId?: string;
  type: LogType;
  ts: number;
};

export type Settings = {
  pin: string;
  orgName: string;
};

export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString([], {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function isoDate(ts: number) {
  const d = new Date(ts);
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}
