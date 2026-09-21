import { SignIn } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

const SignInPage = async () => {
  const t = await getTranslations("SignIn");
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-lamaSkyLight px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        <div className="mb-6 flex items-center gap-2">
          <Image src="/Alan.png" alt={t("logoAlt")} width={28} height={28} />
          <h1 className="text-xl font-bold text-gray-800">Alan International School</h1>
        </div>

        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-700">{t("heading")}</h2>
          <p className="text-sm text-gray-500">{t("subheading")}</p>
        </div>
        <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" />
      </div>
    </div>
  );
};

export default SignInPage;
