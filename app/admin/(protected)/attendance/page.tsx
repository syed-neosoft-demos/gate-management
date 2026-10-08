import { requireAdminPage } from "@/lib/admin-page-auth";
import AttendanceReport from "@/components/admin/AttendanceReport";

export default async function Page() {
  await requireAdminPage();
  return <AttendanceReport />;
}
