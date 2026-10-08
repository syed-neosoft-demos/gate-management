import { KioskViewProps } from "@/components/kiosk/types";
import { FieldLabel, TextInput } from "@/components/kiosk/ui";

export default function RegisterPanel(p: KioskViewProps) {
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
            <CaptureSection {...p} />
            <EmployeeForm {...p} />
          </div>
        </div>
      </div>
    </div>
  );
}

function CaptureSection(p: KioskViewProps) {
  return (
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
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className={`flex h-[34px] w-[34px] items-center justify-center rounded-lg border text-sm ${
              index < p.samples.length
                ? "border-in bg-in/[.14] text-in"
                : "border-line bg-panel-2 text-ink-dim"
            }`}
          >
            {index + 1}
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
  );
}

function EmployeeForm(p: KioskViewProps) {
  return (
    <div>
      <FieldLabel first>Full name</FieldLabel>
      <TextInput value={p.regName} onChange={p.setRegName} placeholder="e.g. Priya Sharma" />
      <FieldLabel>Employee / Student ID</FieldLabel>
      <TextInput value={p.regId} onChange={p.setRegId} placeholder="e.g. EMP-014" />
      <FieldLabel>Department / Class</FieldLabel>
      <TextInput
        value={p.regDept}
        onChange={p.setRegDept}
        placeholder="e.g. Accounts, Grade 10-B"
      />
      <div className={`mt-2 text-[12.5px] ${p.regError.ok ? "text-in" : "text-danger"}`}>
        {p.regError.text}
      </div>
      <button
        disabled={!p.canSave}
        onClick={p.savePerson}
        className="bg-scan disabled:opacity-50 hover:brightness-[1.08] mt-5 px-[18px] py-3 rounded-[10px] w-full font-semibold text-[#04241d] text-[13.5px] disabled:cursor-not-allowed"
      >
        Save &amp; finish
      </button>
      <button
        onClick={p.closeRegister}
        className="bg-transparent mt-2.5 px-[18px] py-3 border border-line hover:border-scan rounded-[10px] w-full font-semibold text-[13.5px] text-ink-dim hover:text-ink"
      >
        Cancel
      </button>
    </div>
  );
}
