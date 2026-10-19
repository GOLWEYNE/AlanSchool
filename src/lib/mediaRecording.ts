// Browser-side helpers for the teacher camera (recording, device support,
// upload). Everything here is defensive on purpose: the school's classroom
// boards (Promethean panels) run older/embedded browsers, so each feature is
// detected at runtime instead of assumed.

export type CameraFacing = "user" | "environment";

type LegacyGetUserMedia = (
  constraints: MediaStreamConstraints,
  success: (stream: MediaStream) => void,
  failure: (error: unknown) => void
) => void;

/** `navigator.mediaDevices`, or a thin wrapper around the old prefixed API. */
export function getMediaDevices(): Pick<MediaDevices, "getUserMedia" | "enumerateDevices"> | null {
  if (typeof navigator === "undefined") return null;
  const modern = navigator.mediaDevices as MediaDevices | undefined;
  if (modern && typeof modern.getUserMedia === "function") return modern;

  const nav = navigator as Navigator & {
    getUserMedia?: LegacyGetUserMedia;
    webkitGetUserMedia?: LegacyGetUserMedia;
    mozGetUserMedia?: LegacyGetUserMedia;
  };
  const legacy = nav.getUserMedia || nav.webkitGetUserMedia || nav.mozGetUserMedia;
  if (!legacy) return null;

  return {
    getUserMedia: (constraints) =>
      new Promise<MediaStream>((resolve, reject) => legacy.call(navigator, constraints ?? { video: true }, resolve, reject)),
    enumerateDevices: async () => [],
  };
}

export type CameraSupport = {
  /** The browser can open a camera at all (needs HTTPS + getUserMedia). */
  camera: boolean;
  /** The browser can record that camera in the page (MediaRecorder). */
  recorder: boolean;
  /** Page is not a secure context, so browsers hide the camera API. */
  insecure: boolean;
};

export function detectSupport(): CameraSupport {
  const insecure = typeof window !== "undefined" && window.isSecureContext === false;
  return {
    camera: getMediaDevices() !== null,
    recorder: typeof MediaRecorder !== "undefined",
    insecure,
  };
}

const MIME_CANDIDATES = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm;codecs=h264,opus",
  "video/webm",
  "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
  "video/mp4",
];

/** Best container/codec this browser can record, or "" to let it choose. */
export function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return "";
  return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

export function extensionFor(mime: string, fileName = ""): string {
  const lower = mime.toLowerCase();
  if (lower.includes("mp4") || lower.includes("quicktime")) return lower.includes("quicktime") ? "mov" : "mp4";
  if (lower.includes("webm")) return "webm";
  if (lower.includes("3gpp")) return "3gp";
  const fromName = fileName.split(".").pop()?.toLowerCase();
  return fromName && /^[a-z0-9]{2,4}$/.test(fromName) ? fromName : "webm";
}

const isPermissionError = (err: unknown) =>
  err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "PermissionDeniedError" || err.name === "SecurityError");

/**
 * Open the camera (+ microphone). Tries rich settings first and steps down so an
 * old or odd device still gets *some* picture: HD -> any resolution -> no
 * facing preference -> camera without microphone.
 */
export async function openStream(facing: CameraFacing): Promise<MediaStream> {
  const devices = getMediaDevices();
  if (!devices) throw new DOMException("Unsupported", "NotSupportedError");

  const withAudio: MediaStreamConstraints[] = [
    { video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: true },
    { video: { facingMode: facing }, audio: true },
    { video: true, audio: true },
  ];
  const videoOnly: MediaStreamConstraints[] = [
    { video: { facingMode: facing }, audio: false },
    { video: true, audio: false },
  ];

  let lastError: unknown;
  for (const phase of [withAudio, videoOnly]) {
    for (const constraints of phase) {
      try {
        return await devices.getUserMedia(constraints);
      } catch (err) {
        lastError = err;
        // Permission refused: retrying with weaker video settings won't help.
        // With a microphone in the request, try once without it (camera-only).
        if (isPermissionError(err)) break;
      }
    }
  }
  throw lastError;
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const cameraErrorKey = (err: unknown): string => {
  if (err instanceof DOMException) {
    switch (err.name) {
      case "NotAllowedError":
      case "PermissionDeniedError":
        return "blocked";
      case "NotFoundError":
      case "DevicesNotFoundError":
        return "notFound";
      case "NotReadableError":
      case "TrackStartError":
        return "inUse";
      case "OverconstrainedError":
        return "overconstrained";
      case "SecurityError":
        return "insecure";
      case "NotSupportedError":
        return "unsupported";
      default:
        return "generic";
    }
  }
  return "generic";
};

export type CloudUpload = { url: string; publicId: string; bytes: number };

export const CLOUDINARY_CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "";

/**
 * Upload a clip straight to the school's Cloudinary account, using the same
 * unsigned "school" preset as every other upload in the app. Reports progress.
 */
export function uploadToCloudinary(
  blob: Blob,
  fileName: string,
  onProgress: (percent: number) => void
): Promise<CloudUpload> {
  return new Promise((resolve, reject) => {
    if (!CLOUDINARY_CLOUD) {
      reject(new Error("not_configured"));
      return;
    }
    const form = new FormData();
    form.append("file", blob, fileName);
    form.append("upload_preset", "school");

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/video/upload`);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
    };
    xhr.onerror = () => reject(new Error("network"));
    xhr.onload = () => {
      try {
        const json = JSON.parse(xhr.responseText) as {
          secure_url?: string;
          public_id?: string;
          bytes?: number;
          error?: { message?: string };
        };
        if (xhr.status >= 200 && xhr.status < 300 && json.secure_url && json.public_id) {
          onProgress(100);
          resolve({ url: json.secure_url, publicId: json.public_id, bytes: json.bytes ?? blob.size });
        } else {
          reject(new Error(json.error?.message || "upload_failed"));
        }
      } catch {
        reject(new Error("upload_failed"));
      }
    };
    xhr.send(form);
  });
}
