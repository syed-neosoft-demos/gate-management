import { PHASE_PRODUCTION_BUILD } from "next/constants";

/** Next.js runs this when a server instance starts, after loading environment files. */
export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.NEXT_PHASE !== PHASE_PRODUCTION_BUILD
  ) {
    const { ensureDefaultSuperAdmin } = await import("@/lib/admin-bootstrap");
    await ensureDefaultSuperAdmin();
  }
}
