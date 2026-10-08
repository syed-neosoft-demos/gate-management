"use client";

import { useAdminContext } from "@/components/admin/AdminProvider";
import { FieldLabel, TextInput } from "@/components/shared/ui";

export default function OrganizationSettings() {
  const p = useAdminContext();
  if (p.adminUser?.role !== "superadmin")
    return (
      <p className="text-ink-dim text-sm">
        Organization settings require super admin access.
      </p>
    );
  return (
    <div>
      <FieldLabel first>Organization name</FieldLabel>
      <TextInput value={p.settingsOrgName} onChange={p.setSettingsOrgName} />
      <FieldLabel>Attendance time zone</FieldLabel>
      <TextInput
        value={p.settingsTimeZone}
        onChange={p.setSettingsTimeZone}
        placeholder="Asia/Kolkata"
      />
      <p className="mt-2 text-xs text-ink-dim">
        Use an IANA time zone, such as Asia/Kolkata, Europe/London, or
        America/New_York. Monthly reports use this time zone.
      </p>
      <button
        onClick={p.saveSettings}
        className="bg-scan mt-4 px-5 py-3 rounded-lg font-semibold text-[#04241d] text-sm"
      >
        Save settings
      </button>
      <p
        role="status"
        className={`mt-2 text-sm ${p.settingsMsg.ok ? "text-in" : "text-danger"}`}
      >
        {p.settingsMsg.text}
      </p>
      <div className="mt-8 pt-6 border-line border-t">
        <h3 className="text-danger text-xs uppercase tracking-wider">
          Danger zone
        </h3>
        <p className="my-3 text-sm text-ink-dim">
          Permanently erase all registered people, photos and attendance logs
          for every kiosk. Admin accounts and access logs will be retained.
        </p>
        <button
          onClick={p.resetAll}
          className="bg-danger/10 hover:bg-danger/20 px-5 py-3 rounded-lg font-semibold text-sm text-danger"
        >
          Erase attendance and people
        </button>
      </div>
    </div>
  );
}
