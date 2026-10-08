"use client";

import { useAdminContext } from "@/components/admin/AdminProvider";
import Link from "next/link";
import { EmployeeAvatar } from "@/components/shared/ui";

export default function Employees() {
  const p = useAdminContext();
  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
        <span className="bg-panel-2 px-3 py-1.5 border border-line rounded-[20px] text-[12.5px] text-ink-dim">
          {p.sortedPeople.length} people
        </span>
        <Link
          href="/admin/employees/register"
          className="bg-scan hover:brightness-[1.08] px-[18px] py-3 rounded-[10px] font-semibold text-[#04241d] text-[13.5px]"
        >
          + Register employee
        </Link>
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
                  (heading, index) => (
                    <th
                      key={index}
                      className="px-2.5 py-2.5 border-line border-b font-semibold text-[11.5px] text-ink-dim text-left uppercase tracking-wide"
                    >
                      {heading}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {p.sortedPeople.map((employee) => (
                <tr key={employee.id}>
                  <td className="px-2.5 py-2.5 border-line border-b">
                    <EmployeeAvatar photo={employee.photo} />
                  </td>
                  <td className="px-2.5 py-2.5 border-line border-b">
                    {employee.name}
                  </td>
                  <td className="px-2.5 py-2.5 border-line border-b font-mono">
                    {employee.extId || "—"}
                  </td>
                  <td className="px-2.5 py-2.5 border-line border-b">
                    {employee.dept || "—"}
                  </td>
                  <td className="px-2.5 py-2.5 border-line border-b">
                    {new Date(employee.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-2.5 py-2.5 border-line border-b">
                    <button
                      onClick={() => {
                        p.openEmployeeReport(employee.id);
                      }}
                      className="mr-2 text-scan text-xs font-semibold"
                    >
                      Monthly report
                    </button>
                    <button
                      onClick={() => p.removePerson(employee)}
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
