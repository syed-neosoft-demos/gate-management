"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as faceapi from "face-api.js";
import { Employee, LogEntry, Settings, isoDate, uid } from "@/lib/types";
import { attendanceStats, filterLogs, nextAttendanceType } from "@/lib/kiosk-utils";
import { faceGateStorage } from "@/lib/storage";
import { useAdminDashboard } from "@/hooks/useAdminDashboard";
import { useClock } from "@/hooks/useClock";
import { useRegistration } from "@/hooks/useRegistration";
import KioskView from "@/components/KioskView";

const MODEL_URL =
  "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights";
const COOLDOWN_MS = 15_000;

export default function Kiosk() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [settings, setSettings] = useState<Settings>({
    pin: "1234",
    orgName: "FaceGate",
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
  const [loadingText, setLoadingText] = useState("Loading face recognition models…");
  const [appVisible, setAppVisible] = useState(false);
  const modelsReadyRef = useRef(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const scanFrameRef = useRef<HTMLDivElement>(null);
  const mainStreamRef = useRef<MediaStream | null>(null);
  const scanPausedRef = useRef(false);
  const recentMatchRef = useRef<Record<string, number>>({});
  const rafRef = useRef<number | null>(null);
  const [scanStatus, setScanStatus] = useState("Position your face in the frame");
  const [scanMatch, setScanMatch] = useState(false);
  const [lastEvent, setLastEvent] = useState<{ entry: LogEntry; emp: Employee } | null>(null);

  const [toast, setToast] = useState<{
    show: boolean;
    emp: Employee | null;
    type: "IN" | "OUT";
    ts: number;
  }>({ show: false, emp: null, type: "IN", ts: 0 });
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((emp: Employee, type: "IN" | "OUT", ts: number) => {
    setToast({ show: true, emp, type, ts });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(
      () => setToast((current) => ({ ...current, show: false })),
      3200,
    );
  }, []);

  const startMainCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 480, height: 480 },
      });
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
      setScanStatus("Camera access denied. Allow camera permission and reload the page.");
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
        new faceapi.LabeledFaceDescriptors(person.id, [new Float32Array(person.descriptor)]),
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

      const employee = employeesRef.current.find((item) => item.id === employeeId);
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
          setScanStatus(`${employee.name} — ${type === "IN" ? "checked in" : "checked out"}`);
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
    if (!scanPausedRef.current && video?.readyState === 4 && overlay) {
      const detection = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224 }))
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
          setScanStatus("Face not recognized — register below if you're new");
        } else {
          setScanStatus("No one is registered yet on this kiosk");
        }
      } else {
        setScanMatch(false);
        setScanStatus("Position your face in the frame");
      }
    }
    rafRef.current = requestAnimationFrame(scanLoop);
  }, [handleMatch]);

  useEffect(() => {
    let cancelled = false;
    async function initialize() {
      try {
        await Promise.all([
          faceGateStorage.initialize(),
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        const [storedEmployees, storedLogs, storedSettings] = await Promise.all([
          faceGateStorage.employees.list(),
          faceGateStorage.attendance.list(),
          faceGateStorage.settings.get(),
        ]);
        if (cancelled) return;
        setEmployees(storedEmployees);
        setLogs(storedLogs);
        setSettings(storedSettings);
        employeesRef.current = storedEmployees;
        logsRef.current = storedLogs;
        buildMatcher(storedEmployees);

        const latestEntry = filterLogs(storedLogs, isoDate(Date.now()))[0];
        const latestEmployee = storedEmployees.find((item) => item.id === latestEntry?.empId);
        if (latestEntry && latestEmployee) setLastEvent({ entry: latestEntry, emp: latestEmployee });

        modelsReadyRef.current = true;
        setLoadingScreenVisible(false);
        setAppVisible(true);
        await startMainCamera();
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
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      mainStreamRef.current?.getTracks().forEach((track) => track.stop());
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
    // The scan loop is intentionally initialized once for the camera lifecycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const registration = useRegistration({ modelsReadyRef, scanPausedRef, setEmployees });
  const admin = useAdminDashboard({
    employees,
    logs,
    settings,
    setEmployees,
    setLogs,
    setSettings,
    clearLastEvent: () => setLastEvent(null),
    scanPausedRef,
  });
  const [pinOpen, setPinOpen] = useState(false);
  const [pinBuffer, setPinBuffer] = useState("");
  const [pinError, setPinError] = useState("");
  const openPinGate = () => {
    setPinBuffer("");
    setPinError("");
    setPinOpen(true);
  };
  const pressKey = (key: string) => {
    let next = pinBuffer;
    if (key === "clear") next = "";
    else if (key === "back") next = pinBuffer.slice(0, -1);
    else if (pinBuffer.length < 4) next = pinBuffer + key;
    setPinBuffer(next);
    if (next.length !== 4) return;
    if (next === settings.pin) {
      setPinOpen(false);
      admin.open();
    } else {
      setPinError("Incorrect PIN, try again");
      setTimeout(() => setPinBuffer(""), 250);
    }
  };

  const stats = attendanceStats(logs);
  return (
    <KioskView
      loadingScreenVisible={loadingScreenVisible}
      loadingText={loadingText}
      appVisible={appVisible}
      orgName={settings.orgName}
      clockTime={clock.time}
      clockDate={clock.date}
      openPinGate={openPinGate}
      videoRef={videoRef}
      overlayRef={overlayRef}
      scanFrameRef={scanFrameRef}
      scanMatch={scanMatch}
      scanStatus={scanStatus}
      lastEvent={lastEvent}
      statIn={stats.in}
      statOut={stats.out}
      statPeople={employees.length}
      openRegister={registration.open}
      toast={toast}
      pinOpen={pinOpen}
      pinBuffer={pinBuffer}
      pinError={pinError}
      pressKey={pressKey}
      closePinGate={() => setPinOpen(false)}
      registerOpen={registration.registerOpen}
      regVideoRef={registration.videoRef}
      samples={registration.samples}
      captureHint={registration.captureHint}
      captureSample={registration.capture}
      regName={registration.name}
      setRegName={registration.setName}
      regId={registration.employeeId}
      setRegId={registration.setEmployeeId}
      regDept={registration.department}
      setRegDept={registration.setDepartment}
      regError={registration.error}
      canSave={registration.canSave}
      savePerson={registration.save}
      closeRegister={registration.close}
      adminOpen={admin.adminOpen}
      closeAdmin={admin.close}
      activeTab={admin.activeTab}
      setActiveTab={admin.setActiveTab}
      logDate={admin.logDate}
      setLogDate={admin.setLogDate}
      showAllDates={admin.showAllDates}
      filteredLogs={admin.filteredLogs}
      employees={employees}
      exportCsv={admin.exportCsv}
      sortedPeople={admin.sortedPeople}
      removePerson={admin.removePerson}
      openRegisterFromAdmin={() => {
        admin.close();
        void registration.open();
      }}
      settingsOrgName={admin.organizationName}
      setSettingsOrgName={admin.setOrganizationName}
      settingsNewPin={admin.newPin}
      setSettingsNewPin={admin.setNewPin}
      settingsMsg={admin.message}
      saveSettings={admin.saveSettings}
      resetAll={admin.resetAll}
    />
  );
}

function drawDetection(context: CanvasRenderingContext2D | null, box: faceapi.Box) {
  if (!context) return;
  context.strokeStyle = "rgba(82,227,194,0.9)";
  context.lineWidth = 2;
  context.strokeRect(box.x, box.y, box.width, box.height);
}
