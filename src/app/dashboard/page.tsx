import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUserRole } from "@/lib/auth";

// The sidebar's "Home" link points here for every signed-in role. Each role
// has its own purpose-built dashboard (parent -> child's schedule/results,
// student -> their own day, teacher -> their planner, admin -> the command
// center), so Home should always land people there instead of a generic,
// impersonal welcome screen. This mirrors the post-login redirect in
// src/middleware.ts so "Home" and "just signed in" always agree.
export default async function DashboardPage() {
  const { sessionClaims } = auth();
  const role = getUserRole(sessionClaims);

  if (role === "admin" || role === "teacher" || role === "student" || role === "parent") {
    redirect(`/dashboard/${role}`);
  }

  // No recognized role yet (e.g. a brand-new account waiting on setup) -
  // show a neutral welcome instead of guessing where to send them.
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50 flex items-center justify-center p-8">
      <div className="max-w-lg text-center bg-white rounded-2xl shadow-xl p-10">
        <div className="text-6xl mb-4">🎓</div>
        <h1 className="text-3xl font-bold text-gray-800 mb-3">Welcome to Alan School</h1>
        <p className="text-gray-600">
          Your account doesn&apos;t have a role assigned yet. Please contact your
          school administrator so they can finish setting up your access.
        </p>
      </div>
    </div>
  );
}
