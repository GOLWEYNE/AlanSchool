import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const { userId, sessionClaims } = await auth();
  const role = (
    (sessionClaims?.role as string | undefined) ??
    (sessionClaims?.metadata as { role?: string } | undefined)?.role ??
    (sessionClaims?.publicMetadata as { role?: string } | undefined)?.role
  )?.toLowerCase();

  if (userId) {
    if (role) {
      redirect(`/dashboard/${role}`);
    }

    redirect("/dashboard");
  }

  redirect("/sign-in");
}
