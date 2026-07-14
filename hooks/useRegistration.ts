import { Dispatch, MutableRefObject, SetStateAction, useRef, useState } from "react";
import * as faceapi from "face-api.js";
import { Employee, uid } from "@/lib/types";
import { averageDescriptors } from "@/lib/kiosk-utils";
import { dataUrlToBlob, faceGateStorage } from "@/lib/storage";

const INITIAL_HINT =
  "Look straight at the camera, then capture 3 samples (turn slightly between each for better accuracy).";

interface RegistrationOptions {
  modelsReadyRef: MutableRefObject<boolean>;
  scanPausedRef: MutableRefObject<boolean>;
  setEmployees: Dispatch<SetStateAction<Employee[]>>;
}

export function useRegistration({
  modelsReadyRef,
  scanPausedRef,
  setEmployees,
}: RegistrationOptions) {
  const [registerOpen, setRegisterOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [samples, setSamples] = useState<Float32Array[]>([]);
  const [samplePhoto, setSamplePhoto] = useState<string | null>(null);
  const [captureHint, setCaptureHint] = useState(INITIAL_HINT);
  const [name, setName] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [department, setDepartment] = useState("");
  const [error, setError] = useState({ text: "", ok: false });

  const open = async () => {
    scanPausedRef.current = true;
    setSamples([]);
    setSamplePhoto(null);
    setName("");
    setEmployeeId("");
    setDepartment("");
    setError({ text: "", ok: false });
    setCaptureHint(INITIAL_HINT);
    setRegisterOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 400, height: 400 },
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      setCaptureHint("Camera access denied. Allow camera permission to register.");
    }
  };

  const close = () => {
    setRegisterOpen(false);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    scanPausedRef.current = false;
  };

  const capture = async () => {
    if (!modelsReadyRef.current || !videoRef.current || samples.length >= 3) return;
    setCaptureHint("Capturing…");
    const detection = await faceapi
      .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 224 }))
      .withFaceLandmarks()
      .withFaceDescriptor();
    if (!detection) {
      setCaptureHint("No face detected — center your face in the frame and try again.");
      return;
    }

    const nextSamples = [...samples, detection.descriptor];
    setSamples(nextSamples);
    if (!samplePhoto) setSamplePhoto(capturePhoto(videoRef.current));
    setCaptureHint(
      nextSamples.length < 3
        ? `Sample ${nextSamples.length} of 3 captured. Turn your head slightly and capture again.`
        : "All 3 samples captured. Fill in the details and save.",
    );
  };

  const save = async () => {
    const trimmedName = name.trim();
    if (!trimmedName || samples.length !== 3) return;
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
      const saved = await faceGateStorage.employees.create(
        employee,
        samplePhoto ? dataUrlToBlob(samplePhoto) : undefined,
      );
      setEmployees((current) => [...current, saved]);
      setError({ text: `${trimmedName} registered successfully.`, ok: true });
      setTimeout(close, 900);
    } catch (saveError) {
      console.error("Could not save employee", saveError);
      setError({ text: "Could not save this person. Please try again.", ok: false });
    }
  };

  return {
    registerOpen,
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
    canSave: samples.length === 3 && name.trim().length > 0,
    open,
    close,
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
