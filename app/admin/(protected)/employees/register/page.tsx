import { requireAdminPage } from "@/lib/admin-page-auth";
import EmployeeRegistrationPage from "@/components/admin/EmployeeRegistrationPage";

export default async function Page() {
  await requireAdminPage();
  return <EmployeeRegistrationPage />;
}
