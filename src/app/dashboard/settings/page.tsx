"use client";

import { SignOutButton } from "@clerk/nextjs";
import { useTranslations } from "next-intl";

const SettingsPage = () => {
  const tm = useTranslations("Menu");
  const t = useTranslations("Profiles.account");
  return (
    <div className="p-4">
      <div className="bg-white rounded-md p-6 shadow-sm max-w-3xl">
        <h1 className="text-2xl font-semibold mb-4">{tm("settings")}</h1>
        <p className="text-sm text-gray-600 mb-6">
          {t("settingsSubtitle")}
        </p>
        <div className="flex items-center justify-between p-4 rounded-md border border-gray-200">
          <div>
            <h2 className="font-medium">{tm("logout")}</h2>
            <p className="text-xs text-gray-500">{t("logoutDesc")}</p>
          </div>
          <SignOutButton>
            <button className="px-4 py-2 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-700">
              {tm("logout")}
            </button>
          </SignOutButton>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
