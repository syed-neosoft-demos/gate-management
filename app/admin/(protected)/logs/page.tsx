import { requireAdminPage } from "@/lib/admin-page-auth";
import AttendanceLogs from "@/components/admin/AttendanceLogs";

export default async function Page() {
  await requireAdminPage();
  return <AttendanceLogs />;
}
