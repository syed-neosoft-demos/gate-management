import { fmtTime } from "@/lib/types";
import { KioskViewProps } from "@/components/kiosk/types";
import { badgeClass, EmployeeAvatar } from "@/components/kiosk/ui";

export default function KioskMain(p: KioskViewProps) {
  return (
    <>
      {p.loadingScreenVisible && <LoadingScreen text={p.loadingText} />}
      <AttendanceToast {...p} />

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
          <Scanner {...p} />
          <Summary {...p} />
        </main>
      </div>
    </>
  );
}

function LoadingScreen({ text }: { text: string }) {
  return (
    <div className="z-[200] fixed inset-0 flex flex-col justify-center items-center gap-4 bg-bg">
      <div className="border-[3px] border-line border-t-scan rounded-full w-[34px] h-[34px] animate-spin" />
      <p className="text-[13px] text-ink-dim">{text}</p>
    </div>
  );
}

function AttendanceToast(p: KioskViewProps) {
  return (
    <div
      className={`fixed left-1/2 top-6 z-[100] flex min-w-[300px] -translate-x-1/2 items-center gap-3.5 rounded-2xl border border-line bg-panel px-[22px] py-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-transform duration-[350ms] ${
        p.toast.show ? "translate-y-0" : "-translate-y-[140%]"
      }`}
      style={{ transitionTimingFunction: "cubic-bezier(0.2,0.9,0.3,1.3)" }}
    >
      <EmployeeAvatar photo={p.toast.emp?.photo} sizeClass="w-11 h-11" bordered />
      <div>
        <div className="font-bold text-[15px]">{p.toast.emp?.name || "—"}</div>
        <div className="mt-0.5 text-ink-dim text-xs">
          {p.toast.emp && (
            <>
              <span
                className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wide ${badgeClass(p.toast.type)}`}
              >
                {p.toast.type === "IN" ? "CHECKED IN" : "CHECKED OUT"}
              </span>
              &nbsp;{fmtTime(p.toast.ts)}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Scanner(p: KioskViewProps) {
  return (
    <div className="relative flex-shrink-0 w-[320px] md:w-[440px] h-[320px] md:h-[440px]">
      <div
        ref={p.scanFrameRef}
        className="relative h-full w-full overflow-hidden rounded-[20px] border border-line bg-black shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_20px_60px_rgba(0,0,0,0.5)]"
      >
        <video
          ref={p.videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover mirrored"
        />
        <canvas ref={p.overlayRef} className="absolute inset-0 w-full h-full mirrored" />
        <div className="right-3.5 left-3.5 absolute bg-gradient-to-r from-transparent via-scan to-transparent opacity-80 h-0.5 animate-sweep" />
        {(["tl", "tr", "bl", "br"] as const).map((corner) => (
          <div key={corner} className={cornerClass(corner, p.scanMatch)} />
        ))}
      </div>
      <div className="right-0 -bottom-[38px] left-0 absolute text-[13px] text-ink-dim text-center tracking-wide">
        {p.scanStatus}
      </div>
    </div>
  );
}

function Summary(p: KioskViewProps) {
  return (
    <div className="flex-shrink-0 w-full md:w-[340px] max-w-[400px]">
      <div className="bg-panel p-[22px] border border-line rounded-card">
        <h2 className="mb-3.5 text-ink-dim text-xs uppercase tracking-[1.5px]">
          Last check-in
        </h2>
        {p.lastEvent ? (
          <div className="flex items-center gap-3.5">
            <EmployeeAvatar
              photo={p.lastEvent.emp.photo}
              sizeClass="w-[52px] h-[52px]"
              bordered
            />
            <div>
              <div className="font-semibold text-[15px]">{p.lastEvent.emp.name}</div>
              <div className="mt-0.5 text-ink-dim text-xs">
                {p.lastEvent.emp.extId}
                {p.lastEvent.emp.dept ? ` · ${p.lastEvent.emp.dept}` : ""}
              </div>
              <span
                className={`mt-1.5 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wide ${badgeClass(p.lastEvent.entry.type)}`}
              >
                {p.lastEvent.entry.type === "IN" ? "CHECKED IN" : "CHECKED OUT"} ·{" "}
                {fmtTime(p.lastEvent.entry.ts)}
              </span>
            </div>
          </div>
        ) : (
          <div className="text-[13px] text-ink-dim leading-relaxed">
            No one has checked in yet today. Once someone scans in, their details will appear here.
          </div>
        )}
      </div>

      <div className="bg-panel mt-4 p-[22px] border border-line rounded-card">
        <h2 className="mb-3.5 text-ink-dim text-xs uppercase tracking-[1.5px]">Today</h2>
        <StatRow label="Checked in" value={p.statIn} />
        <StatRow label="Checked out" value={p.statOut} />
        <StatRow label="Registered people" value={p.statPeople} last />
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
  );
}

function StatRow({ label, value, last }: { label: string; value: number; last?: boolean }) {
  return (
    <div
      className={`flex items-baseline justify-between py-1.5 ${
        last ? "" : "border-b border-dashed border-line"
      }`}
    >
      <span className="text-[12.5px] text-ink-dim">{label}</span>
      <span className="font-mono font-bold">{value}</span>
    </div>
  );
}

function cornerClass(corner: "tl" | "tr" | "bl" | "br", match: boolean) {
  const base = "absolute h-[34px] w-[34px] opacity-85 transition-colors";
  const color = match ? "border-in" : "border-scan";
  const positions = {
    tl: "left-3.5 top-3.5 rounded-tl-md border-l-[3px] border-t-[3px]",
    tr: "right-3.5 top-3.5 rounded-tr-md border-r-[3px] border-t-[3px]",
    bl: "bottom-3.5 left-3.5 rounded-bl-md border-b-[3px] border-l-[3px]",
    br: "bottom-3.5 right-3.5 rounded-br-md border-b-[3px] border-r-[3px]",
  };
  return `${base} ${color} ${positions[corner]}`;
}
