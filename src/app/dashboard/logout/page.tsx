"use client";

import { useEffect } from "react";
import { useClerk } from "@clerk/nextjs";

const LogoutPage = () => {
  const { signOut } = useClerk();

  useEffect(() => {
    signOut({ redirectUrl: "/sign-in" });
  }, [signOut]);

  return (
    <div className="p-4">
      <div className="bg-white rounded-md p-6 shadow-sm max-w-md">
        <h1 className="text-lg font-semibold">Signing you out...</h1>
      </div>
    </div>
  );
};

export default LogoutPage;
