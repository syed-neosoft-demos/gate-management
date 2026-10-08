import { RefObject } from "react";
import { Employee, LogEntry } from "@/lib/types";

export type LastEvent = { entry: LogEntry; emp: Employee } | null;
export interface KioskScreenProps {
  loadingScreenVisible: boolean;
  loadingText: string;
  appVisible: boolean;
  orgName: string;
  clockTime: string;
  clockDate: string;
  videoRef: RefObject<HTMLVideoElement>;
  overlayRef: RefObject<HTMLCanvasElement>;
  scanFrameRef: RefObject<HTMLDivElement>;
  scanMatch: boolean;
  scanStatus: string;
  lastEvent: LastEvent;
  statIn: number;
  statOut: number;
  statPeople: number;
  toast: {
    show: boolean;
    emp: Employee | null;
    type: "IN" | "OUT";
    ts: number;
  };
}
