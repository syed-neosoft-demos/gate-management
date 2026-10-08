"use client";

import dynamic from "next/dynamic";

const Kiosk = dynamic(() => import("@/components/kiosk/Kiosk"), {
  ssr: false,
  loading: () => (
    <div className="z-[200] fixed inset-0 flex flex-col justify-center items-center gap-4 bg-bg">
      <div className="border-[3px] border-line border-t-scan rounded-full w-[34px] h-[34px] animate-spin" />
      <p className="text-[13px] text-ink-dim">
        Loading face recognition models…
      </p>
    </div>
  ),
});

export default function Home() {
  return <Kiosk />;
}
