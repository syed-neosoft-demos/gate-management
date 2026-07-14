import { KioskViewProps } from "@/components/kiosk/types";
import LogsTab from "@/components/kiosk/admin/LogsTab";
import PeopleTab from "@/components/kiosk/admin/PeopleTab";
import SettingsTab from "@/components/kiosk/admin/SettingsTab";

const TABS = ["logs", "people", "settings"] as const;

export default function AdminPanel(p: KioskViewProps) {
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
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => p.setActiveTab(tab)}
              className={`whitespace-nowrap border-b-2 px-1.5 py-3.5 text-[13.5px] font-semibold ${
                p.activeTab === tab
                  ? "border-scan text-ink"
                  : "border-transparent text-ink-dim"
              }`}
            >
              {tab === "logs" ? "Attendance log" : tab === "people" ? "People" : "Settings"}
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
