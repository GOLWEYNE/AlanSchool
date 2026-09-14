import webpush from "web-push";
import prisma from "./prisma";

// Web Push (VAPID) - the actual "reaches a closed browser tab" transport.
// Requires three env vars, all generated once and never rotated casually
// (rotating VAPID_PRIVATE_KEY invalidates every subscription already
// stored, forcing every user to re-enable notifications):
//   NEXT_PUBLIC_VAPID_PUBLIC_KEY  - also read by the browser, must match
//   VAPID_PRIVATE_KEY
//   VAPID_SUBJECT                - a mailto: contact, e.g. mailto:admin@alaninternationialschool.com
const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT || "mailto:admin@alaninternationialschool.com";

let configured = false;
const ensureConfigured = () => {
  if (configured) return true;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
};

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

// Saves (or refreshes) one browser/device's subscription for userId.
// Called from /api/push/subscribe whenever the client (re)subscribes -
// idempotent on endpoint, so re-subscribing the same browser just updates
// the keys instead of creating a duplicate row.
export const savePushSubscription = async (
  userId: string,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } }
) => {
  await prisma.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    update: { userId, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
    create: {
      userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
  });
};

export const removePushSubscription = async (endpoint: string) => {
  await prisma.pushSubscription.deleteMany({ where: { endpoint } });
};

// Sends one notification to every device userId has ever subscribed on.
// Best-effort per-device: a push service returning 404/410 means that
// subscription is dead (browser data cleared, extension uninstalled,
// etc.) so we prune it; any other failure is logged and skipped rather
// than aborting the whole fan-out.
export const sendPushToUser = async (userId: string, payload: PushPayload) => {
  if (!ensureConfigured()) return;

  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });
  if (!subscriptions.length) return;

  const body = JSON.stringify(payload);

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body
        );
      } catch (err) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await removePushSubscription(sub.endpoint).catch(() => {});
        } else {
          console.log("push send failed", statusCode, err);
        }
      }
    })
  );
};
