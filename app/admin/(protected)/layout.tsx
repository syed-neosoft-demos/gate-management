import { requireAdminPage } from "@/lib/admin-page-auth";
import { AdminProvider } from "@/components/admin/AdminProvider";
import AdminShell from "@/components/admin/AdminShell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAdminPage();
  return (
    <AdminProvider user={user}>
      <AdminShell>{children}</AdminShell>
    </AdminProvider>
  );
}
