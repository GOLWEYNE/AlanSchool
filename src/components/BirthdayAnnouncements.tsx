import prisma from "@/lib/prisma";
import Image from "next/image";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";

type BirthdayPerson = {
  id: string;
  name: string;
  surname: string;
  img: string | null;
  birthday: Date;
  role: "teacher" | "student";
};

const WISH_COUNT = 4;

// Stable pseudo-random pick per id, so the same person gets the same
// wish across re-renders instead of a jarring flicker between requests.
const hashToIndex = (id: string, length: number) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return hash % length;
};

const daysUntilNextBirthday = (birthday: Date, today: Date) => {
  const todayMidnight = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  let next = new Date(
    today.getFullYear(),
    birthday.getMonth(),
    birthday.getDate()
  );
  if (next < todayMidnight) {
    next = new Date(
      today.getFullYear() + 1,
      birthday.getMonth(),
      birthday.getDate()
    );
  }
  return Math.round(
    (next.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24)
  );
};

const BirthdayAnnouncements = async () => {
  const t = await getTranslations("Birthdays");
  const format = await getFormatter();
  const locale = await getLocale();
  const [teachers, students] = await Promise.all([
    prisma.teacher.findMany({
      select: { id: true, name: true, surname: true, img: true, birthday: true },
    }),
    prisma.student.findMany({
      select: { id: true, name: true, surname: true, img: true, birthday: true },
    }),
  ]);

  const people: BirthdayPerson[] = [
    ...teachers.map((t) => ({ ...t, role: "teacher" as const })),
    ...students.map((s) => ({ ...s, role: "student" as const })),
  ];

  const today = new Date();
  const isToday = (d: Date) =>
    d.getMonth() === today.getMonth() && d.getDate() === today.getDate();

  const todayPeople = people.filter((p) => isToday(p.birthday));

  const upcoming = people
    .filter((p) => !isToday(p.birthday))
    .map((p) => ({ ...p, daysUntil: daysUntilNextBirthday(p.birthday, today) }))
    .filter((p) => p.daysUntil > 0 && p.daysUntil <= 14)
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, 4);

  // en keeps the existing "21 September" day-first order.
  const dateLabel =
    locale === "en"
      ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long" }).format(today)
      : format.dateTime(today, { day: "numeric", month: "long" });

  return (
    <div className="relative overflow-hidden rounded-2xl p-5 text-white shine-hover bg-gradient-to-br from-fuchsia-500 via-purple-500 to-indigo-600 shadow-lg">
      {/* decorative confetti dots */}
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "radial-gradient(circle, #fff 1.5px, transparent 1.5px)",
          backgroundSize: "18px 18px",
        }}
      />
      <div className="relative flex items-center justify-between">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          {t("title")}
        </h1>
        <span className="text-xs bg-white/20 rounded-full px-2 py-1">
          {dateLabel}
        </span>
      </div>

      {todayPeople.length > 0 ? (
        <div className="relative mt-4 flex flex-col gap-3">
          {todayPeople.map((p) => {
            const wish = t(
              `${p.role === "teacher" ? "teacherWishes" : "studentWishes"}.${hashToIndex(p.id, WISH_COUNT)}`
            );
            return (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-xl bg-white/15 p-3 backdrop-blur-sm"
              >
                <Image
                  src={p.img || "/Alan.png"}
                  alt=""
                  width={44}
                  height={44}
                  className="w-11 h-11 rounded-full object-cover ring-2 ring-white/80 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-semibold truncate">
                      {p.name} {p.surname}
                    </h2>
                    <span
                      className={`text-[10px] uppercase tracking-wide rounded-full px-2 py-0.5 font-semibold ${
                        p.role === "teacher"
                          ? "bg-amber-300 text-amber-900"
                          : "bg-sky-200 text-sky-900"
                      }`}
                    >
                      {p.role === "teacher" ? t("teacher") : t("student")}
                    </span>
                  </div>
                  <p className="text-xs text-white/90 mt-0.5">{wish}</p>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="relative mt-4">
          <p className="text-sm text-white/90">
            {t("upNext")}
          </p>
          {upcoming.length > 0 ? (
            <div className="mt-3 flex flex-col gap-2">
              {upcoming.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 rounded-xl bg-white/10 px-3 py-2"
                >
                  <Image
                    src={p.img || "/Alan.png"}
                    alt=""
                    width={32}
                    height={32}
                    className="w-8 h-8 rounded-full object-cover ring-2 ring-white/70 shrink-0"
                  />
                  <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                    <span className="text-sm font-medium truncate">
                      {p.name} {p.surname}
                    </span>
                    <span className="text-[11px] text-white/80 whitespace-nowrap">
                      {t("inDays", { count: p.daysUntil })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-white/70 mt-2">
              {t("none")}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default BirthdayAnnouncements;
