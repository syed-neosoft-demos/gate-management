"use client";

import { RefObject } from "react";
import { Employee, LogEntry, fmtTime, fmtDate } from "@/lib/types";

type LastEvent = { entry: LogEntry; emp: Employee } | null;

interface Props {
  loadingScreenVisible: boolean;
  loadingText: string;
  appVisible: boolean;
  orgName: string;
  clockTime: string;
  clockDate: string;
  openPinGate: () => void;
  videoRef: RefObject<HTMLVideoElement>;
  overlayRef: RefObject<HTMLCanvasElement>;
  scanFrameRef: RefObject<HTMLDivElement>;
  scanMatch: boolean;
  scanStatus: string;
  lastEvent: LastEvent;
  statIn: number;
  statOut: number;
  statPeople: number;
  openRegister: () => void;
  toast: {
    show: boolean;
    emp: Employee | null;
    type: "IN" | "OUT";
    ts: number;
  };

  pinOpen: boolean;
  pinBuffer: string;
  pinError: string;
  pressKey: (k: string) => void;
  closePinGate: () => void;

  registerOpen: boolean;
  regVideoRef: RefObject<HTMLVideoElement>;
  samples: Float32Array[];
  captureHint: string;
  captureSample: () => void;
  regName: string;
  setRegName: (v: string) => void;
  regId: string;
  setRegId: (v: string) => void;
  regDept: string;
  setRegDept: (v: string) => void;
  regError: { text: string; ok: boolean };
  canSave: boolean;
  savePerson: () => void;
  closeRegister: () => void;

  adminOpen: boolean;
  closeAdmin: () => void;
  activeTab: "logs" | "people" | "settings";
  setActiveTab: (t: "logs" | "people" | "settings") => void;
  logDate: string;
  setLogDate: (v: string) => void;
  showAllDates: () => void;
  filteredLogs: LogEntry[];
  employees: Employee[];
  exportCsv: () => void;
  sortedPeople: Employee[];
  removePerson: (emp: Employee) => void;
  openRegisterFromAdmin: () => void;
  settingsOrgName: string;
  setSettingsOrgName: (v: string) => void;
  settingsNewPin: string;
  setSettingsNewPin: (v: string) => void;
  settingsMsg: { text: string; ok: boolean };
  saveSettings: () => void;
  resetAll: () => void;
}

const badgeClass = (type: "IN" | "OUT") =>
  type === "IN" ? "bg-in/[.14] text-in" : "bg-out/[.14] text-out";

