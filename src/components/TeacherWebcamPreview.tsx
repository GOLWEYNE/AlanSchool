"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  Camera,
  CameraOff,
  Check,
  CloudUpload,
  Download,
  Mic,
  MicOff,
  Pause,
  Play,
  Radio,
  RefreshCw,
  RotateCcw,
  Smartphone,
  Square,
  SwitchCamera,
  Users,
  Video,
  ZoomIn,
} from "lucide-react";
import { useTranslations } from "next-intl";
import TeacherRecordings from "@/components/TeacherRecordings";
import {
  CLOUDINARY_CLOUD,
  cameraErrorKey,
  detectSupport,
  extensionFor,
  formatClock,
  getMediaDevices,
  openStream,
  pickMimeType,
  uploadToCloudinary,
  type CameraFacing,
  type CameraSupport,
} from "@/lib/mediaRecording";
import { startBroadcast, type Broadcast } from "@/lib/liveBroadcast";

type CameraStatus = "idle" | "requesting" | "active" | "error";
type RecState = "idle" | "recording" | "paused";
type SaveState = "idle" | "saving" | "saved" | "error";
type LiveState = "off" | "starting" | "on";

interface PanOffset {
  x: number;
  y: number;
}

interface Clip {
  blob: Blob;
  url: string;
  mime: string;
  ext: string;
  durationSec: number;
  fromDevice: boolean;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.1;
// Same ceiling as the old MyCamera studio: 40 minutes per clip.
const MAX_RECORDING_SECONDS = 40 * 60;

const clampPan = (value: number, max: number) => {
  if (max <= 0) return 0;
  return Math.min(max, Math.max(-max, value));
};

const pad = (n: number) => String(n).padStart(2, "0");

const stamp = (d = new Date()) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

const fileStamp = (d = new Date()) =>
  `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;

/** Length of a clip picked from the device camera app (unknown until its metadata loads). */
function probeDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const probe = document.createElement("video");
    const done = (value: number) => {
      probe.removeAttribute("src");
      probe.load();
      resolve(Number.isFinite(value) && value > 0 ? Math.round(value) : 0);
    };
    const timer = window.setTimeout(() => done(0), 4000);
    probe.preload = "metadata";
    probe.onloadedmetadata = () => {
      window.clearTimeout(timer);
      done(probe.duration);
    };
    probe.onerror = () => {
      window.clearTimeout(timer);
      done(0);
    };
    probe.src = url;
  });
}

/**
 * Teacher camera: a Zoom-style recorder for a teacher's dashboard.
 *
 * - Camera access is opt-in ("Start camera"), never automatic.
 * - Record / pause / resume / stop with a timer, mic toggle and (when the device
 *   has more than one camera) front/back switching. The recording happens
 *   entirely in the browser; nothing leaves the device until the teacher
 *   presses Save.
 * - Finished clips can be played back, downloaded, saved to "My recordings"
 *   (Cloudinary) and optionally shared with the parents of their students.
 * - "Go live" streams the same camera to the parents of the teacher's students.
 * - Built for old classroom boards: every capability is detected, formats are
 *   chosen at runtime, and if the browser can't record in the page the teacher
 *   can hand off to the device's own camera app.
 * - Zoom is a pure CSS transform for the preview only; recordings and the live
 *   stream always carry the full, unzoomed picture.
 */
const TeacherWebcamPreview = () => {
  const t = useTranslations("Camera");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const clipRef = useRef<Clip | null>(null);
  const broadcastRef = useRef<Broadcast | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const accumulatedRef = useRef(0);
  const segmentStartRef = useRef<number | null>(null);
  const elapsedRef = useRef(0);
  const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  const [support, setSupport] = useState<CameraSupport | null>(null);
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [facing, setFacing] = useState<CameraFacing>("user");
  const [cameraCount, setCameraCount] = useState(0);
  const [hasAudio, setHasAudio] = useState(false);
  const [micOn, setMicOn] = useState(true);

  const [recState, setRecState] = useState<RecState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [recordErrorKey, setRecordErrorKey] = useState<string | null>(null);

  const [clip, setClip] = useState<Clip | null>(null);
  const [title, setTitle] = useState("");
  const [share, setShare] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [progress, setProgress] = useState(0);
  const [saveErrorKey, setSaveErrorKey] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [liveConfigured, setLiveConfigured] = useState<boolean | null>(null);
  const [liveState, setLiveState] = useState<LiveState>("off");
  const [liveTitle, setLiveTitle] = useState("");
  const [viewers, setViewers] = useState(0);
  const [liveErrorKey, setLiveErrorKey] = useState<string | null>(null);

  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [pan, setPan] = useState<PanOffset>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  // Feature detection has to wait for the browser (SSR has no navigator).
  useEffect(() => {
    setSupport(detectSupport());
  }, []);

  // Is live streaming set up on the server? (Hides nothing, just explains.)
  useEffect(() => {
    let cancelled = false;
    fetch("/api/live/status", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { configured?: boolean } | null) => {
        if (!cancelled) setLiveConfigured(Boolean(json?.configured));
      })
      .catch(() => {
        if (!cancelled) setLiveConfigured(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const releaseClip = useCallback(() => {
    if (clipRef.current) URL.revokeObjectURL(clipRef.current.url);
    clipRef.current = null;
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const endLive = useCallback(async () => {
    const broadcast = broadcastRef.current;
    broadcastRef.current = null;
    setLiveState("off");
    setViewers(0);
    if (broadcast) await broadcast.stop();
  }, []);

  // Release camera, recorder, broadcast and blob URLs when the teacher leaves.
  useEffect(() => {
    return () => {
      const recorder = recorderRef.current;
      if (recorder) {
        recorder.ondataavailable = null;
        recorder.onstop = null;
        recorder.onerror = null;
        if (recorder.state !== "inactive") {
          try {
            recorder.stop();
          } catch {
            // already stopped
          }
        }
      }
      const broadcast = broadcastRef.current;
      broadcastRef.current = null;
      if (broadcast) void broadcast.stop();
      stopStream();
      releaseClip();
    };
  }, [stopStream, releaseClip]);

  // A half-recorded clip can't be recovered, so warn before the tab goes away.
  useEffect(() => {
    if (recState === "idle") return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [recState]);

  // Timer: counts only the time actually spent recording (pauses excluded).
  useEffect(() => {
    if (recState !== "recording") return;
    const id = window.setInterval(() => {
      const running = segmentStartRef.current ? (Date.now() - segmentStartRef.current) / 1000 : 0;
      const total = accumulatedRef.current + running;
      elapsedRef.current = total;
      setElapsed(Math.floor(total));
      if (total >= MAX_RECORDING_SECONDS) {
        window.clearInterval(id);
        setNotice("maxReached");
        const recorder = recorderRef.current;
        if (recorder && recorder.state !== "inactive") recorder.stop();
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [recState]);

  const setNewClip = useCallback(
    (next: Clip) => {
      releaseClip();
      clipRef.current = next;
      setClip(next);
      setTitle(`${t("preview.defaultTitle")} ${stamp()}`);
      setShare(false);
      setSaveState("idle");
      setSaveErrorKey(null);
      setProgress(0);
    },
    [releaseClip, t]
  );

  const startCamera = useCallback(
    async (nextFacing: CameraFacing = facing) => {
      setStatus("requesting");
      setErrorKey(null);

      const current = detectSupport();
      setSupport(current);
      if (!current.camera) {
        setStatus("error");
        setErrorKey(current.insecure ? "insecure" : "unsupported");
        return;
      }

      try {
        const stream = await openStream(nextFacing);
        streamRef.current = stream;

        // If the camera is unplugged or taken by another app mid-session.
        const videoTrack = stream.getVideoTracks()[0];
        videoTrack?.addEventListener("ended", () => {
          if (streamRef.current !== stream) return;
          const recorder = recorderRef.current;
          if (recorder && recorder.state !== "inactive") recorder.stop();
          void endLive();
          stopStream();
          setStatus("error");
          setErrorKey("generic");
        });

        const audioTracks = stream.getAudioTracks();
        setHasAudio(audioTracks.length > 0);
        setMicOn(true);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          try {
            await videoRef.current.play();
          } catch {
            // Some browsers reject play() before layout settles; the stream
            // is still attached and will start rendering, so this is safe
            // to ignore.
          }
        }

        setFacing(nextFacing);
        setZoom(MIN_ZOOM);
        setPan({ x: 0, y: 0 });
        setStatus("active");

        // Device labels/counts are only available once permission is granted.
        try {
          const list = (await getMediaDevices()?.enumerateDevices()) ?? [];
          setCameraCount(list.filter((d) => d.kind === "videoinput").length);
        } catch {
          setCameraCount(0);
        }
      } catch (err) {
        stopStream();
        setStatus("error");
        setErrorKey(cameraErrorKey(err));
      }
    },
    [facing, endLive, stopStream]
  );

  const handleStop = useCallback(async () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    await endLive();
    stopStream();
    setStatus("idle");
    setZoom(MIN_ZOOM);
    setPan({ x: 0, y: 0 });
  }, [endLive, stopStream]);

  const switchCamera = useCallback(async () => {
    if (recState !== "idle" || liveState !== "off") return;
    stopStream();
    await startCamera(facing === "user" ? "environment" : "user");
  }, [facing, liveState, recState, startCamera, stopStream]);

  const toggleMic = () => {
    const next = !micOn;
    streamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = next;
    });
    setMicOn(next);
  };

  const startRecording = useCallback(() => {
    const stream = streamRef.current;
    if (!stream || recState !== "idle") return;

    setRecordErrorKey(null);
    setNotice(null);
    chunksRef.current = [];

    const preferred = pickMimeType();
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, preferred ? { mimeType: preferred } : undefined);
    } catch {
      try {
        recorder = new MediaRecorder(stream);
      } catch {
        setRecordErrorKey("recordFailed");
        return;
      }
    }

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onerror = () => {
      setRecordErrorKey("recordFailed");
    };
    recorder.onstop = () => {
      const mime = recorder.mimeType || preferred || "video/webm";
      const blob = new Blob(chunksRef.current, { type: mime });
      chunksRef.current = [];
      recorderRef.current = null;
      segmentStartRef.current = null;
      setRecState("idle");

      if (blob.size === 0) {
        setRecordErrorKey("emptyRecording");
        return;
      }
      setNewClip({
        blob,
        url: URL.createObjectURL(blob),
        mime,
        ext: extensionFor(mime),
        durationSec: Math.max(1, Math.round(elapsedRef.current)),
        fromDevice: false,
      });
      // Like closing a Zoom call: release the camera unless a live class is using it.
      if (!broadcastRef.current) {
        stopStream();
        setStatus("idle");
        setZoom(MIN_ZOOM);
        setPan({ x: 0, y: 0 });
      }
    };

    accumulatedRef.current = 0;
    elapsedRef.current = 0;
    segmentStartRef.current = Date.now();
    setElapsed(0);
    recorderRef.current = recorder;
    try {
      // A timeslice flushes data regularly, which older engines need to finish long clips.
      recorder.start(1000);
    } catch {
      recorderRef.current = null;
      setRecordErrorKey("recordFailed");
      return;
    }
    setRecState("recording");
  }, [recState, setNewClip, stopStream]);

  const pauseRecording = () => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "recording") return;
    recorder.pause();
    if (segmentStartRef.current) {
      accumulatedRef.current += (Date.now() - segmentStartRef.current) / 1000;
      segmentStartRef.current = null;
    }
    elapsedRef.current = accumulatedRef.current;
    setRecState("paused");
  };

  const resumeRecording = () => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "paused") return;
    recorder.resume();
    segmentStartRef.current = Date.now();
    setRecState("recording");
  };

  const stopRecording = () => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    if (recorder.state === "paused" || !segmentStartRef.current) {
      elapsedRef.current = accumulatedRef.current;
    } else {
      elapsedRef.current = accumulatedRef.current + (Date.now() - segmentStartRef.current) / 1000;
    }
    recorder.stop();
  };

  // Device camera app fallback (works on nearly any phone, tablet or panel).
  const handleDeviceFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || file.size === 0) return;
    const url = URL.createObjectURL(file);
    const durationSec = await probeDuration(url);
    setNewClip({
      blob: file,
      url,
      mime: file.type || "video/mp4",
      ext: extensionFor(file.type, file.name),
      durationSec,
      fromDevice: true,
    });
  };

  const clipFileName = (c: Clip) => `teacher-recording-${fileStamp()}.${c.ext}`;

  const handleDownload = () => {
    if (!clip) return;
    const link = document.createElement("a");
    link.href = clip.url;
    link.download = clipFileName(clip);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleSave = async () => {
    if (!clip || saveState === "saving") return;
    setSaveState("saving");
    setProgress(0);
    setSaveErrorKey(null);
    try {
      const uploaded = await uploadToCloudinary(clip.blob, clipFileName(clip), setProgress);
      const res = await fetch("/api/teacher-recordings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          url: uploaded.url,
          publicId: uploaded.publicId,
          durationSec: clip.durationSec,
          bytes: uploaded.bytes,
          sharedWithParents: share,
        }),
      });
      if (!res.ok) throw new Error("save_failed");
      setSaveState("saved");
      setRefreshKey((key) => key + 1);
    } catch (err) {
      setSaveState("error");
      setSaveErrorKey(err instanceof Error && err.message === "not_configured" ? "uploadNotConfigured" : "uploadFailed");
    }
  };

  const discardClip = () => {
    releaseClip();
    setClip(null);
    setSaveState("idle");
    setSaveErrorKey(null);
    setRecordErrorKey(null);
  };

  const recordAgain = () => {
    discardClip();
    if (status !== "active") void startCamera();
  };

  const handleGoLive = async () => {
    const stream = streamRef.current;
    if (!stream || liveState !== "off") return;
    setLiveState("starting");
    setLiveErrorKey(null);
    try {
      const broadcast = await startBroadcast(stream, liveTitle, {
        onViewers: setViewers,
        onDisconnected: () => {
          broadcastRef.current = null;
          setLiveState("off");
          setViewers(0);
          setLiveErrorKey("connectionLost");
        },
      });
      broadcastRef.current = broadcast;
      setLiveState("on");
    } catch (err) {
      setLiveState("off");
      setLiveErrorKey(err instanceof Error && err.message === "live_not_configured" ? "notConfigured" : "startFailed");
    }
  };

  const handleEndLive = async () => {
    await endLive();
  };

  const clampPanToBounds = useCallback((nextZoom: number, next: PanOffset): PanOffset => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return { x: 0, y: 0 };

    const { width, height } = wrapper.getBoundingClientRect();
    const maxX = ((nextZoom - 1) / 2) * width;
    const maxY = ((nextZoom - 1) / 2) * height;

    return {
      x: clampPan(next.x, maxX),
      y: clampPan(next.y, maxY),
    };
  }, []);

  const handleZoomChange = (value: number) => {
    const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
    setZoom(nextZoom);
    setPan((prev) => clampPanToBounds(nextZoom, prev));
  };

  const resetView = () => {
    setZoom(MIN_ZOOM);
    setPan({ x: 0, y: 0 });
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (status !== "active" || zoom <= MIN_ZOOM) return;

    dragStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      panX: pan.x,
      panY: pan.y,
    };
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = dragStartRef.current;
    if (!start) return;

    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;

    setPan(
      clampPanToBounds(zoom, {
        x: start.panX + dx,
        y: start.panY + dy,
      })
    );
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragStartRef.current = null;
    setIsDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const canPan = status === "active" && zoom > MIN_ZOOM;
  const isDefaultView = zoom === MIN_ZOOM && pan.x === 0 && pan.y === 0;
  const recording = recState !== "idle";
  const canRecordHere = support ? support.recorder : true;
  const canSaveToCloud = Boolean(CLOUDINARY_CLOUD);

  const btnBase =
    "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition disabled:opacity-40";
  const btnPrimary = `${btnBase} bg-blue-600 text-white hover:bg-blue-500`;
  const btnGhost = `${btnBase} border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800`;
  const btnRound =
    "inline-flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-200 transition hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-40";

  // The "use the device's own camera app" hand-off, shown whenever recording
  // in the page isn't available or the camera can't be opened.
  const deviceCameraButton = (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        capture="user"
        className="hidden"
        onChange={handleDeviceFile}
      />
      <button type="button" onClick={() => fileInputRef.current?.click()} className={btnGhost}>
        <Smartphone size={16} />
        {t("preview.deviceCamera")}
      </button>
    </>
  );

  const reviewPanel = clip ? (
    <div className="rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50/60 dark:bg-slate-900/40 p-3 md:p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-gray-800 dark:text-blue-100">{t("preview.reviewTitle")}</h3>
        <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">
          {clip.durationSec > 0 ? formatClock(clip.durationSec) : ""}
        </span>
      </div>

      <video
        src={clip.url}
        controls
        playsInline
        preload="metadata"
        className="aspect-video w-full rounded-lg bg-slate-900"
      />

      <label className="mt-3 block text-xs font-semibold text-gray-500 dark:text-slate-400">
        {t("preview.titleLabel")}
        <input
          type="text"
          value={title}
          maxLength={120}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={t("preview.titlePlaceholder")}
          disabled={saveState === "saving" || saveState === "saved"}
          className="mt-1 w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-gray-800 dark:text-slate-100 disabled:opacity-60"
        />
      </label>

      {canSaveToCloud && (
        <label className="mt-2 flex items-center gap-2 text-xs font-semibold text-gray-600 dark:text-slate-300">
          <input
            type="checkbox"
            checked={share}
            disabled={saveState === "saving" || saveState === "saved"}
            onChange={(event) => setShare(event.target.checked)}
            className="h-4 w-4 accent-blue-600"
          />
          <Users size={14} />
          {t("preview.shareParents")}
        </label>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={handleDownload} className={btnGhost}>
          <Download size={16} />
          {t("preview.download")}
        </button>

        {canSaveToCloud && saveState !== "saved" && (
          <button type="button" onClick={handleSave} disabled={saveState === "saving"} className={btnPrimary}>
            {saveState === "saving" ? <RefreshCw size={16} className="animate-spin" /> : <CloudUpload size={16} />}
            {saveState === "saving" ? t("preview.saving", { percent: progress }) : t("preview.saveCloud")}
          </button>
        )}

        {saveState === "saved" && (
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600 dark:text-emerald-300">
            <Check size={16} />
            {t("preview.saved")}
          </span>
        )}

        <button type="button" onClick={recordAgain} className={btnGhost}>
          <Video size={16} />
          {t("preview.recordAgain")}
        </button>
        <button
          type="button"
          onClick={discardClip}
          disabled={saveState === "saving"}
          className={`${btnBase} text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/10`}
        >
          {saveState === "saved" ? t("recordings.close") : t("preview.discard")}
        </button>
      </div>

      {saveState === "saving" && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-slate-700" aria-hidden>
          <div className="h-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}
      {saveErrorKey && (
        <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-300">
          {t(`errors.${saveErrorKey}`)}
        </p>
      )}
    </div>
  ) : null;

  // After a stop with the camera released, the review replaces the frame; if the
  // camera is still on (live class running) it sits underneath instead.
  const reviewInFrame = clip !== null && status !== "active";

  return (
    <div className="panel-card rounded-2xl p-5 md:p-6 shine-hover">
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20">
            <Camera size={18} className="text-blue-600 dark:text-blue-300" strokeWidth={2} />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-800 dark:text-blue-100">{t("preview.title")}</h2>
            <p className="text-xs text-gray-400 dark:text-slate-500">{t("preview.subtitle")}</p>
          </div>
        </div>

        {status === "active" && !recording && (
          <button
            type="button"
            onClick={() => void handleStop()}
            className="inline-flex items-center gap-1.5 rounded-full border border-red-100 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-300 transition hover:bg-red-100 dark:hover:bg-red-500/20"
          >
            <CameraOff size={14} />
            {t("preview.stop")}
          </button>
        )}
      </div>

      {reviewInFrame ? (
        reviewPanel
      ) : (
        <>
          {/* Video frame */}
          <div
            ref={wrapperRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
            onPointerLeave={endDrag}
            className={`relative w-full aspect-video overflow-hidden rounded-xl bg-slate-900 shadow-inner select-none ${
              canPan ? (isDragging ? "cursor-grabbing" : "cursor-grab") : ""
            }`}
          >
            <video
              ref={videoRef}
              muted
              playsInline
              autoPlay
              className={`absolute inset-0 h-full w-full object-cover will-change-transform ${
                isDragging ? "" : "transition-transform duration-150 ease-out"
              }`}
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                visibility: status === "active" ? "visible" : "hidden",
              }}
            />

            {status === "active" && (recording || liveState === "on") && (
              <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap items-center gap-2">
                {recording && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-xs font-bold text-white">
                    <span
                      className={`h-2.5 w-2.5 rounded-full bg-red-500 ${recState === "recording" ? "animate-pulse" : "opacity-50"}`}
                    />
                    {recState === "paused" ? t("preview.paused") : t("preview.recBadge")} {formatClock(elapsed)}
                  </span>
                )}
                {liveState === "on" && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-1 text-xs font-bold text-white">
                    <Radio size={12} />
                    {t("live.liveBadge")} · {t("live.viewers", { count: viewers })}
                  </span>
                )}
              </div>
            )}

            {status !== "active" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6">
                {status === "requesting" && (
                  <>
                    <RefreshCw size={22} className="text-blue-300 animate-spin" />
                    <p className="text-sm font-medium text-slate-200">{t("preview.requesting")}</p>
                  </>
                )}

                {status === "idle" && (
                  <>
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-500/10 border border-blue-500/20">
                      <Camera size={24} className="text-blue-300" />
                    </div>
                    <p className="text-sm font-semibold text-slate-200">{t("preview.off")}</p>
                    <p className="text-xs text-slate-400 max-w-xs">{t("preview.offHint")}</p>
                    <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
                      {support === null || support.camera ? (
                        <button type="button" onClick={() => void startCamera()} className={btnPrimary}>
                          <Camera size={16} />
                          {t("preview.start")}
                        </button>
                      ) : null}
                      {support !== null && (!support.camera || !support.recorder) && deviceCameraButton}
                    </div>
                  </>
                )}

                {status === "error" && (
                  <>
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10 border border-red-500/20">
                      <CameraOff size={24} className="text-red-300" />
                    </div>
                    <p className="text-sm font-semibold text-slate-200">{t("preview.unavailable")}</p>
                    <p className="text-xs text-slate-400 max-w-xs">
                      {errorKey ? t(`errors.${errorKey}`) : t("errors.somethingWrong")}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
                      <button type="button" onClick={() => void startCamera()} className={btnPrimary}>
                        <RefreshCw size={16} />
                        {t("preview.retry")}
                      </button>
                      {deviceCameraButton}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Recording controls */}
          {status === "active" && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3" role="group" aria-label={t("preview.title")}>
              {hasAudio && (
                <button
                  type="button"
                  onClick={toggleMic}
                  className={`${btnRound} ${micOn ? "" : "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-300"}`}
                  aria-pressed={!micOn}
                  aria-label={micOn ? t("preview.micMute") : t("preview.micUnmute")}
                  title={micOn ? t("preview.micMute") : t("preview.micUnmute")}
                >
                  {micOn ? <Mic size={18} /> : <MicOff size={18} />}
                </button>
              )}

              {recState === "idle" && canRecordHere && (
                <button type="button" onClick={startRecording} className={`${btnBase} bg-red-600 text-white hover:bg-red-500`}>
                  <span className="h-3 w-3 rounded-full bg-white" />
                  {t("preview.record")}
                </button>
              )}

              {recState === "recording" && (
                <button type="button" onClick={pauseRecording} className={btnGhost}>
                  <Pause size={16} />
                  {t("preview.pause")}
                </button>
              )}
              {recState === "paused" && (
                <button type="button" onClick={resumeRecording} className={btnPrimary}>
                  <Play size={16} />
                  {t("preview.resume")}
                </button>
              )}
              {recording && (
                <button type="button" onClick={stopRecording} className={`${btnBase} bg-slate-800 text-white hover:bg-slate-700`}>
                  <Square size={14} />
                  {t("preview.stopRecording")}
                </button>
              )}

              {cameraCount > 1 && !recording && liveState === "off" && (
                <button
                  type="button"
                  onClick={() => void switchCamera()}
                  className={btnRound}
                  aria-label={t("preview.switchCamera")}
                  title={t("preview.switchCamera")}
                >
                  <SwitchCamera size={18} />
                </button>
              )}

              {!canRecordHere && (
                <div className="flex w-full flex-col items-center gap-2 text-center">
                  <p className="text-xs text-gray-500 dark:text-slate-400">{t("preview.recordUnsupported")}</p>
                  {deviceCameraButton}
                </div>
              )}
            </div>
          )}

          {recording && (
            <p className="mt-2 text-center text-[11px] text-gray-400 dark:text-slate-500">{t("preview.recordingHint")}</p>
          )}
          {notice && (
            <p role="status" className="mt-2 text-center text-xs font-semibold text-amber-600 dark:text-amber-300">
              {t(`preview.${notice}`)}
            </p>
          )}
          {recordErrorKey && (
            <p role="alert" className="mt-2 text-center text-xs text-red-600 dark:text-red-300">
              {t(`errors.${recordErrorKey}`)}
            </p>
          )}

          {/* Zoom & pan controls */}
          <div className="mt-4 flex items-center gap-3">
            <ZoomIn size={16} className="text-gray-400 dark:text-slate-500 shrink-0" />
            <input
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={ZOOM_STEP}
              value={zoom}
              disabled={status !== "active"}
              onChange={(event) => handleZoomChange(Number(event.target.value))}
              className="flex-1 h-1.5 accent-blue-600 disabled:opacity-40"
              aria-label={t("preview.zoomLevel")}
            />
            <span className="w-10 text-right text-xs font-semibold text-gray-500 dark:text-slate-400">
              {zoom.toFixed(1)}x
            </span>
            <button
              type="button"
              onClick={resetView}
              disabled={status !== "active" || isDefaultView}
              className="inline-flex items-center gap-1 rounded-full border border-gray-200 dark:border-slate-700 px-2.5 py-1 text-xs font-semibold text-gray-600 dark:text-slate-300 transition hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <RotateCcw size={12} />
              {t("preview.reset")}
            </button>
          </div>

          {canPan && (
            <p className="mt-2 text-[11px] text-gray-400 dark:text-slate-500">{t("preview.dragHint")}</p>
          )}
        </>
      )}

      {/* Review sits under the live preview when the camera is still on */}
      {!reviewInFrame && reviewPanel && <div className="mt-4">{reviewPanel}</div>}

      {/* Go live */}
      {status === "active" && (
        <div className="mt-4 rounded-xl border border-gray-100 dark:border-slate-800 p-3">
          {liveState === "off" ? (
            <div className="flex flex-wrap items-end gap-2">
              <label className="min-w-[10rem] flex-1 text-xs font-semibold text-gray-500 dark:text-slate-400">
                {t("live.titleLabel")}
                <input
                  type="text"
                  value={liveTitle}
                  maxLength={120}
                  onChange={(event) => setLiveTitle(event.target.value)}
                  placeholder={t("live.titlePlaceholder")}
                  disabled={liveConfigured === false}
                  className="mt-1 w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-gray-800 dark:text-slate-100 disabled:opacity-50"
                />
              </label>
              <button
                type="button"
                onClick={() => void handleGoLive()}
                disabled={liveConfigured !== true}
                className={`${btnBase} bg-red-600 text-white hover:bg-red-500`}
              >
                <Radio size={16} />
                {t("live.goLive")}
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-red-600 dark:text-red-300">
                <Radio size={16} className={liveState === "starting" ? "animate-pulse" : ""} />
                {liveState === "starting" ? t("live.connecting") : `${t("live.liveBadge")} · ${t("live.viewers", { count: viewers })}`}
              </span>
              <button
                type="button"
                onClick={() => void handleEndLive()}
                disabled={liveState === "starting"}
                className={`${btnBase} bg-slate-800 text-white hover:bg-slate-700`}
              >
                <Square size={14} />
                {t("live.endLive")}
              </button>
            </div>
          )}
          <p className="mt-2 text-[11px] text-gray-400 dark:text-slate-500">
            {liveConfigured === false ? t("live.notConfigured") : t("live.hint")}
          </p>
          {liveErrorKey && (
            <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-300">
              {t(`live.${liveErrorKey}`)}
            </p>
          )}
        </div>
      )}

      <TeacherRecordings refreshKey={refreshKey} />
    </div>
  );
};

export default TeacherWebcamPreview;
