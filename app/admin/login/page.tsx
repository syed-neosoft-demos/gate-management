import { redirect } from "next/navigation";
import { currentAdmin } from "@/lib/admin-page-auth";
import AdminLogin from "@/components/admin/AdminLogin";

export default async function LoginPage() {
  const user = await currentAdmin();
  if (user && !user.mustChangePassword) redirect("/admin/attendance");
  return <AdminLogin initialUser={user} />;
}
