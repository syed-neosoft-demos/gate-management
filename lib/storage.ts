import { Employee, LogEntry, Settings } from "@/lib/types";

const DATABASE_NAME = "facegate";
const DATABASE_VERSION = 1;
const DEFAULT_SETTINGS: Settings = { pin: "1234", orgName: "FaceGate" };

const STORES = {
  employees: "employees",
  attendance: "attendanceLogs",
  settings: "settings",
  images: "images",
  metadata: "metadata",
} as const;

type StoredEmployee = Omit<Employee, "photo"> & { photoKey?: string };
type MetadataRecord = { key: string; value: boolean };

/** Database-shaped operations. A server adapter can implement this interface later. */
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

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

let databasePromise: Promise<IDBDatabase> | undefined;

function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORES.employees)) {
        db.createObjectStore(STORES.employees, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORES.attendance)) {
        const store = db.createObjectStore(STORES.attendance, { keyPath: "id" });
        store.createIndex("byTimestamp", "ts");
        store.createIndex("byEmployee", "empId");
      }
      if (!db.objectStoreNames.contains(STORES.settings)) {
        db.createObjectStore(STORES.settings);
      }
      if (!db.objectStoreNames.contains(STORES.images)) {
        db.createObjectStore(STORES.images);
      }
      if (!db.objectStoreNames.contains(STORES.metadata)) {
        db.createObjectStore(STORES.metadata, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      databasePromise = undefined;
      reject(request.error);
    };
  });
  return databasePromise;
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

class IndexedDbImageBucket implements ImageBucket {
  async get(key: string) {
    const db = await openDatabase();
    return requestResult<Blob | undefined>(
      db.transaction(STORES.images).objectStore(STORES.images).get(key),
    );
  }

  async put(key: string, image: Blob) {
    const db = await openDatabase();
    const tx = db.transaction(STORES.images, "readwrite");
    tx.objectStore(STORES.images).put(image, key);
    await transactionDone(tx);
  }

  async remove(key: string) {
    const db = await openDatabase();
    const tx = db.transaction(STORES.images, "readwrite");
    tx.objectStore(STORES.images).delete(key);
    await transactionDone(tx);
  }
}

class IndexedDbEmployeeRepository implements EmployeeRepository {
  async list(): Promise<Employee[]> {
    const db = await openDatabase();
    const tx = db.transaction([STORES.employees, STORES.images]);
    const rows = await requestResult<StoredEmployee[]>(
      tx.objectStore(STORES.employees).getAll(),
    );
    const imageStore = tx.objectStore(STORES.images);
    const images = await Promise.all(
      rows.map((row) =>
        row.photoKey
          ? requestResult<Blob | undefined>(imageStore.get(row.photoKey))
          : Promise.resolve(undefined),
      ),
    );
    return Promise.all(
      rows.map(async (row, index) => ({
        ...row,
        photo: images[index] ? await blobToDataUrl(images[index]!) : "",
      })),
    );
  }

  async create(employee: Employee, image?: Blob): Promise<Employee> {
    const db = await openDatabase();
    const photoKey = image ? `employees/${employee.id}/profile` : undefined;
    const { photo: _runtimePhoto, ...employeeData } = employee;
    const row: StoredEmployee = { ...employeeData, photoKey };
    const tx = db.transaction([STORES.employees, STORES.images], "readwrite");
    tx.objectStore(STORES.employees).add(row);
    if (image && photoKey) tx.objectStore(STORES.images).put(image, photoKey);
    await transactionDone(tx);
    return { ...row, photo: image ? await blobToDataUrl(image) : "" };
  }

  async remove(id: string): Promise<void> {
    const db = await openDatabase();
    const tx = db.transaction([STORES.employees, STORES.images], "readwrite");
    const employeeStore = tx.objectStore(STORES.employees);
    const row = await requestResult<StoredEmployee | undefined>(employeeStore.get(id));
    employeeStore.delete(id);
    if (row?.photoKey) tx.objectStore(STORES.images).delete(row.photoKey);
    await transactionDone(tx);
  }
}

class IndexedDbAttendanceRepository implements AttendanceRepository {
  async list() {
    const db = await openDatabase();
    return requestResult<LogEntry[]>(
      db.transaction(STORES.attendance).objectStore(STORES.attendance).getAll(),
    );
  }

  async add(entry: LogEntry) {
    const db = await openDatabase();
    const tx = db.transaction(STORES.attendance, "readwrite");
    tx.objectStore(STORES.attendance).add(entry);
    await transactionDone(tx);
  }
}

class IndexedDbSettingsRepository implements SettingsRepository {
  async get() {
    const db = await openDatabase();
    const value = await requestResult<Settings | undefined>(
      db.transaction(STORES.settings).objectStore(STORES.settings).get("app"),
    );
    return value ?? DEFAULT_SETTINGS;
  }

  async save(settings: Settings) {
    const db = await openDatabase();
    const tx = db.transaction(STORES.settings, "readwrite");
    tx.objectStore(STORES.settings).put(settings, "app");
    await transactionDone(tx);
  }
}

function parseLocalValue<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

async function migrateLocalStorage(): Promise<void> {
  const db = await openDatabase();
  const migrationKey = "local-storage-v1";
  const existing = await requestResult<MetadataRecord | undefined>(
    db.transaction(STORES.metadata).objectStore(STORES.metadata).get(migrationKey),
  );
  if (existing?.value) return;

  const employees = parseLocalValue<Employee[]>("fg_employees", []);
  const logs = parseLocalValue<LogEntry[]>("fg_logs", []);
  const settings = parseLocalValue<Settings | undefined>("fg_settings", undefined);
  const tx = db.transaction(Object.values(STORES), "readwrite");
  const employeeStore = tx.objectStore(STORES.employees);
  const imageStore = tx.objectStore(STORES.images);

  employees.forEach((employee) => {
    const { photo, ...employeeData } = employee;
    const photoKey = photo ? `employees/${employee.id}/profile` : undefined;
    employeeStore.put({ ...employeeData, photoKey } satisfies StoredEmployee);
    if (photo && photoKey) imageStore.put(dataUrlToBlob(photo), photoKey);
  });
  logs.forEach((entry) => tx.objectStore(STORES.attendance).put(entry));
  if (settings) tx.objectStore(STORES.settings).put(settings, "app");
  tx.objectStore(STORES.metadata).put({ key: migrationKey, value: true });
  await transactionDone(tx);

  ["fg_employees", "fg_logs", "fg_settings"].forEach((key) =>
    localStorage.removeItem(key),
  );
}

const images = new IndexedDbImageBucket();

export const faceGateStorage = {
  employees: new IndexedDbEmployeeRepository(),
  attendance: new IndexedDbAttendanceRepository(),
  settings: new IndexedDbSettingsRepository(),
  images,

  async initialize() {
    await openDatabase();
    await migrateLocalStorage();
  },

  async clearPeopleAndAttendance() {
    const db = await openDatabase();
    const tx = db.transaction(
      [STORES.employees, STORES.attendance, STORES.images],
      "readwrite",
    );
    tx.objectStore(STORES.employees).clear();
    tx.objectStore(STORES.attendance).clear();
    tx.objectStore(STORES.images).clear();
    await transactionDone(tx);
  },
};
