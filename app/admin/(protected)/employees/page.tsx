import { requireAdminPage } from "@/lib/admin-page-auth";
import Employees from "@/components/admin/Employees";

export default async function Page() {
  await requireAdminPage();
  return <Employees />;
}
