import { Dispatch, MutableRefObject, SetStateAction, useState } from "react";
import { Employee, LogEntry, Settings, isoDate } from "@/lib/types";
import {
  createAttendanceCsv,
  downloadTextFile,
  filterLogs,
  sortEmployees,
} from "@/lib/kiosk-utils";
import { faceGateStorage } from "@/lib/storage";

interface AdminOptions {
  employees: Employee[];
  logs: LogEntry[];
  settings: Settings;
  setEmployees: Dispatch<SetStateAction<Employee[]>>;
  setLogs: Dispatch<SetStateAction<LogEntry[]>>;
  setSettings: Dispatch<SetStateAction<Settings>>;
  clearLastEvent: () => void;
  scanPausedRef: MutableRefObject<boolean>;
}

export function useAdminDashboard(options: AdminOptions) {
  const {
    employees,
    logs,
    settings,
    setEmployees,
    setLogs,
    setSettings,
    clearLastEvent,
    scanPausedRef,
  } = options;
  const [adminOpen, setAdminOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"logs" | "people" | "settings">("logs");
  const [logDate, setLogDateValue] = useState(isoDate(Date.now()));
  const [filterDate, setFilterDate] = useState<string | undefined>(logDate);
  const [organizationName, setOrganizationName] = useState("");
  const [newPin, setNewPin] = useState("");
  const [message, setMessage] = useState({ text: "", ok: false });

  const open = () => {
    scanPausedRef.current = true;
    setOrganizationName(settings.orgName || "");
    setActiveTab("logs");
    setAdminOpen(true);
  };

  const close = () => {
    setAdminOpen(false);
    scanPausedRef.current = false;
  };

  const setLogDate = (value: string) => {
    setLogDateValue(value);
    setFilterDate(value);
  };

  const removePerson = async (employee: Employee) => {
    if (
      !confirm(
        `Remove ${employee.name}? Their past attendance logs will be kept, but they'll need to re-register to check in again.`,
      )
    ) {
      return;
    }
    try {
      await faceGateStorage.employees.remove(employee.id);
      setEmployees((current) => current.filter((item) => item.id !== employee.id));
    } catch (error) {
      console.error("Could not remove employee", error);
      alert("Could not remove this person. Please try again.");
    }
  };

  const saveSettings = async () => {
    const orgName = organizationName.trim();
    const pin = newPin.trim();
    if (pin && !/^\d{4}$/.test(pin)) {
      setMessage({ text: "PIN must be exactly 4 digits.", ok: false });
      return;
    }
    const nextSettings = {
      pin: pin || settings.pin,
      orgName: orgName || settings.orgName,
    };
    try {
      await faceGateStorage.settings.save(nextSettings);
      setSettings(nextSettings);
      setMessage({ text: "Settings saved.", ok: true });
      setNewPin("");
      setTimeout(() => setMessage({ text: "", ok: false }), 2200);
    } catch (error) {
      console.error("Could not save settings", error);
      setMessage({ text: "Could not save settings. Please try again.", ok: false });
    }
  };

  const resetAll = async () => {
    if (
      !confirm(
        "This will permanently delete all registered people and attendance logs from this device. Continue?",
      ) ||
      !confirm("Are you absolutely sure? This cannot be undone.")
    ) {
      return;
    }
    try {
      await faceGateStorage.clearPeopleAndAttendance();
      setEmployees([]);
      setLogs([]);
      clearLastEvent();
    } catch (error) {
      console.error("Could not erase kiosk data", error);
      alert("Could not erase the data. Please try again.");
    }
  };

  const visibleLogs = filterLogs(logs, filterDate);
  const exportCsv = () => {
    downloadTextFile(
      createAttendanceCsv(visibleLogs),
      `attendance_${filterDate || "all"}.csv`,
      "text/csv",
    );
  };

  return {
    adminOpen,
    activeTab,
    setActiveTab,
    logDate,
    setLogDate,
    showAllDates: () => setFilterDate(undefined),
    filteredLogs: visibleLogs,
    sortedPeople: sortEmployees(employees),
    organizationName,
    setOrganizationName,
    newPin,
    setNewPin,
    message,
    open,
    close,
    removePerson,
    saveSettings,
    resetAll,
    exportCsv,
  };
}
