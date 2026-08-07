"use client";

import { SignOutButton } from "@clerk/nextjs";

const SettingsPage = () => {
  return (
    <div className="p-4">
      <div className="bg-white rounded-md p-6 shadow-sm max-w-3xl">
        <h1 className="text-2xl font-semibold mb-4">Settings</h1>
        <p className="text-sm text-gray-600 mb-6">
          Account-level preferences and security actions.
        </p>
        <div className="flex items-center justify-between p-4 rounded-md border border-gray-200">
          <div>
            <h2 className="font-medium">Logout</h2>
            <p className="text-xs text-gray-500">End your current session safely.</p>
          </div>
          <SignOutButton>
            <button className="px-4 py-2 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-700">
              Logout
            </button>
          </SignOutButton>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
