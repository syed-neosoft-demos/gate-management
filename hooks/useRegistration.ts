import { useCallback, useEffect, useRef, useState } from "react";
import * as faceapi from "face-api.js";
import { Employee, uid } from "@/lib/types";
import { averageDescriptors } from "@/lib/kiosk-utils";
import { loadFaceModels } from "@/lib/face-models";
import { dataUrlToBlob, faceGateStorage } from "@/lib/storage";

const INITIAL_HINT =
  "Look straight at the camera and capture 3 samples. Turn slightly between samples.";
export function useRegistration(onRegistered: (employee: Employee) => void) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraAttemptRef = useRef(0);
  const operationRef = useRef(false);
  const mountedRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [samples, setSamples] = useState<Float32Array[]>([]);
  const [samplePhoto, setSamplePhoto] = useState<string | null>(null);
  const [captureHint, setCaptureHint] = useState(INITIAL_HINT);
  const [name, setName] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [department, setDepartment] = useState("");
  const [error, setError] = useState({ text: "", ok: false });

  const initialize = useCallback(async () => {
    const attempt = ++cameraAttemptRef.current;
    const current = () =>
      mountedRef.current && cameraAttemptRef.current === attempt;
    setLoading(true);
    setReady(false);
    setError({ text: "", ok: false });
    streamRef.current?.getTracks().forEach((track) => track.stop());
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 400, height: 400 },
      });
      if (!current()) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      await loadFaceModels();
      if (current()) {
        setReady(true);
        setCaptureHint(INITIAL_HINT);
      }
    } catch {
      if (current())
        setError({
          text: "Could not start registration. Allow camera access and check your connection, then retry.",
          ok: false,
        });
    } finally {
      if (current()) setLoading(false);
    }
  }, []);
  useEffect(() => {
    mountedRef.current = true;
    void initialize();
    return () => {
      mountedRef.current = false;
      cameraAttemptRef.current++;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [initialize]);

  const capture = async () => {
    if (
      !ready ||
      !videoRef.current ||
      samples.length >= 3 ||
      operationRef.current ||
      saved
    )
      return;
    operationRef.current = true;
    setBusy(true);
    setCaptureHint("Capturing…");
    try {
      const detection = await faceapi
        .detectSingleFace(
          videoRef.current,
          new faceapi.TinyFaceDetectorOptions({ inputSize: 224 }),
        )
        .withFaceLandmarks()
        .withFaceDescriptor();
      if (!mountedRef.current) return;
      if (!detection) {
        setCaptureHint("No face detected. Center your face and try again.");
        return;
      }
      const next = [...samples, detection.descriptor];
      setSamples(next);
      if (!samplePhoto) setSamplePhoto(capturePhoto(videoRef.current));
      setCaptureHint(
        next.length < 3
          ? `Sample ${next.length} of 3 captured. Turn slightly and capture again.`
          : "All 3 samples captured. Complete the employee details and save.",
      );
    } catch {
      if (mountedRef.current)
        setCaptureHint("Could not capture a sample. Please try again.");
    } finally {
      operationRef.current = false;
      if (mountedRef.current) setBusy(false);
    }
  };
  const save = async () => {
    const trimmedName = name.trim();
    if (!trimmedName || samples.length !== 3 || operationRef.current || saved)
      return;
    operationRef.current = true;
    setBusy(true);
    setError({ text: "", ok: false });
    const employee: Employee = {
      id: uid(),
      name: trimmedName,
      extId: employeeId.trim(),
      dept: department.trim(),
      descriptor: averageDescriptors(samples),
      photo: samplePhoto || "",
      createdAt: Date.now(),
    };
    try {
      const result = await faceGateStorage.employees.create(
        employee,
        samplePhoto ? dataUrlToBlob(samplePhoto) : undefined,
      );
      onRegistered(result);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (mountedRef.current) {
        setSaved(true);
        setError({ text: `${trimmedName} registered successfully.`, ok: true });
      }
    } catch (failure) {
      if (mountedRef.current)
        setError({
          text:
            failure instanceof Error
              ? failure.message
              : "Could not register this employee.",
          ok: false,
        });
    } finally {
      operationRef.current = false;
      if (mountedRef.current) setBusy(false);
    }
  };
  return {
    videoRef,
    samples,
    captureHint,
    name,
    setName,
    employeeId,
    setEmployeeId,
    department,
    setDepartment,
    error,
    ready,
    loading,
    busy,
    saved,
    canSave: samples.length === 3 && !!name.trim() && !busy && !saved,
    initialize,
    capture,
    save,
  };
}
function capturePhoto(video: HTMLVideoElement): string {
  const canvas = document.createElement("canvas");
  canvas.width = 160;
  canvas.height = 160;
  const context = canvas.getContext("2d");
  if (!context) return "";
  context.translate(160, 0);
  context.scale(-1, 1);
  context.drawImage(video, 0, 0, 160, 160);
  return canvas.toDataURL("image/jpeg", 0.85);
}
