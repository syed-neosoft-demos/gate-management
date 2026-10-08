import * as faceapi from "face-api.js";

const MODEL_URL =
  "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights";
let modelPromise: Promise<void> | undefined;

/** Shared by the kiosk scanner and the admin registration camera. */
export function loadFaceModels(): Promise<void> {
  if (!modelPromise) {
    modelPromise = Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ])
      .then(() => undefined)
      .catch((error) => {
        modelPromise = undefined;
        throw error;
      });
  }
  return modelPromise;
}
