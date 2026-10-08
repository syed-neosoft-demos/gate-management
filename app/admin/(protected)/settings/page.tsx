import { requireAdminPage } from "@/lib/admin-page-auth";
import OrganizationSettings from "@/components/admin/OrganizationSettings";

export default async function Page() {
  await requireAdminPage("superadmin");
  return <OrganizationSettings />;
}
