const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

function load(file, globals = {}) {
  const source = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, { exports, ...globals });
  return exports;
}

const employee = {
  id: "employee-1", name: "A Person", extId: "1", dept: "IT",
  descriptor: Array(128).fill(0.1), photo: "data:image/jpeg;base64,YQ==", createdAt: 1,
};

function legacy(values) {
  const stored = new Map(Object.entries(values));
  return {
    stored,
    localStorage: { getItem: (key) => stored.get(key) ?? null, removeItem: (key) => stored.delete(key) },
  };
}

test("validates records and rejects malformed descriptors, images, PINs, and logs", () => {
  const validation = load("lib/storage-validation.ts");
  assert.equal(validation.isEmployee(employee), true);
  assert.equal(validation.isEmployee({ ...employee, descriptor: [0.1] }), false);
  assert.equal(validation.isEmployee({ ...employee, descriptor: Array(128).fill(NaN) }), false);
  assert.equal(validation.isEmployee({ ...employee, photo: "https://example.com/photo.jpg" }), false);
  assert.equal(validation.isSettings({ orgName: "FaceGate", timeZone: "Asia/Kolkata" }), true);
  assert.equal(validation.isSettings({ orgName: "FaceGate", timeZone: "Invalid/Zone" }), false);
  assert.equal(validation.isLegacySettings({ pin: "1234", orgName: "FaceGate" }), true);
  assert.equal(validation.isLegacySettings({ pin: "123", orgName: "FaceGate" }), false);
  assert.equal(validation.isLogEntry({ id: "log", empId: "1", name: "A", type: "IN", ts: 1 }), true);
  assert.equal(validation.isLogEntry({ id: "log", empId: "1", name: "A", type: "IN", ts: Infinity }), false);
});

test("imports local storage before deleting originals", async () => {
  const browser = legacy({ fg_employees: JSON.stringify([employee]), fg_logs: "[]", fg_settings: '{"pin":"1234","orgName":"FaceGate"}', unrelated: "keep" });
  const { migrateBrowserStorage } = load("lib/storage-migration.ts", browser);
  let imported;
  await migrateBrowserStorage(async (snapshot) => {
    assert.equal(browser.stored.has("fg_employees"), true);
    imported = JSON.parse(JSON.stringify(snapshot));
  });
  assert.deepEqual(imported.employees, [employee]);
  assert.equal(browser.stored.has("fg_employees"), false);
  assert.equal(browser.stored.get("unrelated"), "keep");
});

test("failed Redis imports preserve browser data for retry", async () => {
  const browser = legacy({ fg_employees: JSON.stringify([employee]) });
  const { migrateBrowserStorage } = load("lib/storage-migration.ts", browser);
  await assert.rejects(migrateBrowserStorage(async () => { throw new Error("Redis unavailable"); }), /Redis unavailable/);
  assert.equal(browser.stored.get("fg_employees"), JSON.stringify([employee]));
});

test("empty browsers do not send migration requests", async () => {
  const { migrateBrowserStorage } = load("lib/storage-migration.ts", legacy({}));
  await migrateBrowserStorage(async () => { assert.fail("Unexpected import"); });
});

test("malformed browser data is retained", async () => {
  const browser = legacy({ fg_employees: "invalid JSON" });
  const { migrateBrowserStorage } = load("lib/storage-migration.ts", browser);
  await assert.rejects(migrateBrowserStorage(async () => { assert.fail("Unexpected import"); }));
  assert.equal(browser.stored.get("fg_employees"), "invalid JSON");
});

function indexedBrowser() {
  const browser = legacy({ fg_employees: JSON.stringify([{ ...employee, name: "Old name" }]) });
  const saved = { ...employee, name: "IndexedDB name", photoKey: "employees/employee-1/profile" };
  delete saved.photo;
  const values = {
    employees: [saved],
    attendanceLogs: [{ id: "log-1", empId: employee.id, name: saved.name, type: "IN", ts: 5 }],
    settings: { pin: "4321", orgName: "Migrated org" },
    images: [new Blob(["image"], { type: "image/jpeg" })],
  };
  const request = (value) => {
    const operation = { result: value };
    queueMicrotask(() => operation.onsuccess?.());
    return operation;
  };
  let deleted = false;
  const database = {
    objectStoreNames: { contains: (name) => name in values },
    transaction: () => ({ objectStore: (name) => ({
      getAll: () => request(values[name]),
      get: () => request(values[name]),
      getAllKeys: () => request([saved.photoKey]),
    }) }),
    close() {},
  };
  class FileReader {
    readAsDataURL() { this.result = employee.photo; queueMicrotask(() => this.onload()); }
  }
  return {
    ...browser, FileReader,
    indexedDB: {
      open: () => request(database),
      deleteDatabase: () => { deleted = true; return request(undefined); },
    },
    wasDeleted: () => deleted,
  };
}

test("imports IndexedDB photos, settings, logs, and newer employee records", async () => {
  const browser = indexedBrowser();
  const { migrateBrowserStorage } = load("lib/storage-migration.ts", browser);
  await migrateBrowserStorage(async (snapshot) => {
    assert.equal(browser.wasDeleted(), false);
    assert.equal(snapshot.employees.length, 1);
    assert.equal(snapshot.employees[0].name, "IndexedDB name");
    assert.equal(snapshot.employees[0].photo, employee.photo);
    assert.equal(snapshot.logs[0].id, "log-1");
    assert.equal(snapshot.settings.pin, "4321");
  });
  assert.equal(browser.wasDeleted(), true);
});

test("failed IndexedDB import retains both legacy stores", async () => {
  const browser = indexedBrowser();
  const { migrateBrowserStorage } = load("lib/storage-migration.ts", browser);
  await assert.rejects(migrateBrowserStorage(async () => { throw new Error("Import failed"); }), /Import failed/);
  assert.equal(browser.wasDeleted(), false);
  assert.equal(browser.stored.has("fg_employees"), true);
});
