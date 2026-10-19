"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Film, Radio, RefreshCw, Volume2, X } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { formatClock } from "@/lib/mediaRecording";
import type { Room } from "livekit-client";

type LiveTeacher = { teacherId: string; teacherName: string; title: string };
type SharedClip = {
  id: number;
  title: string;
  url: string;
  durationSec: number;
  createdAt: string;
  teacherName: string;
};

type ViewState = "idle" | "joining" | "waiting" | "watching";

const POLL_MS = 10_000;

/**
 * Parent dashboard card: shows which of their children's teachers are live right
 * now (watch in the browser, no app or account needed beyond the dashboard
 * login) and the clips teachers chose to share. The server only ever returns
 * teachers who teach one of this parent's children.
 */
const ParentClassVideos = () => {
  const t = useTranslations("Camera.parent");
  const format = useFormatter();

  const [live, setLive] = useState<LiveTeacher[]>([]);
  const [clips, setClips] = useState<SharedClip[]>([]);
  const [playingId, setPlayingId] = useState<number | null>(null);

  const [watching, setWatching] = useState<LiveTeacher | null>(null);
  const [view, setView] = useState<ViewState>("idle");
  const [messageKey, setMessageKey] = useState<string | null>(null);
  const [needsSound, setNeedsSound] = useState(false);

  const roomRef = useRef<Room | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioHostRef = useRef<HTMLDivElement | null>(null);
  const watchingRef = useRef<LiveTeacher | null>(null);
  const missedPollsRef = useRef(0);

  const leave = useCallback(async (reasonKey: string | null = null) => {
    const room = roomRef.current;
    roomRef.current = null;
    watchingRef.current = null;
    setWatching(null);
    setView("idle");
    setNeedsSound(false);
    setMessageKey(reasonKey);
    if (videoRef.current) videoRef.current.srcObject = null;
    if (audioHostRef.current) audioHostRef.current.innerHTML = "";
    if (room) await room.disconnect().catch(() => undefined);
  }, []);

  // Poll who is live (and refresh the shared clips) while the tab is visible.
  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      try {
        const [statusRes, clipsRes] = await Promise.all([
          fetch("/api/live/status", { cache: "no-store" }),
          fetch("/api/teacher-recordings/shared", { cache: "no-store" }),
        ]);
        if (cancelled) return;
        let liveNow: LiveTeacher[] = [];
        if (statusRes.ok) {
          const json = (await statusRes.json()) as { live?: LiveTeacher[] };
          liveNow = json.live ?? [];
          setLive(liveNow);
        }
        if (clipsRes.ok) {
          const json = (await clipsRes.json()) as { items?: SharedClip[] };
          setClips(json.items ?? []);
        }

        // The class we are watching went off the air (twice in a row, to ride out a blip).
        const current = watchingRef.current;
        if (current && statusRes.ok) {
          if (liveNow.some((l) => l.teacherId === current.teacherId)) {
            missedPollsRef.current = 0;
          } else if (++missedPollsRef.current >= 2) {
            missedPollsRef.current = 0;
            void leave("ended");
          }
        }
      } catch {
        // Offline for a moment: keep the last known state and try again.
      }
    };

    void poll();
    const id = window.setInterval(() => void poll(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [leave]);

  // Leave the room when the parent navigates away.
  useEffect(() => {
    return () => {
      const room = roomRef.current;
      roomRef.current = null;
      if (room) void room.disconnect();
    };
  }, []);

  const join = async (teacher: LiveTeacher) => {
    if (view !== "idle") return;
    setMessageKey(null);
    setWatching(teacher);
    watchingRef.current = teacher;
    missedPollsRef.current = 0;
    setView("joining");

    try {
      const res = await fetch("/api/live/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherId: teacher.teacherId }),
      });
      if (!res.ok) throw new Error(res.status === 409 ? "ended" : "joinFailed");
      const { token, url } = (await res.json()) as { token: string; url: string };

      const { Room, RoomEvent, Track } = await import("livekit-client");
      const room = new Room({ adaptiveStream: true });
      roomRef.current = room;

      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === Track.Kind.Video && videoRef.current) {
          track.attach(videoRef.current);
          setView("watching");
        } else if (track.kind === Track.Kind.Audio && audioHostRef.current) {
          audioHostRef.current.appendChild(track.attach());
        }
      });
      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        track.detach();
      });
      room.on(RoomEvent.AudioPlaybackStatusChanged, () => setNeedsSound(!room.canPlaybackAudio));
      room.on(RoomEvent.ParticipantDisconnected, () => {
        if (room.remoteParticipants.size === 0) void leave("ended");
      });
      room.on(RoomEvent.Disconnected, () => {
        if (roomRef.current === room) void leave("ended");
      });

      await room.connect(url, token);
      if (roomRef.current !== room) {
        // Parent pressed Leave while we were still connecting.
        await room.disconnect().catch(() => undefined);
        return;
      }

      // The teacher may already be publishing: attach what is there.
      room.remoteParticipants.forEach((participant) => {
        participant.trackPublications.forEach((pub) => {
          const track = pub.track;
          if (!track) return;
          if (track.kind === Track.Kind.Video && videoRef.current) {
            track.attach(videoRef.current);
            setView("watching");
          } else if (track.kind === Track.Kind.Audio && audioHostRef.current) {
            audioHostRef.current.appendChild(track.attach());
          }
        });
      });
      setNeedsSound(!room.canPlaybackAudio);
      setView((current) => (current === "joining" ? "waiting" : current));
    } catch (err) {
      await leave(err instanceof Error && err.message === "ended" ? "ended" : "joinFailed");
    }
  };

  const enableSound = async () => {
    await roomRef.current?.startAudio().catch(() => undefined);
    setNeedsSound(roomRef.current ? !roomRef.current.canPlaybackAudio : false);
  };

  const showStage = watching !== null;

  return (
    <div className="panel-card rounded-2xl p-5 md:p-6 shine-hover">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20">
          <Film size={18} className="text-blue-600 dark:text-blue-300" />
        </div>
        <h2 className="text-base font-bold text-gray-800 dark:text-blue-100">{t("title")}</h2>
      </div>

      {/* Live stage */}
      <div className={showStage ? "" : "hidden"}>
        <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-slate-900">
          <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 h-full w-full object-contain" />
          <div ref={audioHostRef} className="hidden" />

          {view !== "watching" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
              <RefreshCw size={22} className="animate-spin text-blue-300" />
              <p className="text-sm font-medium text-slate-200">{t("waiting")}</p>
            </div>
          )}

          {view === "watching" && (
            <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-1 text-xs font-bold text-white">
              <Radio size={12} />
              LIVE
            </span>
          )}

          {needsSound && view === "watching" && (
            <button
              type="button"
              onClick={() => void enableSound()}
              className="absolute bottom-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-slate-900"
            >
              <Volume2 size={16} />
              {t("tapForSound")}
            </button>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-800 dark:text-slate-100">{watching?.title}</p>
            <p className="truncate text-xs text-gray-400 dark:text-slate-500">{watching?.teacherName}</p>
          </div>
          <button
            type="button"
            onClick={() => void leave()}
            className="inline-flex items-center gap-1.5 rounded-full border border-red-100 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-300 transition hover:bg-red-100 dark:hover:bg-red-500/20"
          >
            <X size={14} />
            {t("leave")}
          </button>
        </div>
      </div>

      {messageKey && (
        <p role="status" className="mb-3 text-sm text-amber-600 dark:text-amber-300">
          {t(messageKey)}
        </p>
      )}

      {/* Who is live */}
      {!showStage &&
        (live.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-slate-500">{t("noLive")}</p>
        ) : (
          <ul className="space-y-2">
            {live.map((teacher) => (
              <li
                key={teacher.teacherId}
                className="flex items-center justify-between gap-3 rounded-xl border border-red-100 dark:border-red-500/20 bg-red-50/60 dark:bg-red-500/5 p-3"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-red-700 dark:text-red-300">
                    <Radio size={14} className="animate-pulse" />
                    {t("liveNow", { teacher: teacher.teacherName })}
                  </p>
                  {teacher.title && (
                    <p className="truncate text-xs text-gray-500 dark:text-slate-400">{teacher.title}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => void join(teacher)}
                  className="inline-flex shrink-0 items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500"
                >
                  <Radio size={14} />
                  {t("watch")}
                </button>
              </li>
            ))}
          </ul>
        ))}

      {/* Shared recordings */}
      <div className="mt-5 border-t border-gray-100 dark:border-slate-800 pt-4">
        <h3 className="mb-3 text-sm font-bold text-gray-800 dark:text-blue-100">{t("recordingsTitle")}</h3>
        {clips.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-slate-500">{t("noRecordings")}</p>
        ) : (
          <ul className="space-y-3">
            {clips.map((clip) => (
              <li key={clip.id} className="rounded-xl border border-gray-100 dark:border-slate-800 p-3">
                <button
                  type="button"
                  onClick={() => setPlayingId((current) => (current === clip.id ? null : clip.id))}
                  className="w-full text-left"
                  aria-expanded={playingId === clip.id}
                >
                  <p className="truncate text-sm font-semibold text-gray-800 dark:text-slate-100">{clip.title}</p>
                  <p className="text-[11px] text-gray-400 dark:text-slate-500">
                    {t("by", { teacher: clip.teacherName })} ·{" "}
                    {format.dateTime(new Date(clip.createdAt), { dateStyle: "medium", timeStyle: "short" })}
                    {clip.durationSec > 0 ? ` · ${formatClock(clip.durationSec)}` : ""}
                  </p>
                </button>
                {playingId === clip.id && (
                  <video
                    src={clip.url}
                    controls
                    autoPlay
                    playsInline
                    className="mt-3 aspect-video w-full rounded-lg bg-slate-900"
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default ParentClassVideos;
