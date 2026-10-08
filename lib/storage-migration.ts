import { Employee, LogEntry } from "@/lib/types";

type LegacySettings = { orgName: string; pin?: string; timeZone?: string };
type Snapshot = { employees: Employee[]; logs: LogEntry[]; settings?: LegacySettings };
type StoredEmployee = Omit<Employee, "photo"> & { photo?: string };

function result<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function photoDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Read legacy browser data only; all new persistence goes through the Redis API. */
export async function migrateBrowserStorage(save: (snapshot: Snapshot) => Promise<void>) {
  const employees = JSON.parse(localStorage.getItem("fg_employees") || "[]") as Employee[];
  const logs = JSON.parse(localStorage.getItem("fg_logs") || "[]") as LogEntry[];
  let settings = JSON.parse(localStorage.getItem("fg_settings") || "null") as LegacySettings | undefined;
  let database: IDBDatabase | undefined;
  try {
    if (typeof indexedDB !== "undefined") {
      // Abort creation on a fresh browser: migration must not create a local database.
      const open = indexedDB.open("facegate");
      let absent = false;
      open.onupgradeneeded = () => { absent = true; open.transaction?.abort(); };
      database = await new Promise<IDBDatabase | undefined>((resolve, reject) => {
        open.onsuccess = () => resolve(open.result);
        open.onerror = () => absent ? resolve(undefined) : reject(open.error);
      });
    }
    if (database) {
      const stores = ["employees", "attendanceLogs", "settings", "images"].filter((name) => database!.objectStoreNames.contains(name));
      if (stores.length) {
        const tx = database.transaction(stores);
        const [rows, storedLogs, storedSettings, imageKeys, imageValues] = await Promise.all([
          stores.includes("employees") ? result<StoredEmployee[]>(tx.objectStore("employees").getAll()) : [],
          stores.includes("attendanceLogs") ? result<LogEntry[]>(tx.objectStore("attendanceLogs").getAll()) : [],
          stores.includes("settings") ? result<LegacySettings | undefined>(tx.objectStore("settings").get("app")) : undefined,
          stores.includes("images") ? result(tx.objectStore("images").getAllKeys()) : [],
          stores.includes("images") ? result<Blob[]>(tx.objectStore("images").getAll()) : [],
        ]);
        const imageMap = new Map(imageKeys.map((key, index) => [String(key), imageValues[index]]));
        for (const row of rows) {
          const image = row.photoKey ? imageMap.get(row.photoKey) : undefined;
          const employee = { ...row, photo: image ? await photoDataUrl(image) : row.photo || "" };
          const existing = employees.findIndex((item) => item.id === row.id);
          if (existing >= 0) employees[existing] = employee;
          else employees.push(employee);
        }
        for (const entry of storedLogs) {
          if (!logs.some((item) => item.id === entry.id)) logs.push(entry);
        }
        settings = storedSettings || settings;
      }
    }
    if (employees.length || logs.length || settings) {
      await save({ employees, logs, settings: settings || undefined });
    }
    // Keep the originals on any read or server error; retries never overwrite Redis rows.
    ["fg_employees", "fg_logs", "fg_settings"].forEach((key) => localStorage.removeItem(key));
    if (database) {
      database.close();
      database = undefined;
      await new Promise<void>((resolve, reject) => {
        const deletion = indexedDB.deleteDatabase("facegate");
        deletion.onsuccess = () => resolve();
        deletion.onerror = () => reject(deletion.error);
        deletion.onblocked = () => reject(new Error("Close other FaceGate tabs and reload to finish the Redis migration."));
      });
    }
  } finally {
    database?.close();
  }
}
