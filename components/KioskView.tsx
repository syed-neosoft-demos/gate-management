"use client";

import KioskMain from "@/components/kiosk/KioskMain";
import PinGate from "@/components/kiosk/PinGate";
import RegisterPanel from "@/components/kiosk/RegisterPanel";
import AdminPanel from "@/components/kiosk/AdminPanel";
import { KioskViewProps } from "@/components/kiosk/types";

export default function KioskView(props: KioskViewProps) {
  return (
    <>
      <KioskMain {...props} />
      <PinGate {...props} />
      <RegisterPanel {...props} />
      <AdminPanel {...props} />
    </>
  );
}