export default function KioskView(p: Props) {
  return (
    <>
      {/* LOADING SCREEN */}
      {p.loadingScreenVisible && (
        <div className="z-[200] fixed inset-0 flex flex-col justify-center items-center gap-4 bg-bg">
          <div className="border-[3px] border-line border-t-scan rounded-full w-[34px] h-[34px] animate-spin" />
          <p className="text-[13px] text-ink-dim">{p.loadingText}</p>
        </div>
      )}

      {/* TOAST */}
      <div
        className={`fixed left-1/2 top-6 z-[100] flex min-w-[300px] -translate-x-1/2 items-center gap-3.5 rounded-2xl border border-line bg-panel px-[22px] py-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-transform duration-[350ms] ${
          p.toast.show ? "translate-y-0" : "-translate-y-[140%]"
        }`}
        style={{ transitionTimingFunction: "cubic-bezier(0.2,0.9,0.3,1.3)" }}
      >
        {p.toast.emp?.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="flex-shrink-0 bg-panel-2 border-2 border-line rounded-full w-11 h-11 object-cover"
            src={p.toast.emp.photo}
            alt=""
          />
        ) : (
          <div className="flex-shrink-0 bg-panel-2 border-2 border-line rounded-full w-11 h-11" />
        )}
        <div>
          <div className="font-bold text-[15px]">
            {p.toast.emp?.name || "—"}
          </div>
          <div className="mt-0.5 text-ink-dim text-xs">
            {p.toast.emp && (
              <>
                <span
                  className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wide ${badgeClass(
                    p.toast.type,
                  )}`}
                >
                  {p.toast.type === "IN" ? "CHECKED IN" : "CHECKED OUT"}
                </span>
                &nbsp;{fmtTime(p.toast.ts)}
              </>
            )}
          </div>
        </div>
      </div>

      {/* MAIN APP */}
      <div
        className={`${p.appVisible ? "" : "hidden"} relative flex h-screen w-screen flex-col`}
      >
        <header className="flex flex-shrink-0 justify-between items-center px-8 py-5">
          <div className="flex items-center gap-2.5">
            <span className="bg-scan shadow-[0_0_12px_#52e3c2] rounded-full w-2.5 h-2.5" />
            <div>
              <h1 className="font-display font-bold text-[19px] tracking-wide">
                {p.orgName || "FaceGate"}
              </h1>
              <small className="block mt-px text-[11px] text-ink-dim uppercase tracking-[1.5px]">
                Attendance Kiosk
              </small>
            </div>
          </div>
          <div className="flex items-center">
            <div className="text-right">
              <div className="font-mono font-bold text-[28px] tracking-wide">
                {p.clockTime}
              </div>
              <div className="text-ink-dim text-xs tracking-wide">
                {p.clockDate}
              </div>
            </div>
            <button
              onClick={p.openPinGate}
              title="Admin"
              className="flex justify-center items-center bg-panel ml-4 border border-line hover:border-scan rounded-[10px] w-[38px] h-[38px] text-ink-dim hover:text-ink transition-all"
            >
              ⚙
            </button>
          </div>
        </header>

        <main className="flex md:flex-row flex-col flex-1 justify-center items-center gap-14 px-8 pb-8 min-h-0">
          <div className="relative flex-shrink-0 w-[320px] md:w-[440px] h-[320px] md:h-[440px]">
            <div
              ref={p.scanFrameRef}
              className={`relative h-full w-full overflow-hidden rounded-[20px] border border-line bg-black shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_20px_60px_rgba(0,0,0,0.5)]`}
            >
              <video
                ref={p.videoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover mirrored"
              />
              <canvas
                ref={p.overlayRef}
                className="absolute inset-0 w-full h-full mirrored"
              />
              <div className="right-3.5 left-3.5 absolute bg-gradient-to-r from-transparent via-scan to-transparent opacity-80 h-0.5 animate-sweep" />
              {(["tl", "tr", "bl", "br"] as const).map((corner) => (
                <div
                  key={corner}
                  className={cornerClass(corner, p.scanMatch)}
                />
              ))}
            </div>
            <div className="right-0 -bottom-[38px] left-0 absolute text-[13px] text-ink-dim text-center tracking-wide">
              {p.scanStatus}
            </div>
          </div>

          <div className="flex-shrink-0 w-full md:w-[340px] max-w-[400px]">
            <div className="bg-panel p-[22px] border border-line rounded-card">
              <h2 className="mb-3.5 text-ink-dim text-xs uppercase tracking-[1.5px]">
                Last check-in
              </h2>
              {p.lastEvent ? (
                <div className="flex items-center gap-3.5">
                  {p.lastEvent.emp.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      className="flex-shrink-0 bg-panel-2 border-2 border-line rounded-full w-[52px] h-[52px] object-cover"
                      src={p.lastEvent.emp.photo}
                      alt=""
                    />
                  ) : (
                    <div className="flex-shrink-0 bg-panel-2 border-2 border-line rounded-full w-[52px] h-[52px]" />
                  )}
                  <div>
                    <div className="font-semibold text-[15px]">
                      {p.lastEvent.emp.name}
                    </div>
                    <div className="mt-0.5 text-ink-dim text-xs">
                      {p.lastEvent.emp.extId}
                      {p.lastEvent.emp.dept ? ` · ${p.lastEvent.emp.dept}` : ""}
                    </div>
                    <span
                      className={`mt-1.5 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wide ${badgeClass(
                        p.lastEvent.entry.type,
                      )}`}
                    >
                      {p.lastEvent.entry.type === "IN"
                        ? "CHECKED IN"
                        : "CHECKED OUT"}{" "}
                      · {fmtTime(p.lastEvent.entry.ts)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-[13px] text-ink-dim leading-relaxed">
                  No one has checked in yet today. Once someone scans in, their
                  details will appear here.
                </div>
              )}
            </div>

            <div className="bg-panel mt-4 p-[22px] border border-line rounded-card">
              <h2 className="mb-3.5 text-ink-dim text-xs uppercase tracking-[1.5px]">
                Today
              </h2>
              <StatRow k="Checked in" v={p.statIn} />
              <StatRow k="Checked out" v={p.statOut} />
              <StatRow k="Registered people" v={p.statPeople} last />
              <div className="mt-3.5 text-center">
                <button
                  onClick={p.openRegister}
                  className="bg-transparent font-inherit text-[13px] text-scan underline cursor-pointer"
                >
                  + Register a new person
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>

      <PinGate {...p} />
      <RegisterPanel {...p} />
      <AdminPanel {...p} />
    </>
  );
}

function cornerClass(corner: "tl" | "tr" | "bl" | "br", match: boolean) {
  const base = "absolute h-[34px] w-[34px] opacity-85 transition-colors";
  const color = match ? "border-in" : "border-scan";
  switch (corner) {
    case "tl":
      return `${base} ${color} left-3.5 top-3.5 rounded-tl-md border-l-[3px] border-t-[3px]`;
    case "tr":
      return `${base} ${color} right-3.5 top-3.5 rounded-tr-md border-r-[3px] border-t-[3px]`;
    case "bl":
      return `${base} ${color} bottom-3.5 left-3.5 rounded-bl-md border-b-[3px] border-l-[3px]`;
    case "br":
      return `${base} ${color} bottom-3.5 right-3.5 rounded-br-md border-b-[3px] border-r-[3px]`;
  }
}

function StatRow({ k, v, last }: { k: string; v: number; last?: boolean }) {
  return (
    <div
      className={`flex items-baseline justify-between py-1.5 ${
        last ? "" : "border-b border-dashed border-line"
      }`}
    >
      <span className="text-[12.5px] text-ink-dim">{k}</span>
      <span className="font-mono font-bold">{v}</span>
    </div>
  );
}

/* ============ PIN GATE ============ */
function PinGate(p: Props) {
  const keys = [
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "clear",
    "0",
    "back",
  ];
  return (
    <div
      className={`${
        p.pinOpen ? "flex" : "hidden"
      } fixed inset-0 z-50 items-center justify-center bg-[rgba(5,8,11,0.78)] p-6 backdrop-blur-md`}
    >
      <div className="bg-panel shadow-[0_30px_80px_rgba(0,0,0,0.6)] p-7 border border-line rounded-[18px] w-full max-w-[380px]">
        <h2 className="m-0 mb-1 font-bold text-[17px]">Admin access</h2>
        <p className="m-0 text-[13px] text-ink-dim">
          Enter the 4-digit admin PIN
        </p>
        <div className="flex justify-center gap-2.5 my-[18px]">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={`h-3.5 w-3.5 rounded-full border-2 transition-all ${
                i < p.pinBuffer.length
                  ? "border-scan bg-scan"
                  : "border-line bg-transparent"
              }`}
            />
          ))}
        </div>
        <div className="mt-2 h-4 text-[12.5px] text-danger text-center">
          {p.pinError}
        </div>
        <div className="gap-2.5 grid grid-cols-3 mt-2">
          {keys.map((k) => (
            <button
              key={k}
              onClick={() => p.pressKey(k)}
              className="bg-panel-2 py-4 border border-line hover:border-scan rounded-[10px] font-mono font-semibold text-[17px] text-ink"
            >
              {k === "clear" ? "C" : k === "back" ? "⌫" : k}
            </button>
          ))}
        </div>
        <button
          onClick={p.closePinGate}
          className="bg-transparent mt-4 px-[18px] py-3 border border-line hover:border-scan rounded-[10px] w-full font-semibold text-[13.5px] text-ink-dim hover:text-ink"
        >
          Cancel
        </button>
        <p className="mt-3.5 text-[11px] text-ink-dim text-center">
          Default PIN is 1234. Change it from Admin → Settings.
        </p>
      </div>
    </div>
  );
}

/* ============ REGISTER PANEL ============ */
function RegisterPanel(p: Props) {
  return (
    <div
      className={`${
        p.registerOpen ? "flex" : "hidden"
      } fixed inset-0 z-50 items-center justify-center bg-[rgba(5,8,11,0.78)] p-6 backdrop-blur-md`}
    >
      <div className="flex flex-col bg-panel shadow-[0_30px_80px_rgba(0,0,0,0.6)] border border-line rounded-[18px] w-full max-w-[960px] max-h-[88vh]">
        <div className="flex flex-shrink-0 justify-between items-center px-7 py-[22px] border-line border-b">
          <h2 className="m-0 font-bold text-[17px]">Register a new person</h2>
          <button
            onClick={p.closeRegister}
            className="bg-transparent text-ink-dim hover:text-ink text-xl leading-none"
          >
            ✕
          </button>
        </div>
        <div className="p-7 overflow-y-auto">
          <div className="gap-7 grid grid-cols-1 md:grid-cols-[280px_1fr]">
            <div>
              <div className="relative bg-black mx-auto border border-line rounded-2xl w-[220px] md:w-[280px] h-[220px] md:h-[280px] overflow-hidden">
                <video
                  ref={p.regVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover mirrored"
                />
              </div>
              <div className="flex justify-center gap-2 mt-3">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className={`flex h-[34px] w-[34px] items-center justify-center rounded-lg border text-sm ${
                      i < p.samples.length
                        ? "border-in bg-in/[.14] text-in"
                        : "border-line bg-panel-2 text-ink-dim"
                    }`}
                  >
                    {i + 1}
                  </span>
                ))}
              </div>
              <div className="mt-2.5 min-h-[16px] text-ink-dim text-xs text-center">
                {p.captureHint}
              </div>
              <button
                onClick={p.captureSample}
                className="bg-scan hover:brightness-[1.08] mt-3.5 px-[18px] py-3 rounded-[10px] w-full font-semibold text-[#04241d] text-[13.5px]"
              >
                Capture sample
              </button>
            </div>
            <div>
              <FieldLabel first>Full name</FieldLabel>
              <TextInput
                value={p.regName}
                onChange={p.setRegName}
                placeholder="e.g. Priya Sharma"
              />
              <FieldLabel>Employee / Student ID</FieldLabel>
              <TextInput
                value={p.regId}
                onChange={p.setRegId}
                placeholder="e.g. EMP-014"
              />
              <FieldLabel>Department / Class</FieldLabel>
              <TextInput
                value={p.regDept}
                onChange={p.setRegDept}
                placeholder="e.g. Accounts, Grade 10-B"
              />
              <div
                className={`mt-2 text-[12.5px] ${
                  p.regError.ok ? "text-in" : "text-danger"
                }`}
              >
                {p.regError.text}
              </div>
              <button
                disabled={!p.canSave}
                onClick={p.savePerson}
                className="bg-scan disabled:opacity-50 hover:brightness-[1.08] mt-5 px-[18px] py-3 rounded-[10px] w-full font-semibold text-[#04241d] text-[13.5px] disabled:cursor-not-allowed"
              >
                Save & finish
              </button>
              <button
                onClick={p.closeRegister}
                className="bg-transparent mt-2.5 px-[18px] py-3 border border-line hover:border-scan rounded-[10px] w-full font-semibold text-[13.5px] text-ink-dim hover:text-ink"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldLabel({
  children,
  first,
}: {
  children: React.ReactNode;
  first?: boolean;
}) {
  return (
    <label
      className={`block text-xs tracking-wide text-ink-dim ${
        first ? "mt-0" : "mt-3.5"
      } mb-1.5`}
    >
      {children}
    </label>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="bg-panel-2 px-[13px] py-[11px] border border-line focus:border-scan rounded-[9px] outline-none w-full text-ink text-sm"
    />
  );
}

/* ============ ADMIN PANEL ============ */
function AdminPanel(p: Props) {
  return (
    <div
      className={`${
        p.adminOpen ? "flex" : "hidden"
      } fixed inset-0 z-50 items-center justify-center bg-[rgba(5,8,11,0.78)] p-6 backdrop-blur-md`}
    >
      <div className="flex flex-col bg-panel shadow-[0_30px_80px_rgba(0,0,0,0.6)] border border-line rounded-[18px] w-full max-w-[960px] max-h-[88vh]">
        <div className="flex flex-shrink-0 justify-between items-center px-7 py-[22px] border-line border-b">
          <h2 className="m-0 font-bold text-[17px]">Admin dashboard</h2>
          <button
            onClick={p.closeAdmin}
            className="bg-transparent text-ink-dim hover:text-ink text-xl leading-none"
          >
            ✕
          </button>
        </div>
        <div className="flex flex-shrink-0 gap-1.5 px-7 border-line border-b overflow-x-auto">
          {(["logs", "people", "settings"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => p.setActiveTab(tab)}
              className={`whitespace-nowrap border-b-2 px-1.5 py-3.5 text-[13.5px] font-semibold ${
                p.activeTab === tab
                  ? "border-scan text-ink"
                  : "border-transparent text-ink-dim"
              }`}
            >
              {tab === "logs"
                ? "Attendance log"
                : tab === "people"
                  ? "People"
                  : "Settings"}
            </button>
          ))}
        </div>
        <div className="p-7 overflow-y-auto">
          {p.activeTab === "logs" && <LogsTab {...p} />}
          {p.activeTab === "people" && <PeopleTab {...p} />}
          {p.activeTab === "settings" && <SettingsTab {...p} />}
        </div>
      </div>
    </div>
  );
}

function LogsTab(p: Props) {
  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <input
            type="date"
            value={p.logDate}
            onChange={(e) => p.setLogDate(e.target.value)}
            className="bg-panel-2 px-[13px] py-[11px] border border-line focus:border-scan rounded-[9px] outline-none w-auto text-ink text-sm"
          />
          <button
            onClick={p.showAllDates}
            className="bg-transparent px-[18px] py-3 border border-line hover:border-scan rounded-[10px] font-semibold text-[13.5px] text-ink-dim hover:text-ink"
          >
            Show all dates
          </button>
          <span className="bg-panel-2 px-3 py-1.5 border border-line rounded-[20px] text-[12.5px] text-ink-dim">
            {p.filteredLogs.length} entries
          </span>
        </div>
        <button
          onClick={p.exportCsv}
          className="bg-scan hover:brightness-[1.08] px-[18px] py-3 rounded-[10px] font-semibold text-[#04241d] text-[13.5px]"
        >
          Export CSV
        </button>
      </div>
      {p.filteredLogs.length === 0 ? (
        <div className="px-5 py-[50px] text-[13.5px] text-ink-dim text-center">
          No attendance records for this date yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13.5px] border-collapse">
            <thead>
              <tr>
                {["", "Name", "ID", "Type", "Date", "Time"].map((h) => (
                  <th
                    key={h}
                    className="px-2.5 py-2.5 border-line border-b font-semibold text-[11.5px] text-ink-dim text-left uppercase tracking-wide"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {p.filteredLogs.map((l) => {
                const emp = p.employees.find((e) => e.id === l.empId);
                return (
                  <tr key={l.id}>
                    <td className="px-2.5 py-2.5 border-line border-b">
                      {emp?.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          className="flex-shrink-0 bg-panel-2 rounded-full w-8 h-8 object-cover"
                          src={emp.photo}
                          alt=""
                        />
                      ) : (
                        <div className="flex-shrink-0 bg-panel-2 rounded-full w-8 h-8" />
                      )}
                    </td>
                    <td className="px-2.5 py-2.5 border-line border-b">
                      {l.name}
                    </td>
                    <td className="px-2.5 py-2.5 border-line border-b font-mono">
                      {l.extId || "—"}
                    </td>
                    <td className="px-2.5 py-2.5 border-line border-b">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wide ${badgeClass(
                          l.type,
                        )}`}
                      >
                        {l.type}
                      </span>
                    </td>
                    <td className="px-2.5 py-2.5 border-line border-b">
                      {fmtDate(l.ts)}
                    </td>
                    <td className="px-2.5 py-2.5 border-line border-b font-mono">
                      {fmtTime(l.ts)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PeopleTab(p: Props) {
  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
        <span className="bg-panel-2 px-3 py-1.5 border border-line rounded-[20px] text-[12.5px] text-ink-dim">
          {p.sortedPeople.length} people
        </span>
        <button
          onClick={p.openRegisterFromAdmin}
          className="bg-scan hover:brightness-[1.08] px-[18px] py-3 rounded-[10px] font-semibold text-[#04241d] text-[13.5px]"
        >
          + Register person
        </button>
      </div>
      {p.sortedPeople.length === 0 ? (
        <div className="px-5 py-[50px] text-[13.5px] text-ink-dim text-center">
          No one is registered yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13.5px] border-collapse">
            <thead>
              <tr>
                {["", "Name", "ID", "Department", "Registered", ""].map(
                  (h, i) => (
                    <th
                      key={i}
                      className="px-2.5 py-2.5 border-line border-b font-semibold text-[11.5px] text-ink-dim text-left uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {p.sortedPeople.map((emp) => (
                <tr key={emp.id}>
                  <td className="px-2.5 py-2.5 border-line border-b">
                    {emp.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        className="flex-shrink-0 bg-panel-2 rounded-full w-8 h-8 object-cover"
                        src={emp.photo}
                        alt=""
                      />
                    ) : (
                      <div className="flex-shrink-0 bg-panel-2 rounded-full w-8 h-8" />
                    )}
                  </td>
                  <td className="px-2.5 py-2.5 border-line border-b">
                    {emp.name}
                  </td>
                  <td className="px-2.5 py-2.5 border-line border-b font-mono">
                    {emp.extId || "—"}
                  </td>
                  <td className="px-2.5 py-2.5 border-line border-b">
                    {emp.dept || "—"}
                  </td>
                  <td className="px-2.5 py-2.5 border-line border-b">
                    {new Date(emp.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-2.5 py-2.5 border-line border-b">
                    <button
                      onClick={() => p.removePerson(emp)}
                      className="bg-danger/[.12] hover:bg-danger/[.2] px-3 py-1.5 rounded-lg font-semibold text-danger text-xs"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SettingsTab(p: Props) {
  return (
    <div>
      <FieldLabel first>
        Organization name (shown on the kiosk header)
      </FieldLabel>
      <TextInput value={p.settingsOrgName} onChange={p.setSettingsOrgName} />
      <FieldLabel>Change admin PIN (4 digits)</FieldLabel>
      <input
        type="text"
        maxLength={4}
        value={p.settingsNewPin}
        onChange={(e) => p.setSettingsNewPin(e.target.value)}
        placeholder="e.g. 4821"
        className="bg-panel-2 px-[13px] py-[11px] border border-line focus:border-scan rounded-[9px] outline-none w-full text-ink text-sm"
      />
      <button
        onClick={p.saveSettings}
        className="bg-scan hover:brightness-[1.08] mt-3.5 px-[18px] py-3 rounded-[10px] font-semibold text-[#04241d] text-[13.5px]"
      >
        Save settings
      </button>
      <div
        className={`mt-2 text-[12.5px] ${
          p.settingsMsg.ok ? "text-in" : "text-danger"
        }`}
      >
        {p.settingsMsg.text}
      </div>

      <div className="mt-8 pt-[22px] border-line border-t">
        <h2 className="opacity-90 text-danger text-xs uppercase tracking-[1.5px]">
          Danger zone
        </h2>
        <p className="mt-2 mb-3 text-[12.5px] text-ink-dim">
          Permanently erase all registered people and attendance logs from this
          device. This cannot be undone.
        </p>
        <button
          onClick={p.resetAll}
          className="bg-danger/[.12] hover:bg-danger/[.2] px-[18px] py-3 rounded-[10px] font-semibold text-[13.5px] text-danger"
        >
          Erase all data
        </button>
      </div>
    </div>
  );
}
