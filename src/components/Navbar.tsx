import { UserButton } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server";
import { getTranslations } from "next-intl/server";
import Image from "next/image";
import Link from "next/link";
import MobileMenuButton from "./MobileMenuButton";
import LanguageSwitcher from "./LanguageSwitcher";

const Navbar = async () => {
  const user = await currentUser();
  const t = await getTranslations("Navbar");
  return (
    <div className="mx-4 mt-4 panel-card px-4 py-3 flex items-center justify-between">
      <MobileMenuButton />
      {/* SEARCH BAR */}
      <div className="hidden md:flex items-center gap-2 text-xs rounded-full border border-blue-200 bg-gradient-to-r from-white to-blue-50 px-3">
        <Image src="/search.png" alt="" width={14} height={14} />
        <input
          type="text"
          placeholder={t("searchPlaceholder")}
          className="w-[220px] p-2 bg-transparent outline-none text-blue-900 placeholder:text-blue-400"
        />
      </div>
      {/* ICONS AND USER */}
      <div className="flex items-center gap-6 justify-end w-full">
        <div className="flex items-center gap-2">
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
              className="text-xs font-semibold text-blue-800 bg-blue-50 border border-blue-200 rounded-full px-3 py-1 hover:bg-blue-100 transition-colors"
            >
              {t("settings")}
            </Link>
            <Link
              href="/dashboard/logout"
              className="text-xs font-semibold text-white bg-blue-600 rounded-full px-3 py-1 hover:bg-blue-700 transition-colors"
            >
              {t("logout")}
            </Link>
          </div>
          <LanguageSwitcher />
        </div>
        <div className="circle-icon-btn cursor-pointer">
          <Image src="/message.png" alt="" width={20} height={20} />
        </div>
        <div className="circle-icon-btn cursor-pointer relative">
          <Image src="/announcement.png" alt="" width={20} height={20} />
          <div className="absolute -top-3 -right-3 w-5 h-5 flex items-center justify-center bg-blue-600 text-white rounded-full text-xs">
            1
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-xs leading-3 font-semibold text-blue-900">AIS</span>
          <span className="text-[10px] text-blue-700 text-right bg-blue-50 border border-blue-100 rounded-full px-2 py-0.5 mt-1 capitalize">
            {user?.publicMetadata?.role as string}
          </span>
        </div>
        {/* <Image src="/avatar.png" alt="" width={36} height={36} className="rounded-full"/> */}
        <UserButton />
      </div>
    </div>
  );
};

export default Navbar;
