"use client";

import Link from "next/link";
import { useAdminContext } from "@/components/admin/AdminProvider";
import { useRegistration } from "@/hooks/useRegistration";

const input =
  "mt-2 bg-panel-2 px-3 py-3 border border-line focus:border-scan rounded-lg outline-none w-full text-ink text-sm disabled:opacity-50";
export default function EmployeeRegistration() {
  const admin = useAdminContext();
  const registration = useRegistration(admin.addEmployee);
  return (
    <section>
      <Link href="/admin/employees" className="text-sm text-scan">
        ← Back to employees
      </Link>
      <h1 className="font-display font-bold text-2xl mt-5 mb-2">
        Register an employee
      </h1>
      <p className="text-sm text-ink-dim mb-7">
        Capture three face samples, then save the employee&apos;s details. Only
        admins and super admins can register employees.
      </p>
      <div className="grid md:grid-cols-[320px_1fr] gap-8 bg-panel border border-line rounded-2xl p-5 sm:p-7">
        <div>
          <div className="bg-black border border-line rounded-2xl aspect-square overflow-hidden">
            <video
              ref={registration.videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover mirrored"
            />
          </div>
          <div className="flex justify-center gap-2 mt-4">
            {[0, 1, 2].map((index) => (
              <span
                key={index}
                className={`flex h-9 w-9 items-center justify-center rounded-lg border text-sm ${index < registration.samples.length ? "border-in bg-in/10 text-in" : "border-line bg-panel-2 text-ink-dim"}`}
              >
                {index + 1}
              </span>
            ))}
          </div>
          <p
            role="status"
            className="text-xs text-ink-dim text-center my-4 min-h-8"
          >
            {registration.loading
              ? "Starting camera and loading face models…"
              : registration.captureHint}
          </p>
          <button
            disabled={
              !registration.ready ||
              registration.busy ||
              registration.samples.length >= 3 ||
              registration.saved
            }
            onClick={() => {
              void registration.capture();
            }}
            className="bg-scan disabled:opacity-50 px-4 py-3 rounded-lg w-full font-semibold text-[#04241d] text-sm"
          >
            {registration.busy ? "Please wait…" : "Capture sample"}
          </button>
          {!registration.ready && !registration.loading && (
            <button
              onClick={() => {
                void registration.initialize();
              }}
              className="mt-3 text-scan text-sm w-full"
            >
              Retry camera and models
            </button>
          )}
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void registration.save();
          }}
        >
          <fieldset
            disabled={registration.saved || registration.busy}
            className="space-y-5"
          >
            <label className="block text-xs text-ink-dim">
              Full name
              <input
                required
                maxLength={256}
                autoComplete="name"
                value={registration.name}
                onChange={(event) => registration.setName(event.target.value)}
                className={input}
              />
            </label>
            <label className="block text-xs text-ink-dim">
              Employee ID
              <input
                maxLength={256}
                value={registration.employeeId}
                onChange={(event) =>
                  registration.setEmployeeId(event.target.value)
                }
                className={input}
              />
            </label>
            <label className="block text-xs text-ink-dim">
              Department
              <input
                maxLength={256}
                value={registration.department}
                onChange={(event) =>
                  registration.setDepartment(event.target.value)
                }
                className={input}
              />
            </label>
          </fieldset>
          <p
            role="alert"
            className={`text-sm mt-5 ${registration.error.ok ? "text-in" : "text-danger"}`}
          >
            {registration.error.text}
          </p>
          <button
            disabled={!registration.canSave}
            className="bg-scan disabled:opacity-50 mt-5 px-5 py-3 rounded-lg w-full font-semibold text-[#04241d] text-sm"
          >
            {registration.saved ? "Employee registered" : "Save employee"}
          </button>
          <Link
            href="/admin/employees"
            className="block text-center mt-3 px-5 py-3 border border-line rounded-lg text-sm text-ink-dim"
          >
            {registration.saved ? "Return to employees" : "Cancel"}
          </Link>
        </form>
      </div>
    </section>
  );
}
