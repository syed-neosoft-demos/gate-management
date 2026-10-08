const { test } = require("node:test");
const assert = require("node:assert/strict");
const { typescriptLoader } = require("./load-typescript.cjs");
const { attendanceMonthReport, attendanceDayStart, formatWorkDuration } = typescriptLoader()("lib/attendance-report.ts");
const people = [{ id: "a", name: "Ada", extId: "1", dept: "IT", photo: "", createdAt: 1, descriptor: [] }, { id: "b", name: "Ben", extId: "2", dept: "IT", photo: "", createdAt: 1, descriptor: [] }];
let counter = 0;
const entry = (type, date, empId = "a") => ({ id: `log-${++counter}`, empId, name: empId, type, ts: Date.parse(date) });
const hour = 3600000;
const now = Date.parse("2026-10-15T12:00:00+05:30");
const report = (logs, month = "2026-10", zone = "Asia/Kolkata", at = now) => attendanceMonthReport(people, logs, month, zone, at);

test("pairs multiple visits and excludes time spent outside the workplace", () => {
  const logs = [entry("IN", "2026-10-01T09:00:00+05:30"), entry("OUT", "2026-10-01T12:00:00+05:30"), entry("IN", "2026-10-01T13:00:00+05:30"), entry("OUT", "2026-10-01T17:00:00+05:30")];
  const value = report(logs.reverse());
  assert.equal(value.milliseconds, 7 * hour);
  assert.equal(value.people[0].daysPresent, 1);
  assert.equal(value.people[0].days[0].visits, 2);
  assert.equal(value.people[1].milliseconds, 0);
  assert.equal(value.issues, 0);
});

test("clips overnight visits to local dates and month boundaries", () => {
  const logs = [entry("IN", "2026-09-30T23:00:00+05:30"), entry("OUT", "2026-10-01T02:00:00+05:30"), entry("IN", "2026-10-31T23:00:00+05:30"), entry("OUT", "2026-11-01T02:00:00+05:30")];
  const value = report(logs, "2026-10", "Asia/Kolkata", Date.parse("2026-11-02T12:00:00+05:30"));
  assert.equal(value.milliseconds, 3 * hour);
  assert.equal(value.daily[0].milliseconds, 2 * hour);
  assert.equal(value.daily[30].milliseconds, hour);
  assert.equal(value.people[0].daysPresent, 2);
});

test("counts today's active visit, excludes stale open visits and future scans", () => {
  const value = report([entry("IN", "2026-10-15T09:00:00+05:30"), entry("IN", "2026-10-14T09:00:00+05:30", "b"), entry("OUT", "2026-10-16T18:00:00+05:30")]);
  assert.equal(value.people[0].milliseconds, 3 * hour);
  assert.equal(value.people[0].active, true);
  assert.equal(value.people[1].milliseconds, 0);
  assert.equal(value.people[1].issues, 1);
});

test("flags orphan check-outs and duplicate check-ins without double-counting time", () => {
  const value = report([entry("OUT", "2026-10-01T08:00:00+05:30"), entry("IN", "2026-10-01T09:00:00+05:30"), entry("IN", "2026-10-01T10:00:00+05:30"), entry("OUT", "2026-10-01T17:00:00+05:30")]);
  assert.equal(value.milliseconds, 8 * hour);
  assert.equal(value.issues, 2);
  assert.equal(value.people[0].days[0].visits, 1);
});

test("retains monthly history for removed employees", () => {
  const value = report([entry("IN", "2026-10-01T09:00:00+05:30", "removed"), entry("OUT", "2026-10-01T10:00:00+05:30", "removed")]);
  const former = value.people.find((person) => person.id === "removed");
  assert.equal(former.registered, false);
  assert.equal(former.milliseconds, hour);
});

test("handles DST transitions using actual elapsed time", () => {
  assert.equal(attendanceDayStart("2026-03-08", "America/New_York"), Date.parse("2026-03-08T00:00:00-05:00"));
  const spring = report([entry("IN", "2026-03-08T00:00:00-05:00"), entry("OUT", "2026-03-09T00:00:00-04:00")], "2026-03", "America/New_York", Date.parse("2026-03-10T00:00:00Z"));
  assert.equal(spring.milliseconds, 23 * hour);
  const fall = report([entry("IN", "2026-11-01T00:00:00-04:00"), entry("OUT", "2026-11-02T00:00:00-05:00")], "2026-11", "America/New_York", Date.parse("2026-11-03T00:00:00Z"));
  assert.equal(fall.milliseconds, 25 * hour);
});

test("validates month input and formats long durations without wrapping at 24 hours", () => {
  assert.throws(() => report([], "2026-13"), /Invalid report month/);
  assert.equal(formatWorkDuration(125 * hour + 45 * 60000), "125h 45m");
});
