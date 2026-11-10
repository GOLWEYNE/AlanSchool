import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { CalendarCheck, ChevronRight, FileText, Trophy } from "lucide-react";
import { Rise } from "@/components/dashboard/HomeBlocks";

// Phone-only "Today" summary for parents: one iOS-grouped-list card per child
// with the three things a parent opens the app for (is my child in school,
// is an exam coming, how did the last test go). Hidden from tablets up, where
// the full dashboard is shown instead.
export type ParentTodayCard = {
  id: string;
  name: string;
  className: string;
  todayPresent: number;
  todayTotal: number;
  nextExam: { title: string; startTime: Date } | null;
  latest: { title: string; score: number; total: number | null } | null;
};

const ParentTodayCards = async ({ cards }: { cards: ParentTodayCard[] }) => {
  const t = await getTranslations("Dashboards.parent");
  const format = await getFormatter();
  if (cards.length === 0) return null;

  const attendance = (card: ParentTodayCard) => {
    if (card.todayTotal === 0) {
      return { text: t("attNotMarked"), tone: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" };
    }
    if (card.todayPresent === card.todayTotal) {
      return { text: t("attPresent"), tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" };
    }
    if (card.todayPresent === 0) {
      return { text: t("attAbsent"), tone: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300" };
    }
    return {
      text: t("attPartly", { present: card.todayPresent, total: card.todayTotal }),
      tone: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    };
  };

  const row =
    "flex min-h-14 items-center gap-3 px-4 py-2.5 border-t border-blue-100/70 dark:border-slate-700/60 active:bg-blue-50/60 dark:active:bg-slate-800/60";

  return (
    <div className="flex flex-col gap-3 md:hidden">
      {cards.map((card, index) => {
        const att = attendance(card);
        return (
          <Rise key={card.id} i={1 + index}>
            <section aria-label={card.name} className="glass-surface overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-4">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-500 dark:text-blue-400">
                    {t("today")}
                  </p>
                  <h2 className="truncate text-xl font-bold text-blue-950 dark:text-blue-50">{card.name}</h2>
                </div>
                <span className="glass-chip glass-chip--gold shrink-0">{card.className}</span>
              </div>

              <div className={row}>
                <CalendarCheck size={20} className="shrink-0 text-blue-600 dark:text-blue-300" aria-hidden="true" />
                <span className="min-w-0 flex-1 text-sm font-medium text-blue-900 dark:text-blue-100">
                  {t("attendanceToday")}
                </span>
                <span className={`max-w-[55%] rounded-full px-3 py-1 text-right text-xs font-semibold ${att.tone}`}>
                  {att.text}
                </span>
              </div>

              <Link href="/dashboard/list/exams" className={row}>
                <FileText size={20} className="shrink-0 text-blue-600 dark:text-blue-300" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-blue-900 dark:text-blue-100">{t("nextExam")}</span>
                  <span className="block truncate text-xs text-blue-800/70 dark:text-blue-200/70">
                    {card.nextExam
                      ? `${card.nextExam.title} · ${format.dateTime(card.nextExam.startTime, { day: "numeric", month: "short" })}`
                      : t("noUpcomingExam")}
                  </span>
                </span>
                <ChevronRight size={18} className="shrink-0 text-blue-400" aria-hidden="true" />
              </Link>

              <Link href="/dashboard/list/results" className={row}>
                <Trophy size={20} className="shrink-0 text-yellow-600 dark:text-yellow-400" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-blue-900 dark:text-blue-100">{t("latestResult")}</span>
                  <span className="block truncate text-xs text-blue-800/70 dark:text-blue-200/70">
                    {card.latest
                      ? `${card.latest.title} · ${card.latest.score}${card.latest.total ? "/" + card.latest.total : ""}`
                      : t("noResultsYet")}
                  </span>
                </span>
                <ChevronRight size={18} className="shrink-0 text-blue-400" aria-hidden="true" />
              </Link>
            </section>
          </Rise>
        );
      })}
    </div>
  );
};

export default ParentTodayCards;
