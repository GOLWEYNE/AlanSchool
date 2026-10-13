"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { saveMyDutyPrefs } from "@/lib/dutyActions";
import EnablePushButton from "@/components/EnablePushButton";

type Prefs = { inApp: boolean; push: boolean; email: boolean };

// Opt in/out per channel. "Push" here is the preference; the browser's own
// permission is granted with the bell button beside it (never prompted automatically).
const MyDutyPrefs = ({ initial }: { initial: Prefs }) => {
  const t = useTranslations("Duty");
  const [prefs, setPrefs] = useState<Prefs>(initial);
  const [pending, start] = useTransition();

  const change = (key: keyof Prefs, value: boolean) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    start(async () => {
      const r = await saveMyDutyPrefs(next);
      if (!r.ok) {
        setPrefs(prefs);
        toast.error(r.message ?? t("failed"));
      }
    });
  };

  const row = "flex items-center gap-2 text-sm dark:text-slate-200";
  return (
    <div className="flex flex-col gap-2">
      <label className={row}>
        <input type="checkbox" checked={prefs.inApp} disabled={pending} onChange={(e) => change("inApp", e.target.checked)} />
        {t("prefInApp")}
      </label>
      <label className={row}>
        <input type="checkbox" checked={prefs.push} disabled={pending} onChange={(e) => change("push", e.target.checked)} />
        {t("prefPush")}
        <EnablePushButton />
      </label>
      <label className={row}>
        <input type="checkbox" checked={prefs.email} disabled={pending} onChange={(e) => change("email", e.target.checked)} />
        {t("prefEmail")}
      </label>
      <p className="text-xs text-gray-500 dark:text-slate-400">{t("prefHint")}</p>
    </div>
  );
};

export default MyDutyPrefs;
