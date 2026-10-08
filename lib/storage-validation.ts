import { Employee, LogEntry, Settings } from "@/lib/types";

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown, max = 256): value is string =>
  typeof value === "string" && value.length <= max;
const id = (value: unknown): value is string => text(value, 128) && value.length > 0;
const timestamp = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

export function isImage(value: unknown): value is string {
  return text(value, 5_000_000) && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value);
}

export function isEmployee(value: unknown): value is Employee {
  return record(value) && id(value.id) && text(value.name) && value.name.trim().length > 0 &&
    text(value.extId) && text(value.dept) && timestamp(value.createdAt) &&
    Array.isArray(value.descriptor) && value.descriptor.length === 128 &&
    value.descriptor.every((item) => typeof item === "number" && Number.isFinite(item)) &&
    (value.photo === "" || isImage(value.photo));
}

export function isLogEntry(value: unknown): value is LogEntry {
  return record(value) && id(value.id) && id(value.empId) && text(value.name) &&
    (value.extId === undefined || text(value.extId)) &&
    (value.type === "IN" || value.type === "OUT") && timestamp(value.ts);
}

export function isTimeZone(value: unknown): value is string {
  if (!text(value, 100)) return false;
  try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; }
}

export function isSettings(value: unknown): value is Settings {
  return record(value) && text(value.orgName) && value.orgName.trim().length > 0 &&
    isTimeZone(value.timeZone);
}

export function isLegacySettings(value: unknown): value is { orgName: string; pin?: string; timeZone?: string } {
  return record(value) && text(value.orgName) && value.orgName.trim().length > 0 &&
    (value.pin === undefined || (text(value.pin) && /^\d{4}$/.test(value.pin))) &&
    (value.timeZone === undefined || isTimeZone(value.timeZone));
}
