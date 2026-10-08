"use client";

import Link from "next/link";
export default function AdminErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="h-screen flex flex-col items-center justify-center gap-5 p-6">
      <h1 className="font-display font-bold text-xl">
        Could not load the admin pages
      </h1>
      <p className="text-sm text-ink-dim">Please try again.</p>
      <button
        onClick={reset}
        className="bg-scan text-[#04241d] px-5 py-3 rounded-lg"
      >
        Try again
      </button>
      <Link href="/" className="text-sm text-scan">
        Back to employee kiosk
      </Link>
    </div>
  );
}
