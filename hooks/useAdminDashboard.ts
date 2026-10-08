import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Employee, LogEntry, Settings } from "@/lib/types";
import { AdminUser } from "@/lib/admin-types";
import { adminRequest, AdminRequestError } from "@/lib/admin-client";
import { AdminDashboardProps } from "@/components/admin/types";
import {
  createAttendanceCsv,
  downloadTextFile,
  sortEmployees,
} from "@/lib/kiosk-utils";
import { attendanceDate } from "@/lib/attendance-report";
import { faceGateStorage } from "@/lib/storage";

export function useAdminDashboard(initialUser: AdminUser): AdminDashboardProps {
  const router = useRouter();
  const [user, setUser] = useState(initialUser);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [settings, setSettings] = useState<Settings>({
    orgName: "FaceGate",
    timeZone: "Asia/Kolkata",
  });
  const [reportMonth, setReportMonth] = useState(
    attendanceDate(Date.now(), settings.timeZone).slice(0, 7),
  );
  const [reportEmployeeId, setReportEmployeeId] = useState("all");
  const [logDate, setLogDateValue] = useState(
    attendanceDate(Date.now(), settings.timeZone),
  );
  const [filterDate, setFilterDate] = useState<string | undefined>(logDate);
  const [organizationName, setOrganizationName] = useState("");
  const [timeZone, setTimeZone] = useState(settings.timeZone);
  const [message, setMessage] = useState({ text: "", ok: false });
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshError, setRefreshError] = useState("");

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setRefreshError("");
    try {
      const session = await adminRequest<{ user: AdminUser }>("session");
      if (session.user.mustChangePassword) {
        router.replace("/admin/login");
        router.refresh();
        return;
      }
      setUser(session.user);
      await faceGateStorage.initialize();
      try {
        await faceGateStorage.migrateLegacyData();
      } catch (error) {
        setRefreshError(
          `Could not import older browser data: ${error instanceof Error ? error.message : "Please retry."}`,
        );
      }
      const [storedEmployees, storedLogs, storedSettings] = await Promise.all([
        faceGateStorage.employees.list(),
        faceGateStorage.attendance.list(),
        faceGateStorage.settings.get(),
      ]);
      setEmployees(storedEmployees);
      setLogs(storedLogs);
      setSettings(storedSettings);
      setOrganizationName(storedSettings.orgName);
      setTimeZone(storedSettings.timeZone);
    } catch (error) {
      if (error instanceof AdminRequestError && error.status === 401) {
        router.replace("/admin/login");
        router.refresh();
      } else
        setRefreshError(
          error instanceof Error ? error.message : "Could not refresh reports.",
        );
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [router]);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signOut = async () => {
    try {
      await adminRequest("logout", {});
      router.replace("/admin/login");
      router.refresh();
    } catch (error) {
      setRefreshError(
        error instanceof Error ? error.message : "Could not sign out.",
      );
    }
  };
  const setLogDate = (value: string) => {
    setLogDateValue(value);
    setFilterDate(value);
  };
  const removePerson = async (employee: Employee) => {
    if (
      !confirm(
        `Remove ${employee.name}? Past attendance will be kept. They must be registered again by an administrator.`,
      )
    )
      return;
    try {
      await faceGateStorage.employees.remove(employee.id);
      setEmployees((current) =>
        current.filter((item) => item.id !== employee.id),
      );
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Could not remove this person.",
      );
    }
  };
  const saveSettings = async () => {
    const nextSettings = {
      orgName: organizationName.trim() || settings.orgName,
      timeZone: timeZone.trim(),
    };
    try {
      await faceGateStorage.settings.save(nextSettings);
      setSettings(nextSettings);
      setMessage({ text: "Settings saved.", ok: true });
    } catch (error) {
      setMessage({
        text:
          error instanceof Error ? error.message : "Could not save settings.",
        ok: false,
      });
    }
  };
  const resetAll = async () => {
    if (
      !confirm(
        "Permanently delete all registered people, photos and attendance logs for every kiosk? Admin accounts and access logs will be retained.",
      ) ||
      !confirm("This cannot be undone. Continue?")
    )
      return;
    try {
      await faceGateStorage.clearPeopleAndAttendance();
      setEmployees([]);
      setLogs([]);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not erase data.");
    }
  };
  const visibleLogs = logs
    .filter(
      (entry) =>
        !filterDate ||
        attendanceDate(entry.ts, settings.timeZone) === filterDate,
    )
    .slice()
    .sort((a, b) => b.ts - a.ts);
  return {
    adminUser: user,
    setAdminUser: setUser,
    employees,
    logs,
    sortedPeople: sortEmployees(employees),
    addEmployee: (employee) =>
      setEmployees((current) => [
        ...current.filter((item) => item.id !== employee.id),
        employee,
      ]),
    openEmployeeReport: (id) => {
      setReportEmployeeId(id);
      router.push("/admin/attendance");
    },
    reportMonth,
    setReportMonth,
    reportEmployeeId,
    setReportEmployeeId,
    reportTimeZone: settings.timeZone,
    logDate,
    setLogDate,
    showAllDates: () => setFilterDate(undefined),
    filteredLogs: visibleLogs,
    settingsOrgName: organizationName,
    setSettingsOrgName: setOrganizationName,
    settingsTimeZone: timeZone,
    setSettingsTimeZone: setTimeZone,
    settingsMsg: message,
    removePerson,
    saveSettings,
    resetAll,
    refreshAdmin: refresh,
    adminRefreshing: refreshing,
    adminLoading: loading,
    adminRefreshError: refreshError,
    signOut,
    exportCsv: () =>
      downloadTextFile(
        createAttendanceCsv(visibleLogs, settings.timeZone),
        `attendance_${filterDate || "all"}.csv`,
        "text/csv",
      ),
  };
}
