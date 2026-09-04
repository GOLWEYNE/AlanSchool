"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Camera, CameraOff, RefreshCw, RotateCcw, ZoomIn } from "lucide-react";

type CameraStatus = "idle" | "requesting" | "active" | "error";

interface PanOffset {
  x: number;
  y: number;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.1;

const clampPan = (value: number, max: number) => {
  if (max <= 0) return 0;
  return Math.min(max, Math.max(-max, value));
};

/**
 * Local-only webcam preview for a teacher's dashboard/profile page.
 *
 * - Nothing is uploaded or recorded: the stream is attached directly to a
 *   local <video> element and never leaves the browser.
 * - Camera access is opt-in (a "Start camera" button) rather than requested
 *   automatically on mount, so the permission prompt never surprises a
 *   teacher who is just viewing their dashboard.
 * - Zoom is a pure CSS transform on the video wrapper, with click-and-drag
 *   panning once zoomed in.
 */
const TeacherWebcamPreview = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const dragStartRef = useRef<{
    x: number;
    y: number;
    panX: number;
    panY: number;
  } | null>(null);

  const [status, setStatus] = useState<CameraStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [pan, setPan] = useState<PanOffset>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Always release the camera when the component unmounts (route change,
  // sign-out, etc.) so the webcam light never stays on unexpectedly.
  useEffect(() => {
    return () => {
      stopStream();
    };
  }, [stopStream]);

  const startCamera = useCallback(async () => {
    setStatus("requesting");
    setErrorMessage(null);

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setStatus("error");
      setErrorMessage("This browser doesn't support camera access.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });

      streamRef.current = stream;

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

      setZoom(MIN_ZOOM);
      setPan({ x: 0, y: 0 });
      setStatus("active");
    } catch (err) {
      stopStream();
      setStatus("error");
      setErrorMessage(getCameraErrorMessage(err));
    }
  }, [stopStream]);

  const handleStop = useCallback(() => {
    stopStream();
    setStatus("idle");
    setZoom(MIN_ZOOM);
    setPan({ x: 0, y: 0 });
  }, [stopStream]);

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

  return (
    <div className="panel-card rounded-2xl p-5 md:p-6 shine-hover">
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20">
            <Camera size={18} className="text-blue-600 dark:text-blue-300" strokeWidth={2} />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-800 dark:text-blue-100">My Camera</h2>
            <p className="text-xs text-gray-400 dark:text-slate-500">
              Local preview, only visible to you
            </p>
          </div>
        </div>

        {status === "active" && (
          <button
            type="button"
            onClick={handleStop}
            className="inline-flex items-center gap-1.5 rounded-full border border-red-100 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-300 transition hover:bg-red-100 dark:hover:bg-red-500/20"
          >
            <CameraOff size={14} />
            Stop
          </button>
        )}
      </div>

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

        {status !== "active" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6">
            {status === "requesting" && (
              <>
                <RefreshCw size={22} className="text-blue-300 animate-spin" />
                <p className="text-sm font-medium text-slate-200">Requesting camera access…</p>
              </>
            )}

            {status === "idle" && (
              <>
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-500/10 border border-blue-500/20">
                  <Camera size={24} className="text-blue-300" />
                </div>
                <p className="text-sm font-semibold text-slate-200">Your camera is off</p>
                <p className="text-xs text-slate-400 max-w-xs">
                  Start your camera to preview yourself before going live in class.
                </p>
                <button
                  type="button"
                  onClick={startCamera}
                  className="mt-1 inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
                >
                  <Camera size={16} />
                  Start camera
                </button>
              </>
            )}

            {status === "error" && (
              <>
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10 border border-red-500/20">
                  <CameraOff size={24} className="text-red-300" />
                </div>
                <p className="text-sm font-semibold text-slate-200">Camera unavailable</p>
                <p className="text-xs text-slate-400 max-w-xs">
                  {errorMessage ?? "Something went wrong while accessing your camera."}
                </p>
                <button
                  type="button"
                  onClick={startCamera}
                  className="mt-1 inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
                >
                  <RefreshCw size={16} />
                  Retry
                </button>
              </>
            )}
          </div>
        )}
      </div>

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
          aria-label="Zoom level"
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
          Reset
        </button>
      </div>

      {canPan && (
        <p className="mt-2 text-[11px] text-gray-400 dark:text-slate-500">
          Drag the preview to pan around while zoomed in.
        </p>
      )}
    </div>
  );
};

function getCameraErrorMessage(err: unknown): string {
  if (err instanceof DOMException) {
    switch (err.name) {
      case "NotAllowedError":
      case "PermissionDeniedError":
        return "Camera access was blocked. Allow camera permissions for this site in your browser settings and try again.";
      case "NotFoundError":
      case "DevicesNotFoundError":
        return "No camera was found on this device.";
      case "NotReadableError":
      case "TrackStartError":
        return "The camera is already in use by another application.";
      case "OverconstrainedError":
        return "No camera matches the requested settings.";
      case "SecurityError":
        return "Camera access requires a secure (HTTPS) connection.";
      default:
        return "Couldn't access the camera. Please try again.";
    }
  }
  return "Couldn't access the camera. Please try again.";
}

export default TeacherWebcamPreview;
