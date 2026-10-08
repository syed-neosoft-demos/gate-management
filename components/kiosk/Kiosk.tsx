"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as faceapi from "face-api.js";
import { Employee, LogEntry, Settings, isoDate, uid } from "@/lib/types";
import {
  attendanceStats,
  filterLogs,
  nextAttendanceType,
} from "@/lib/kiosk-utils";
import { faceGateStorage } from "@/lib/storage";
import { useClock } from "@/hooks/useClock";
import KioskScreen from "@/components/kiosk/KioskScreen";
import { loadFaceModels } from "@/lib/face-models";

const COOLDOWN_MS = 15_000;

export default function Kiosk() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [settings, setSettings] = useState<Settings>({
    orgName: "FaceGate",
    timeZone: "Asia/Kolkata",
  });
  const employeesRef = useRef<Employee[]>([]);
  const logsRef = useRef<LogEntry[]>([]);
  useEffect(() => {
    employeesRef.current = employees;
  }, [employees]);
  useEffect(() => {
    logsRef.current = logs;
  }, [logs]);

  const clock = useClock();
  const [loadingScreenVisible, setLoadingScreenVisible] = useState(true);
  const [loadingText, setLoadingText] = useState(
    "Loading face recognition models…",
  );
  const [appVisible, setAppVisible] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const scanFrameRef = useRef<HTMLDivElement>(null);
  const mainStreamRef = useRef<MediaStream | null>(null);
  const scannerActiveRef = useRef(false);
  const recentMatchRef = useRef<Record<string, number>>({});
  const rafRef = useRef<number | null>(null);
  const [scanStatus, setScanStatus] = useState(
    "Position your face in the frame",
  );
  const [scanMatch, setScanMatch] = useState(false);
  const [lastEvent, setLastEvent] = useState<{
    entry: LogEntry;
    emp: Employee;
  } | null>(null);

  const [toast, setToast] = useState<{
    show: boolean;
    emp: Employee | null;
    type: "IN" | "OUT";
    ts: number;
  }>({ show: false, emp: null, type: "IN", ts: 0 });
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback(
    (emp: Employee, type: "IN" | "OUT", ts: number) => {
      setToast({ show: true, emp, type, ts });
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(
        () => setToast((current) => ({ ...current, show: false })),
        3200,
      );
    },
    [],
  );

  const startMainCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 480, height: 480 },
      });
      if (!scannerActiveRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      mainStreamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await new Promise<void>((resolve) => {
        video.onloadedmetadata = () => resolve();
      });
      if (overlayRef.current) {
        overlayRef.current.width = video.videoWidth;
        overlayRef.current.height = video.videoHeight;
      }
    } catch {
      setScanStatus(
        "Camera access denied. Allow camera permission and reload the page.",
      );
    }
  }, []);

  const matcherRef = useRef<faceapi.FaceMatcher | null>(null);
  const buildMatcher = useCallback((people: Employee[]) => {
    if (!people.length) {
      matcherRef.current = null;
      return;
    }
    const descriptors = people.map(
      (person) =>
        new faceapi.LabeledFaceDescriptors(person.id, [
          new Float32Array(person.descriptor),
        ]),
    );
    matcherRef.current = new faceapi.FaceMatcher(descriptors, 0.5);
  }, []);
  useEffect(() => buildMatcher(employees), [employees, buildMatcher]);

  const handleMatch = useCallback(
    (employeeId: string) => {
      const now = Date.now();
      const previousMatch = recentMatchRef.current[employeeId];
      if (previousMatch && now - previousMatch < COOLDOWN_MS) return;
      recentMatchRef.current[employeeId] = now;

      const employee = employeesRef.current.find(
        (item) => item.id === employeeId,
      );
      if (!employee) return;
      const type = nextAttendanceType(logsRef.current, employeeId);
      const entry: LogEntry = {
        id: uid(),
        empId: employeeId,
        name: employee.name,
        extId: employee.extId,
        type,
        ts: now,
      };
      void faceGateStorage.attendance
        .add(entry)
        .then(() => {
          setLogs((current) => [...current, entry]);
          setScanStatus(
            `${employee.name} — ${type === "IN" ? "checked in" : "checked out"}`,
          );
          showToast(employee, type, now);
          setLastEvent({ entry, emp: employee });
        })
        .catch((error) => {
          delete recentMatchRef.current[employeeId];
          console.error("Could not persist attendance entry", error);
          setScanStatus("Could not save attendance. Please scan again.");
        });
    },
    [showToast],
  );

  const scanLoop = useCallback(async () => {
    const video = videoRef.current;
    const overlay = overlayRef.current;
    if (!scannerActiveRef.current) return;
    if (video?.readyState === 4 && overlay) {
      const detection = await faceapi
        .detectSingleFace(
          video,
          new faceapi.TinyFaceDetectorOptions({ inputSize: 224 }),
        )
        .withFaceLandmarks()
        .withFaceDescriptor();
      const context = overlay.getContext("2d");
      context?.clearRect(0, 0, overlay.width, overlay.height);
      if (detection) {
        setScanMatch(true);
        drawDetection(context, detection.detection.box);
        const match = matcherRef.current?.findBestMatch(detection.descriptor);
        if (match?.label && match.label !== "unknown") handleMatch(match.label);
        else if (matcherRef.current) {
          setScanStatus(
            "Face not recognized — ask an administrator to register you",
          );
        } else {
          setScanStatus("No one is registered yet on this kiosk");
        }
      } else {
        setScanMatch(false);
        setScanStatus("Position your face in the frame");
      }
    }
    if (scannerActiveRef.current)
      rafRef.current = requestAnimationFrame(scanLoop);
  }, [handleMatch]);

  useEffect(() => {
    let cancelled = false;
    async function initialize() {
      try {
        await Promise.all([faceGateStorage.initialize(), loadFaceModels()]);
        const [storedEmployees, storedLogs, storedSettings] = await Promise.all(
          [
            faceGateStorage.employees.list(),
            faceGateStorage.attendance.list(),
            faceGateStorage.settings.get(),
          ],
        );
        if (cancelled) return;
        setEmployees(storedEmployees);
        setLogs(storedLogs);
        setSettings(storedSettings);
        employeesRef.current = storedEmployees;
        logsRef.current = storedLogs;
        buildMatcher(storedEmployees);

        const latestEntry = filterLogs(storedLogs, isoDate(Date.now()))[0];
        const latestEmployee = storedEmployees.find(
          (item) => item.id === latestEntry?.empId,
        );
        if (latestEntry && latestEmployee)
          setLastEvent({ entry: latestEntry, emp: latestEmployee });

        scannerActiveRef.current = true;
        setLoadingScreenVisible(false);
        setAppVisible(true);
        await startMainCamera();
        if (cancelled) return;
        if (scannerActiveRef.current)
          rafRef.current = requestAnimationFrame(scanLoop);
      } catch (error) {
        console.error(error);
        setLoadingText(
          "Could not connect to Redis or load face recognition models. Check the server configuration and your connection, then reload.",
        );
      }
    }
    void initialize();
    return () => {
      cancelled = true;
      scannerActiveRef.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      mainStreamRef.current?.getTracks().forEach((track) => track.stop());
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
    // The scan loop is intentionally initialized once for the camera lifecycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pick up employees registered in the separate admin app without reloading the kiosk.
  useEffect(() => {
    if (!appVisible) return;
    let cancelled = false;
    let refreshing = false;
    const timer = setInterval(async () => {
      if (refreshing) return;
      refreshing = true;
      try {
        const [people, entries, organization] = await Promise.all([
          faceGateStorage.employees.list(),
          faceGateStorage.attendance.list(),
          faceGateStorage.settings.get(),
        ]);
        if (!cancelled) {
          setEmployees(people);
          setLogs(entries);
          setSettings(organization);
        }
      } catch {
        /* Keep the last successful snapshot and retry next interval. */
      } finally {
        refreshing = false;
      }
    }, 30000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [appVisible]);

  const stats = attendanceStats(logs);
  return (
    <KioskScreen
      loadingScreenVisible={loadingScreenVisible}
      loadingText={loadingText}
      appVisible={appVisible}
      orgName={settings.orgName}
      clockTime={clock.time}
      clockDate={clock.date}
      videoRef={videoRef}
      overlayRef={overlayRef}
      scanFrameRef={scanFrameRef}
      scanMatch={scanMatch}
      scanStatus={scanStatus}
      lastEvent={lastEvent}
      statIn={stats.in}
      statOut={stats.out}
      statPeople={employees.length}
      toast={toast}
    />
  );
}

function drawDetection(
  context: CanvasRenderingContext2D | null,
  box: faceapi.Box,
) {
  if (!context) return;
  context.strokeStyle = "rgba(82,227,194,0.9)";
  context.lineWidth = 2;
  context.strokeRect(box.x, box.y, box.width, box.height);
}
