"use client";

import { useEffect } from "react";
import { useClerk } from "@clerk/nextjs";
import { useTranslations } from "next-intl";

const LogoutPage = () => {
  const { signOut } = useClerk();
  const t = useTranslations("Common");

  useEffect(() => {
    signOut({ redirectUrl: "/sign-in" });
  }, [signOut]);

  return (
    <div className="p-4">
      <div className="bg-white rounded-md p-6 shadow-sm max-w-md">
        <h1 className="text-lg font-semibold">{t("signingOut")}</h1>
      </div>
    </div>
  );
};

export default LogoutPage;
