export type AdminRole = "admin" | "superadmin";
export type AdminUser = {
  username: string;
  name: string;
  role: AdminRole;
  mustChangePassword: boolean;
  createdAt: number;
  lastLoginAt?: number;
};
export type AdminAccount = AdminUser & { passwordHash: string; version: number };
export type AdminAudit = {
  id: string;
  ts: number;
  actor: string;
  role: AdminRole | "anonymous";
  action: string;
  target?: string;
  outcome: "success" | "failure";
  ip: string;
  userAgent: string;
};
