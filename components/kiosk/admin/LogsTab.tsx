import { fmtDate, fmtTime } from "@/lib/types";
import { KioskViewProps } from "@/components/kiosk/types";
import { badgeClass, EmployeeAvatar } from "@/components/kiosk/ui";

export default function LogsTab(p: KioskViewProps) {
  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <input
            type="date"
            value={p.logDate}
            onChange={(event) => p.setLogDate(event.target.value)}
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
                {["", "Name", "ID", "Type", "Date", "Time"].map((heading) => (
                  <th
                    key={heading}
                    className="px-2.5 py-2.5 border-line border-b font-semibold text-[11.5px] text-ink-dim text-left uppercase tracking-wide"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {p.filteredLogs.map((entry) => {
                const employee = p.employees.find((item) => item.id === entry.empId);
                return (
                  <tr key={entry.id}>
                    <td className="px-2.5 py-2.5 border-line border-b">
                      <EmployeeAvatar photo={employee?.photo} />
                    </td>
                    <td className="px-2.5 py-2.5 border-line border-b">{entry.name}</td>
                    <td className="px-2.5 py-2.5 border-line border-b font-mono">
                      {entry.extId || "—"}
                    </td>
                    <td className="px-2.5 py-2.5 border-line border-b">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wide ${badgeClass(entry.type)}`}
                      >
                        {entry.type}
                      </span>
                    </td>
                    <td className="px-2.5 py-2.5 border-line border-b">{fmtDate(entry.ts)}</td>
                    <td className="px-2.5 py-2.5 border-line border-b font-mono">
                      {fmtTime(entry.ts)}
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
