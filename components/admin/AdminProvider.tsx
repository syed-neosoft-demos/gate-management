"use client";

import { createContext, useContext } from "react";
import { AdminUser } from "@/lib/admin-types";
import { useAdminDashboard } from "@/hooks/useAdminDashboard";
import { AdminDashboardProps } from "@/components/admin/types";

const AdminContext = createContext<AdminDashboardProps | null>(null);
export function AdminProvider({
  user,
  children,
}: {
  user: AdminUser;
  children: React.ReactNode;
}) {
  const dashboard = useAdminDashboard(user);
  return (
    <AdminContext.Provider value={dashboard}>{children}</AdminContext.Provider>
  );
}
export function useAdminContext() {
  const context = useContext(AdminContext);
  if (!context)
    throw new Error("Admin components must be rendered inside AdminProvider");
  return context;
}
