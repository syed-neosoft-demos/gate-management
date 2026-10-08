import { KioskViewProps } from "@/components/kiosk/types";

const KEYS = [
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

export default function PinGate(p: KioskViewProps) {
  return (
    <div
      className={`${
        p.pinOpen ? "flex" : "hidden"
      } fixed inset-0 z-50 items-center justify-center bg-[rgba(5,8,11,0.78)] p-6 backdrop-blur-md`}
    >
      <div className="bg-panel shadow-[0_30px_80px_rgba(0,0,0,0.6)] p-7 border border-line rounded-[18px] w-full max-w-[380px]">
        <h2 className="m-0 mb-1 font-bold text-[17px]">Admin access</h2>
        <p className="m-0 text-[13px] text-ink-dim">Enter the 4-digit admin PIN</p>
        <div className="flex justify-center gap-2.5 my-[18px]">
          {[0, 1, 2, 3].map((index) => (
            <span
              key={index}
              className={`h-3.5 w-3.5 rounded-full border-2 transition-all ${
                index < p.pinBuffer.length
                  ? "border-scan bg-scan"
                  : "border-line bg-transparent"
              }`}
            />
          ))}
        </div>
        <div className="mt-2 h-4 text-[12.5px] text-danger text-center">{p.pinError}</div>
        <div className="gap-2.5 grid grid-cols-3 mt-2">
          {KEYS.map((key) => (
            <button
              key={key}
              onClick={() => p.pressKey(key)}
              className="bg-panel-2 py-4 border border-line hover:border-scan rounded-[10px] font-mono font-semibold text-[17px] text-ink"
            >
              {key === "clear" ? "C" : key === "back" ? "⌫" : key}
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
