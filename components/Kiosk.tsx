"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as faceapi from "face-api.js";
import {
  Employee,
  LogEntry,
  Settings,
  uid,
  fmtTime,
  fmtDate,
  isoDate,
} from "@/lib/types";
import { dataUrlToBlob, faceGateStorage } from "@/lib/storage";
import KioskView from "@/components/KioskView";

const MODEL_URL =
  "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights";
const COOLDOWN_MS = 15000;

export default function Kiosk() {
  /* ---------------- persisted data ---------------- */
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [settings, setSettings] = useState<Settings>({
    pin: "1234",
    orgName: "FaceGate",
  });
  // refs mirroring state for use inside the animation-frame scan loop
  const employeesRef = useRef<Employee[]>([]);
  const logsRef = useRef<LogEntry[]>([]);
  useEffect(() => {
    employeesRef.current = employees;
  }, [employees]);
  useEffect(() => {
    logsRef.current = logs;
  }, [logs]);

  /* ---------------- clock ---------------- */
  const [clockTime, setClockTime] = useState("--:--:--");
  const [clockDate, setClockDate] = useState("—");
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClockTime(now.toLocaleTimeString());
      setClockDate(
        now.toLocaleDateString([], {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  /* ---------------- model loading ---------------- */
  const [loadingScreenVisible, setLoadingScreenVisible] = useState(true);
  const [loadingText, setLoadingText] = useState(
    "Loading face recognition models…",
  );
  const [appVisible, setAppVisible] = useState(false);
  const modelsReadyRef = useRef(false);

  /* ---------------- camera (main scan) ---------------- */
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const scanFrameRef = useRef<HTMLDivElement>(null);
  const mainStreamRef = useRef<MediaStream | null>(null);

  const startMainCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 480, height: 480 },
      });
      mainStreamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await new Promise<void>((res) => {
        video.onloadedmetadata = () => res();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- face matcher ---------------- */
  const matcherRef = useRef<faceapi.FaceMatcher | null>(null);
  const buildMatcher = useCallback((emps: Employee[]) => {
    if (!emps.length) {
      matcherRef.current = null;
      return;
    }
    const labeled = emps.map(
      (e) =>
        new faceapi.LabeledFaceDescriptors(e.id, [
          new Float32Array(e.descriptor),
        ]),
    );
    matcherRef.current = new faceapi.FaceMatcher(labeled, 0.5);
  }, []);
  useEffect(() => {
    buildMatcher(employees);
  }, [employees, buildMatcher]);

  /* ---------------- scan loop state ---------------- */
  const [scanStatus, setScanStatus] = useState(
    "Position your face in the frame",
  );
  const [scanMatch, setScanMatch] = useState(false);
  const scanPausedRef = useRef(false);
  const recentMatchRef = useRef<Record<string, number>>({});
  const rafRef = useRef<number | null>(null);

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
        () => setToast((t) => ({ ...t, show: false })),
        3200,
      );
    },
    [],
  );

  const handleMatch = useCallback(
    (empId: string) => {
      const now = Date.now();
      if (
        recentMatchRef.current[empId] &&
        now - recentMatchRef.current[empId] < COOLDOWN_MS
      )
        return;
      recentMatchRef.current[empId] = now;

      const emp = employeesRef.current.find((e) => e.id === empId);
      if (!emp) return;

      const empLogs = logsRef.current
        .filter((l) => l.empId === empId)
        .sort((a, b) => b.ts - a.ts);
      const lastType = empLogs.length ? empLogs[0].type : "OUT";
      const type: "IN" | "OUT" = lastType === "IN" ? "OUT" : "IN";

      const entry: LogEntry = {
        id: uid(),
        empId,
        name: emp.name,
        extId: emp.extId,
        type,
        ts: now,
      };
      void faceGateStorage.attendance
        .add(entry)
        .then(() => {
          setLogs((prev) => [...prev, entry]);
          setScanStatus(
            `${emp.name} — ${type === "IN" ? "checked in" : "checked out"}`,
          );
          showToast(emp, type, now);
          setLastEvent({ entry, emp });
        })
        .catch((error) => {
          delete recentMatchRef.current[empId];
          console.error("Could not persist attendance entry", error);
          setScanStatus("Could not save attendance. Please scan again.");
        });
    },
    [showToast],
  );

  const scanLoop = useCallback(async () => {
    const video = videoRef.current;
    const overlay = overlayRef.current;
    if (!scanPausedRef.current && video && video.readyState === 4 && overlay) {
      const det = await faceapi
        .detectSingleFace(
          video,
          new faceapi.TinyFaceDetectorOptions({ inputSize: 224 }),
        )
        .withFaceLandmarks()
        .withFaceDescriptor();
      const octx = overlay.getContext("2d");
      if (octx) octx.clearRect(0, 0, overlay.width, overlay.height);
      if (det) {
        setScanMatch(true);
        const box = det.detection.box;
        if (octx) {
          octx.strokeStyle = "rgba(82,227,194,0.9)";
          octx.lineWidth = 2;
          octx.strokeRect(box.x, box.y, box.width, box.height);
        }
        if (matcherRef.current) {
          const best = matcherRef.current.findBestMatch(det.descriptor);
          if (best.label !== "unknown") {
            handleMatch(best.label);
          } else {
            setScanStatus("Face not recognized — register below if you're new");
          }
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
    async function loadModels() {
      try {
        await Promise.all([
          faceGateStorage.initialize(),
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
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

        const latestToday = storedLogs
          .filter((entry) => isoDate(entry.ts) === isoDate(Date.now()))
          .sort((a, b) => b.ts - a.ts)[0];
        const latestEmployee = storedEmployees.find(
          (employee) => employee.id === latestToday?.empId,
        );
        if (latestToday && latestEmployee) {
          setLastEvent({ entry: latestToday, emp: latestEmployee });
        }
        modelsReadyRef.current = true;
        setLoadingScreenVisible(false);
        setAppVisible(true);
        await startMainCamera();
        rafRef.current = requestAnimationFrame(scanLoop);
      } catch (err) {
        console.error(err);
        setLoadingText(
          "Could not initialize the local database or face recognition models. Check your connection and reload.",
        );
      }
    }
    loadModels();
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (mainStreamRef.current) {
        mainStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- stats ---------------- */
  const todayIso = isoDate(Date.now());
  const todaysLogs = logs.filter((l) => isoDate(l.ts) === todayIso);
  const statIn = todaysLogs.filter((l) => l.type === "IN").length;
  const statOut = todaysLogs.filter((l) => l.type === "OUT").length;
  const statPeople = employees.length;

  /* ---------------- PIN gate ---------------- */
  const [pinOpen, setPinOpen] = useState(false);
  const [pinBuffer, setPinBuffer] = useState("");
  const [pinError, setPinError] = useState("");

  const openPinGate = () => {
    setPinBuffer("");
    setPinError("");
    setPinOpen(true);
  };
  const closePinGate = () => setPinOpen(false);

  const pressKey = (k: string) => {
    let next = pinBuffer;
    if (k === "clear") next = "";
    else if (k === "back") next = pinBuffer.slice(0, -1);
    else if (pinBuffer.length < 4) next = pinBuffer + k;
    setPinBuffer(next);
    if (next.length === 4) {
      if (next === settings.pin) {
        closePinGate();
        openAdmin();
      } else {
        setPinError("Incorrect PIN, try again");
        setTimeout(() => setPinBuffer(""), 250);
      }
    }
  };

  /* ---------------- register flow ---------------- */
  const [registerOpen, setRegisterOpen] = useState(false);
  const regVideoRef = useRef<HTMLVideoElement>(null);
  const regStreamRef = useRef<MediaStream | null>(null);
  const [samples, setSamples] = useState<Float32Array[]>([]);
  const [samplePhoto, setSamplePhoto] = useState<string | null>(null);
  const [captureHint, setCaptureHint] = useState(
    "Look straight at the camera, then capture 3 samples (turn slightly between each for better accuracy).",
  );
  const [regName, setRegName] = useState("");
  const [regId, setRegId] = useState("");
  const [regDept, setRegDept] = useState("");
  const [regError, setRegError] = useState<{ text: string; ok: boolean }>({
    text: "",
    ok: false,
  });

  const openRegister = async () => {
    scanPausedRef.current = true;
    setSamples([]);
    setSamplePhoto(null);
    setRegName("");
    setRegId("");
    setRegDept("");
    setRegError({ text: "", ok: false });
    setCaptureHint(
      "Look straight at the camera, then capture 3 samples (turn slightly between each for better accuracy).",
    );
    setRegisterOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 400, height: 400 },
      });
      regStreamRef.current = stream;
      if (regVideoRef.current) regVideoRef.current.srcObject = stream;
    } catch {
      setCaptureHint(
        "Camera access denied. Allow camera permission to register.",
      );
    }
  };

  const closeRegister = () => {
    setRegisterOpen(false);
    if (regStreamRef.current) {
      regStreamRef.current.getTracks().forEach((t) => t.stop());
      regStreamRef.current = null;
    }
    scanPausedRef.current = false;
  };

  const captureSample = async () => {
    if (!modelsReadyRef.current || !regVideoRef.current) return;
    setCaptureHint("Capturing…");
    const det = await faceapi
      .detectSingleFace(
        regVideoRef.current,
        new faceapi.TinyFaceDetectorOptions({ inputSize: 224 }),
      )
      .withFaceLandmarks()
      .withFaceDescriptor();
    if (!det) {
      setCaptureHint(
        "No face detected — center your face in the frame and try again.",
      );
      return;
    }
    setSamples((prev) => {
      const next = [...prev, det.descriptor];
      if (!samplePhoto && regVideoRef.current) {
        const c = document.createElement("canvas");
        c.width = 160;
        c.height = 160;
        const cctx = c.getContext("2d");
        if (cctx) {
          cctx.translate(160, 0);
          cctx.scale(-1, 1);
          cctx.drawImage(regVideoRef.current, 0, 0, 160, 160);
          setSamplePhoto(c.toDataURL("image/jpeg", 0.85));
        }
      }
      if (next.length < 3) {
        setCaptureHint(
          `Sample ${next.length} of 3 captured. Turn your head slightly and capture again.`,
        );
      } else {
        setCaptureHint("All 3 samples captured. Fill in the details and save.");
      }
      return next;
    });
  };

  const savePerson = async () => {
    const name = regName.trim();
    const extId = regId.trim();
    const dept = regDept.trim();
    if (!name || samples.length < 3) return;

    const len = samples[0].length;
    const avg = new Array(len).fill(0);
    samples.forEach((s) => {
      for (let i = 0; i < len; i++) avg[i] += s[i] / samples.length;
    });

    const employee: Employee = {
      id: uid(),
      name,
      extId,
      dept,
      descriptor: avg,
      photo: samplePhoto || "",
      createdAt: Date.now(),
    };
    try {
      const savedEmployee = await faceGateStorage.employees.create(
        employee,
        samplePhoto ? dataUrlToBlob(samplePhoto) : undefined,
      );
      setEmployees((prev) => [...prev, savedEmployee]);
      setRegError({ text: `${name} registered successfully.`, ok: true });
      setTimeout(() => closeRegister(), 900);
    } catch (error) {
      console.error("Could not save employee", error);
      setRegError({
        text: "Could not save this person. Please try again.",
        ok: false,
      });
    }
  };

  const canSave = samples.length === 3 && regName.trim().length > 0;

  /* ---------------- admin dashboard ---------------- */
  const [adminOpen, setAdminOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"logs" | "people" | "settings">(
    "logs",
  );
  const [logDate, setLogDate] = useState(isoDate(Date.now()));
  const [logFilterActive, setLogFilterActive] = useState(true);
  const [settingsOrgName, setSettingsOrgName] = useState("");
  const [settingsNewPin, setSettingsNewPin] = useState("");
  const [settingsMsg, setSettingsMsg] = useState<{ text: string; ok: boolean }>(
    {
      text: "",
      ok: false,
    },
  );

  const openAdmin = () => {
    scanPausedRef.current = true;
    setSettingsOrgName(settings.orgName || "");
    setActiveTab("logs");
    setAdminOpen(true);
  };
  const closeAdmin = () => {
    setAdminOpen(false);
    scanPausedRef.current = false;
  };

  const removePerson = async (emp: Employee) => {
    if (
      !confirm(
        `Remove ${emp.name}? Their past attendance logs will be kept, but they'll need to re-register to check in again.`,
      )
    )
      return;
    try {
      await faceGateStorage.employees.remove(emp.id);
      setEmployees((prev) => prev.filter((e) => e.id !== emp.id));
    } catch (error) {
      console.error("Could not remove employee", error);
      alert("Could not remove this person. Please try again.");
    }
  };

  const saveSettings = async () => {
    const orgName = settingsOrgName.trim();
    const newPin = settingsNewPin.trim();
    if (newPin && !/^\d{4}$/.test(newPin)) {
      setSettingsMsg({ text: "PIN must be exactly 4 digits.", ok: false });
      return;
    }
    const nextSettings = {
      pin: newPin || settings.pin,
      orgName: orgName || settings.orgName,
    };
    try {
      await faceGateStorage.settings.save(nextSettings);
      setSettings(nextSettings);
      setSettingsMsg({ text: "Settings saved.", ok: true });
      setSettingsNewPin("");
      setTimeout(() => setSettingsMsg({ text: "", ok: false }), 2200);
    } catch (error) {
      console.error("Could not save settings", error);
      setSettingsMsg({
        text: "Could not save settings. Please try again.",
        ok: false,
      });
    }
  };

  const resetAll = async () => {
    if (
      !confirm(
        "This will permanently delete all registered people and attendance logs from this device. Continue?",
      )
    )
      return;
    if (!confirm("Are you absolutely sure? This cannot be undone.")) return;
    try {
      await faceGateStorage.clearPeopleAndAttendance();
      setEmployees([]);
      setLogs([]);
      setLastEvent(null);
    } catch (error) {
      console.error("Could not erase kiosk data", error);
      alert("Could not erase the data. Please try again.");
    }
  };

  const exportCsv = () => {
    let list = logs.slice().sort((a, b) => b.ts - a.ts);
    if (logFilterActive) list = list.filter((l) => isoDate(l.ts) === logDate);
    const rows = [["Name", "ID", "Type", "Date", "Time", "Timestamp"]];
    list.forEach((l) =>
      rows.push([
        l.name,
        l.extId || "",
        l.type,
        isoDate(l.ts),
        fmtTime(l.ts),
        new Date(l.ts).toISOString(),
      ]),
    );
    const csv = rows
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `attendance_${logFilterActive ? logDate : "all"}.csv`;
    a.click();
  };

  let filteredLogs = logs.slice().sort((a, b) => b.ts - a.ts);
  if (logFilterActive) {
    filteredLogs = filteredLogs.filter((l) => isoDate(l.ts) === logDate);
  }

  const sortedPeople = employees
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));

  /* ---------------- render ---------------- */
  return (
    <KioskView
      loadingScreenVisible={loadingScreenVisible}
      loadingText={loadingText}
      appVisible={appVisible}
      orgName={settings.orgName}
      clockTime={clockTime}
      clockDate={clockDate}
      openPinGate={openPinGate}
      videoRef={videoRef}
      overlayRef={overlayRef}
      scanFrameRef={scanFrameRef}
      scanMatch={scanMatch}
      scanStatus={scanStatus}
      lastEvent={lastEvent}
      statIn={statIn}
      statOut={statOut}
      statPeople={statPeople}
      openRegister={openRegister}
      toast={toast}
      pinOpen={pinOpen}
      pinBuffer={pinBuffer}
      pinError={pinError}
      pressKey={pressKey}
      closePinGate={closePinGate}
      registerOpen={registerOpen}
      regVideoRef={regVideoRef}
      samples={samples}
      captureHint={captureHint}
      captureSample={captureSample}
      regName={regName}
      setRegName={setRegName}
      regId={regId}
      setRegId={setRegId}
      regDept={regDept}
      setRegDept={setRegDept}
      regError={regError}
      canSave={canSave}
      savePerson={savePerson}
      closeRegister={closeRegister}
      adminOpen={adminOpen}
      closeAdmin={closeAdmin}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      logDate={logDate}
      setLogDate={(v) => {
        setLogDate(v);
        setLogFilterActive(true);
      }}
      showAllDates={() => setLogFilterActive(false)}
      filteredLogs={filteredLogs}
      employees={employees}
      exportCsv={exportCsv}
      sortedPeople={sortedPeople}
      removePerson={removePerson}
      openRegisterFromAdmin={() => {
        closeAdmin();
        openRegister();
      }}
      settingsOrgName={settingsOrgName}
      setSettingsOrgName={setSettingsOrgName}
      settingsNewPin={settingsNewPin}
      setSettingsNewPin={setSettingsNewPin}
      settingsMsg={settingsMsg}
      saveSettings={saveSettings}
      resetAll={resetAll}
    />
  );
}
