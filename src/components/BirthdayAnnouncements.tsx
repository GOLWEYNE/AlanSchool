import prisma from "@/lib/prisma";
import Image from "next/image";

type BirthdayPerson = {
  id: string;
  name: string;
  surname: string;
  img: string | null;
  birthday: Date;
  role: "teacher" | "student";
};

const TEACHER_WISHES = [
  "Thank you for shaping bright futures every single day — enjoy your special day!",
  "Wishing you a day as bright and inspiring as the lessons you teach.",
  "Happy Birthday! Alan International School is lucky to have you.",
  "Here's to another wonderful year of teaching, growing, and inspiring young minds.",
];

const STUDENT_WISHES = [
  "Wishing you a fantastic day filled with fun, cake, and celebration!",
  "Happy Birthday! Keep shining bright in and out of the classroom.",
  "Hope your special day is as amazing as you are — enjoy every moment!",
  "Another year older, another year of amazing achievements ahead. Happy Birthday!",
];

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

  const dateLabel = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
  }).format(today);

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
          🎉 Birthdays
        </h1>
        <span className="text-xs bg-white/20 rounded-full px-2 py-1">
          {dateLabel}
        </span>
      </div>

      {todayPeople.length > 0 ? (
        <div className="relative mt-4 flex flex-col gap-3">
          {todayPeople.map((p) => {
            const wishes = p.role === "teacher" ? TEACHER_WISHES : STUDENT_WISHES;
            const wish = wishes[hashToIndex(p.id, wishes.length)];
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
                      {p.role === "teacher" ? "Teacher" : "Student"}
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
            No birthdays today — but here&apos;s who&apos;s up next 👀
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
                      in {p.daysUntil} day{p.daysUntil === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-white/70 mt-2">
              No birthdays in the next two weeks.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default BirthdayAnnouncements;
