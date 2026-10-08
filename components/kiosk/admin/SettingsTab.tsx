import { KioskViewProps } from "@/components/kiosk/types";
import { FieldLabel, TextInput } from "@/components/kiosk/ui";

export default function SettingsTab(p: KioskViewProps) {
  return (
    <div>
      <FieldLabel first>Organization name (shown on the kiosk header)</FieldLabel>
      <TextInput value={p.settingsOrgName} onChange={p.setSettingsOrgName} />
      <FieldLabel>Change admin PIN (4 digits)</FieldLabel>
      <input
        type="text"
        maxLength={4}
        value={p.settingsNewPin}
        onChange={(event) => p.setSettingsNewPin(event.target.value)}
        placeholder="e.g. 4821"
        className="bg-panel-2 px-[13px] py-[11px] border border-line focus:border-scan rounded-[9px] outline-none w-full text-ink text-sm"
      />
      <button
        onClick={p.saveSettings}
        className="bg-scan hover:brightness-[1.08] mt-3.5 px-[18px] py-3 rounded-[10px] font-semibold text-[#04241d] text-[13.5px]"
      >
        Save settings
      </button>
      <div className={`mt-2 text-[12.5px] ${p.settingsMsg.ok ? "text-in" : "text-danger"}`}>
        {p.settingsMsg.text}
      </div>

      <div className="mt-8 pt-[22px] border-line border-t">
        <h2 className="opacity-90 text-danger text-xs uppercase tracking-[1.5px]">Danger zone</h2>
        <p className="mt-2 mb-3 text-[12.5px] text-ink-dim">
          Permanently erase all registered people and attendance logs from the shared database for all kiosks. This cannot
          be undone.
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
