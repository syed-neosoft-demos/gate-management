import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminRole } from "@/lib/admin-types";
import {
  AdminError,
  getSessionFromToken,
  publicAdmin,
  SESSION_COOKIE,
} from "@/lib/admin-auth";

export const currentAdmin = cache(async () => {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    return publicAdmin(await getSessionFromToken(token, true));
  } catch (error) {
    if (error instanceof AdminError) return null;
    throw error;
  }
});

/** Check every protected page, as well as its shared layout and mutation APIs. */
export async function requireAdminPage(role?: AdminRole) {
  const user = await currentAdmin();
  if (!user || user.mustChangePassword) redirect("/admin/login");
  if (role === "superadmin" && user.role !== "superadmin")
    redirect("/admin/attendance");
  return user;
}
