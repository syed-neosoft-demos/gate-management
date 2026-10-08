import { Employee, LogEntry, Settings } from "@/lib/types";
import { migrateBrowserStorage } from "@/lib/storage-migration";

export interface EmployeeRepository {
  list(): Promise<Employee[]>;
  create(employee: Employee, image?: Blob): Promise<Employee>;
  remove(id: string): Promise<void>;
}

export interface AttendanceRepository {
  list(): Promise<LogEntry[]>;
  add(entry: LogEntry): Promise<void>;
}

export interface SettingsRepository {
  get(): Promise<Settings>;
  save(settings: Settings): Promise<void>;
}

/** Bucket-shaped operations. Images are intentionally not embedded in employee rows. */
export interface ImageBucket {
  get(key: string): Promise<Blob | undefined>;
  put(key: string, image: Blob): Promise<void>;
  remove(key: string): Promise<void>;
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, encoded = ""] = dataUrl.split(",", 2);
  const mime = header.match(/^data:([^;]+)/)?.[1] || "application/octet-stream";
  const bytes = atob(encoded);
  const output = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) output[i] = bytes.charCodeAt(i);
  return new Blob([output], { type: mime });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function request<T>(
  resource: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`/api/storage/${resource}`, {
    ...options,
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Storage request failed");
  return data as T;
}

const images: ImageBucket = {
  async get(key) {
    const value = await request<string | null>(
      `images?key=${encodeURIComponent(key)}`,
    );
    return value ? dataUrlToBlob(value) : undefined;
  },
  async put(key, image) {
    await request(`images?key=${encodeURIComponent(key)}`, {
      method: "POST",
      body: JSON.stringify(await blobToDataUrl(image)),
    });
  },
  async remove(key) {
    await request(`images?key=${encodeURIComponent(key)}`, {
      method: "DELETE",
    });
  },
};

const employees: EmployeeRepository = {
  list: () => request<Employee[]>("employees"),
  async create(employee, image) {
    return request<Employee>("employees", {
      method: "POST",
      body: JSON.stringify({
        ...employee,
        photo: image ? await blobToDataUrl(image) : employee.photo,
      }),
    });
  },
  async remove(id) {
    await request(`employees?key=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },
};

const attendance: AttendanceRepository = {
  list: () => request<LogEntry[]>("attendance"),
  async add(entry) {
    await request("attendance", {
      method: "POST",
      body: JSON.stringify(entry),
    });
  },
};

const settings: SettingsRepository = {
  get: () => request<Settings>("settings"),
  async save(value) {
    await request("settings", { method: "POST", body: JSON.stringify(value) });
  },
};

let initialization: Promise<void> | undefined;
let migration: Promise<void> | undefined;
export const faceGateStorage = {
  employees,
  attendance,
  settings,
  images,
  initialize(): Promise<void> {
    if (!initialization) {
      initialization = (async () => {
        await request("initialize");
      })().catch((error) => {
        initialization = undefined;
        throw error;
      });
    }
    return initialization;
  },
  migrateLegacyData(): Promise<void> {
    if (!migration) {
      migration = migrateBrowserStorage(async (snapshot) => {
        await request("migrate", {
          method: "POST",
          body: JSON.stringify(snapshot),
        });
      }).catch((error) => {
        migration = undefined;
        throw error;
      });
    }
    return migration;
  },
  async clearPeopleAndAttendance() {
    await request("reset", { method: "DELETE" });
  },
};
