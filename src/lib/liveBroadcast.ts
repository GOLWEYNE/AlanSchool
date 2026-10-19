// Teacher side of live streaming. livekit-client is loaded only when a teacher
// actually presses "Go live", so it never weighs down the dashboard (or the
// older classroom boards) for people who only record.
import type { Room } from "livekit-client";

export type Broadcast = {
  room: Room;
  stop: () => Promise<void>;
  /** Mute/unmute the microphone that parents hear. */
  setMicEnabled: (enabled: boolean) => void;
};

export type BroadcastHandlers = {
  onViewers: (count: number) => void;
  onDisconnected: () => void;
};

const HEARTBEAT_MS = 20_000;

export async function startBroadcast(
  stream: MediaStream,
  title: string,
  handlers: BroadcastHandlers
): Promise<Broadcast> {
  const res = await fetch("/api/live/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(json.error || "start_failed");
  }
  const { token, url } = (await res.json()) as { token: string; url: string };

  const { Room, RoomEvent, Track } = await import("livekit-client");
  const room = new Room({ adaptiveStream: false, dynacast: true });

  const updateViewers = () => handlers.onViewers(room.numParticipants > 0 ? room.numParticipants - 1 : 0);
  room.on(RoomEvent.ParticipantConnected, updateViewers);
  room.on(RoomEvent.ParticipantDisconnected, updateViewers);

  let stopped = false;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  const endLiveRow = () => {
    // sendBeacon survives a closing tab; plain fetch may be cancelled.
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon("/api/live/stop");
    } else {
      void fetch("/api/live/stop", { method: "POST", keepalive: true }).catch(() => undefined);
    }
  };
  const onPageHide = () => endLiveRow();

  const stop = async () => {
    if (stopped) return;
    stopped = true;
    if (heartbeat) clearInterval(heartbeat);
    window.removeEventListener("pagehide", onPageHide);
    await fetch("/api/live/stop", { method: "POST" }).catch(() => undefined);
    await room.disconnect().catch(() => undefined);
  };

  room.on(RoomEvent.Disconnected, () => {
    if (!stopped) {
      void stop();
      handlers.onDisconnected();
    }
  });

  try {
    await room.connect(url, token);
    const video = stream.getVideoTracks()[0];
    const audio = stream.getAudioTracks()[0];
    // Publish the very same camera tracks the recorder uses (no second camera open).
    if (video) await room.localParticipant.publishTrack(video, { source: Track.Source.Camera, name: "camera" });
    if (audio) await room.localParticipant.publishTrack(audio, { source: Track.Source.Microphone, name: "microphone" });
  } catch (err) {
    await stop();
    throw err;
  }

  heartbeat = setInterval(() => {
    void fetch("/api/live/start", { method: "PATCH" }).catch(() => undefined);
  }, HEARTBEAT_MS);
  window.addEventListener("pagehide", onPageHide);
  updateViewers();

  return {
    room,
    stop,
    setMicEnabled: (enabled) => {
      for (const pub of Array.from(room.localParticipant.audioTrackPublications.values())) {
        if (enabled) void pub.unmute();
        else void pub.mute();
      }
    },
  };
}
