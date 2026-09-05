"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";

// Official school daily routine ("Режим дня") for the 2026-2027 academic
// year. The two class groups run on different bell schedules, so each is
// its own column pair; the "additional activities / clubs" block is a
// single wider slot for the younger group but sits alongside an extra
// 8th period for the older group, hence the rowSpan below.
const YOUNGER_GROUP_LABEL =
  "0a,0b,0c,1a-к,1b-к,1c-к,1d-к,1a-r,1b-r,2a,2b,2c,2d,2e,3a,3b,3c,3d,3e,4a,4b,4c,4d";
const OLDER_GROUP_LABEL =
  "5a,5b,5c,6a,6b,6c,7a,7b,7c,8a,8b,8c,9a,9b,9c,10a,10c,10d,11a,11b,11c";

const CLUBS_ROW_LABEL =
  "Дополнительные занятия, выполнение домашнего задания, кружки и секции";

const cell = "border border-blue-200 dark:border-slate-700 p-2";
const labelCell = `${cell} font-medium`;
const timeCell = `${cell} whitespace-nowrap`;

const DailyRoutineButton = () => {
  const t = useTranslations("Navbar");
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    if (open) document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open]);

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="circle-icon-btn cursor-pointer"
        aria-label={t("dailyRoutine")}
        title={t("dailyRoutine")}
      >
        <Image src="/calendar.png" alt="" width={20} height={20} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[8vh] px-4 bg-blue-950/40 backdrop-blur-sm dark:bg-black/60 overflow-y-auto"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-4xl rounded-2xl border border-blue-100 bg-white shadow-2xl shadow-blue-900/20 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/40 p-5 mb-[8vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4 gap-4">
              <div>
                <h1 className="text-lg font-bold text-blue-900 dark:text-blue-100">
                  РЕЖИМ ДНЯ
                </h1>
                <p className="text-xs text-blue-500 dark:text-blue-400">
                  2026-2027 учебный год
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t("close")}
                title={t("close")}
                className="circle-icon-btn shrink-0"
              >
                <Image
                  src="/close.png"
                  alt=""
                  width={14}
                  height={14}
                  className="dark:invert dark:opacity-70"
                />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs sm:text-sm">
                <thead>
                  <tr>
                    <th
                      colSpan={2}
                      className="border border-blue-200 dark:border-slate-700 bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100 font-semibold p-2 text-left align-top"
                    >
                      {YOUNGER_GROUP_LABEL} КЛАССЫ
                    </th>
                    <th
                      colSpan={2}
                      className="border border-blue-200 dark:border-slate-700 bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100 font-semibold p-2 text-left align-top"
                    >
                      {OLDER_GROUP_LABEL} КЛАССЫ
                    </th>
                  </tr>
                </thead>
                <tbody className="text-blue-900 dark:text-blue-100">
                  <tr>
                    <td className={labelCell}>Завтрак</td>
                    <td className={timeCell}>8:30 – 8:55</td>
                    <td className={labelCell}>1 урок</td>
                    <td className={timeCell}>8:30 – 9:10</td>
                  </tr>
                  <tr>
                    <td className={labelCell}>1 урок</td>
                    <td className={timeCell}>8:55 – 9:35</td>
                    <td className={labelCell}>Завтрак</td>
                    <td className={timeCell}>9:10 – 9:40</td>
                  </tr>
                  <tr>
                    <td className={labelCell}>2 урок</td>
                    <td className={timeCell}>9:40 – 10:20</td>
                    <td className={labelCell}>2 урок</td>
                    <td className={timeCell}>9:40 – 10:20</td>
                  </tr>
                  <tr>
                    <td className={labelCell}>3 урок</td>
                    <td className={timeCell}>10:25 – 11:05</td>
                    <td className={labelCell}>3 урок</td>
                    <td className={timeCell}>10:25 – 11:05</td>
                  </tr>
                  <tr>
                    <td className={labelCell}>4 урок</td>
                    <td className={timeCell}>11:10 – 11:50</td>
                    <td className={labelCell}>4 урок</td>
                    <td className={timeCell}>11:10 – 11:50</td>
                  </tr>
                  <tr>
                    <td className={labelCell}>5 урок</td>
                    <td className={timeCell}>11:55 – 12:35</td>
                    <td className={labelCell}>5 урок</td>
                    <td className={timeCell}>11:55 – 12:35</td>
                  </tr>
                  <tr>
                    <td className={labelCell}>Обед</td>
                    <td className={timeCell}>12:35 – 13:10</td>
                    <td className={labelCell}>6 урок</td>
                    <td className={timeCell}>12:40 – 13:20</td>
                  </tr>
                  <tr>
                    <td className={labelCell}>6 урок</td>
                    <td className={timeCell}>13:10 – 13:50</td>
                    <td className={labelCell}>Обед</td>
                    <td className={timeCell}>13:20 – 13:55</td>
                  </tr>
                  <tr>
                    <td className={labelCell}>7 урок</td>
                    <td className={timeCell}>13:55 – 14:35</td>
                    <td className={labelCell}>7 урок</td>
                    <td className={timeCell}>13:55 – 14:35</td>
                  </tr>
                  <tr>
                    <td rowSpan={2} className={`${labelCell} align-top`}>
                      {CLUBS_ROW_LABEL}
                    </td>
                    <td rowSpan={2} className={`${timeCell} align-top`}>
                      14:40 – 16:30
                    </td>
                    <td className={labelCell}>8 урок</td>
                    <td className={timeCell}>14:40 – 15:20</td>
                  </tr>
                  <tr>
                    <td className={`${labelCell} align-top`}>{CLUBS_ROW_LABEL}</td>
                    <td className={`${timeCell} align-top`}>15:25 – 16:50</td>
                  </tr>
                  <tr>
                    <td className={labelCell}>Полдник</td>
                    <td className={timeCell}>16:30 – 17:00</td>
                    <td className={labelCell}>Полдник</td>
                    <td className={timeCell}>16:50 – 17:00</td>
                  </tr>
                  <tr>
                    <td className={labelCell}>Отъезд</td>
                    <td className={timeCell}>17:00</td>
                    <td className={labelCell}>Отъезд</td>
                    <td className={timeCell}>17:00</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DailyRoutineButton;
