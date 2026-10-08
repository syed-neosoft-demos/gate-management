"use client";

import dynamic from "next/dynamic";
const EmployeeRegistration = dynamic(
  () => import("@/components/admin/EmployeeRegistration"),
  {
    ssr: false,
    loading: () => (
      <p className="text-sm text-ink-dim">Loading employee registration…</p>
    ),
  },
);
export default function EmployeeRegistrationPage() {
  return <EmployeeRegistration />;
}
