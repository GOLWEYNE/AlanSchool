import { UserButton } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server";
import { getTranslations } from "next-intl/server";
import Image from "next/image";
import Link from "next/link";
import MobileMenuButton from "./MobileMenuButton";
import LanguageSwitcher from "./LanguageSwitcher";
import ThemeToggle from "./ThemeToggle";
import { SearchTrigger, MobileSearchTrigger } from "./SearchTrigger";
import NotificationBell from "./NotificationBell";

const Navbar = async () => {
  const user = await currentUser();
  const t = await getTranslations("Navbar");
  const role = user?.publicMetadata?.role as string | undefined;
  // The command palette (and its backing /api/search route) only covers
  // roles that have browsable student/ticket detail pages today.
  const canSearch = role === "admin" || role === "teacher";
  return (
    <div className="mx-4 mt-4 panel-card px-4 py-3 flex items-center justify-between gap-2">
      <div className="shrink-0">
        <MobileMenuButton />
      </div>
      {/* SEARCH BAR */}
      {canSearch && <SearchTrigger />}
      {/* ICONS AND USER */}
        <div className="flex items-center gap-6 justify-end flex-1 min-w-0 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-2 shrink-0">
          {canSearch && <MobileSearchTrigger />}
          <Link
            href="/dashboard/settings"
            className="md:hidden circle-icon-btn"
            aria-label={t("openSettings")}
            title={t("settings")}
          >
            <Image src="/setting.png" alt="" width={16} height={16} />
          </Link>
          <Link
            href="/dashboard/logout"
            className="md:hidden circle-icon-btn"
            aria-label={t("logOut")}
            title={t("logout")}
          >
            <Image src="/logout.png" alt="" width={16} height={16} />
          </Link>

          <div className="hidden md:flex items-center gap-2">
            <Link
              href="/dashboard/settings"
              className="text-xs font-semibold text-blue-800 bg-blue-50 border border-blue-200 rounded-full px-3 py-1 hover:bg-blue-100 transition-colors dark:text-blue-200 dark:bg-blue-950/50 dark:border-blue-900 dark:hover:bg-blue-900/60"
            >
              {t("settings")}
            </Link>
            <Link
              href="/dashboard/logout"
              className="text-xs font-semibold text-white bg-blue-600 rounded-full px-3 py-1 hover:bg-blue-700 transition-colors dark:bg-blue-700 dark:hover:bg-blue-600"
            >
              {t("logout")}
            </Link>
          </div>
          <ThemeToggle />
          <LanguageSwitcher />
        </div>
        <div className="shrink-0">
          <NotificationBell />
        </div>
        <div className="hidden sm:flex flex-col items-end shrink-0">
          <span className="text-xs leading-3 font-semibold text-blue-900 dark:text-blue-100">AIS</span>
          <span className="text-[10px] text-blue-700 text-right bg-blue-50 border border-blue-100 rounded-full px-2 py-0.5 mt-1 capitalize dark:text-blue-300 dark:bg-blue-950/50 dark:border-blue-900">
            {user?.publicMetadata?.role as string}
          </span>
        </div>
        {/* <Image src="/avatar.png" alt="" width={36} height={36} className="rounded-full"/> */}
        <div className="shrink-0">
          <UserButton />
        </div>
      </div>
    </div>
  );
};

export default Navbar;
