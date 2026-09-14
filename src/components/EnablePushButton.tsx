"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { usePushNotifications } from "@/hooks/usePushNotifications";

// Small companion to the notification bell: a deliberate, click-triggered
// way to opt into Web Push. Never prompts automatically - browsers expect
// (and users appreciate) permission requests to follow a real click, not
// fire on page load.
const EnablePushButton = () => {
  const t = useTranslations("Navbar");
  const { state, busy, enable, disable } = usePushNotifications();

  if (state === "unsupported") return null;

  if (state === "denied") {
    return (
      <button
        type="button"
        disabled
        className="circle-icon-btn opacity-40 cursor-not-allowed"
        aria-label={t("pushDenied")}
        title={t("pushDenied")}
      >
        <Image src="/announcement.png" alt="" width={16} height={16} className="grayscale" />
      </button>
    );
  }

  if (state === "granted") {
    return (
      <button
        type="button"
        onClick={disable}
        disabled={busy}
        className="circle-icon-btn relative"
        aria-label={t("pushEnabled")}
        title={t("pushEnabled")}
      >
        <Image src="/announcement.png" alt="" width={16} height={16} />
        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-500 border border-white dark:border-slate-900" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={enable}
      disabled={busy}
      className="circle-icon-btn"
      aria-label={t("enablePush")}
      title={t("enablePush")}
    >
      <Image src="/announcement.png" alt="" width={16} height={16} className="opacity-50" />
    </button>
  );
};

export default EnablePushButton;
