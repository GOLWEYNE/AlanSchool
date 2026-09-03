// Shared helpers for the Featured Video broadcast feature. Kept in their
// own client-safe module (no server-only imports like `@/lib/prisma`) so
// both the server-rendered FeaturedVideoPlayer and the client-side
// FeaturedVideoForm can use the exact same URL logic.

// A raw, directly-playable video file - either something an Admin uploaded
// straight from their computer (which lands on Cloudinary) or a plain link
// to an .mp4/.mov/etc. Rendered with a native <video> tag instead of the
// iframe-embed path below.
const DIRECT_FILE_EXTENSIONS = /\.(mp4|webm|ogg|mov|m4v|m3u8)(\?.*)?$/i;

export const isDirectVideoFile = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    if (host === "res.cloudinary.com") return true;
    return DIRECT_FILE_EXTENSIONS.test(parsed.pathname);
  } catch {
    return false;
  }
};

// Converts a normal share link - YouTube (including Shorts), Vimeo,
// TikTok, or Instagram (posts/Reels) - into an embeddable iframe src, so
// Admins can paste whatever link they copied from the app or browser bar
// instead of having to know each platform's embed URL format by heart.
// Anything we don't recognize (Loom, a direct /embed/ link, etc.) is
// passed straight through on the assumption it's already embeddable.
export const getEmbeddableVideoUrl = (url: string): string => {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = parsed.pathname.slice(1);
      return id ? `https://www.youtube.com/embed/${id}` : url;
    }

    if (host === "youtube.com" || host === "m.youtube.com") {
      if (parsed.pathname === "/watch") {
        const id = parsed.searchParams.get("v");
        return id ? `https://www.youtube.com/embed/${id}` : url;
      }
      if (parsed.pathname.startsWith("/shorts/")) {
        const id = parsed.pathname.split("/")[2];
        return id ? `https://www.youtube.com/embed/${id}` : url;
      }
      // Already an /embed/... link.
      return url;
    }

    if (host === "vimeo.com") {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      return id ? `https://player.vimeo.com/video/${id}` : url;
    }

    if (host === "tiktok.com" || host === "m.tiktok.com") {
      const match = parsed.pathname.match(/\/video\/(\d+)/);
      const id = match?.[1];
      return id ? `https://www.tiktok.com/embed/v2/${id}` : url;
    }

    if (host === "instagram.com") {
      const match = parsed.pathname.match(/^\/(p|reel|reels|tv)\/([^/]+)/);
      if (match) {
        const [, type, code] = match;
        const kind = type === "reels" ? "reel" : type;
        return `https://www.instagram.com/${kind}/${code}/embed`;
      }
      return url;
    }

    return url;
  } catch {
    return url;
  }
};
