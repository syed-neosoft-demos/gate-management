import { requireAdminPage } from "@/lib/admin-page-auth";
import AdminAccess from "@/components/admin/AdminAccess";

export default async function Page() {
  await requireAdminPage();
  return <AdminAccess />;
}
