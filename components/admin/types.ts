import { Employee, LogEntry } from "@/lib/types";
import { AdminUser } from "@/lib/admin-types";

export interface AdminDashboardProps {
  adminUser: AdminUser;
  setAdminUser: (user: AdminUser) => void;
  employees: Employee[];
  logs: LogEntry[];
  sortedPeople: Employee[];
  addEmployee: (employee: Employee) => void;
  removePerson: (employee: Employee) => Promise<void>;
  openEmployeeReport: (id: string) => void;
  reportMonth: string;
  setReportMonth: (month: string) => void;
  reportEmployeeId: string;
  setReportEmployeeId: (id: string) => void;
  reportTimeZone: string;
  logDate: string;
  setLogDate: (date: string) => void;
  showAllDates: () => void;
  filteredLogs: LogEntry[];
  exportCsv: () => void;
  settingsOrgName: string;
  setSettingsOrgName: (value: string) => void;
  settingsTimeZone: string;
  setSettingsTimeZone: (value: string) => void;
  settingsMsg: { text: string; ok: boolean };
  saveSettings: () => Promise<void>;
  resetAll: () => Promise<void>;
  refreshAdmin: () => Promise<void>;
  adminRefreshing: boolean;
  adminLoading: boolean;
  adminRefreshError: string;
  signOut: () => Promise<void>;
}
