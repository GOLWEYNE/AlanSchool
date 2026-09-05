import PageHero from "@/components/PageHero";
import AttendanceMatrixForm from "@/components/AttendanceMatrixForm";
import prisma from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { getUserRole } from "@/lib/auth";

type Status = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

const STATUS_LABELS: Record<string, string> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  LATE: "Late",
  EXCUSED: "Excused",
};

const STATUS_BADGE: Record<string, string> = {
  PRESENT: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  ABSENT: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  LATE: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  EXCUSED: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
};

const todayISO = () => new Date().toISOString().slice(0, 10);

// The dedicated attendance route the sidebar link used to be missing —
// previously it pointed at the Students table. Admin/teacher get a live
// capture + monitoring grid; students get a read-only history of their own
// record. Backed entirely by the existing (until now unused)
// recordAttendanceBulk / AttendanceRecord master-module plumbing.
const AttendancePage = async ({
  searchParams,
}: {
  searchParams: { classId?: string; date?: string };
}) => {
  const { userId, sessionClaims } = auth();
  const role = getUserRole(sessionClaims);
  const date = searchParams.date || todayISO();

  if (role === "student") {
    const records = await prisma.attendanceRecord.findMany({
      where: { studentId: userId ?? "" },
      include: { class: true },
      orderBy: { date: "desc" },
      take: 60,
    });

    const total = records.length;
    const presentCount = records.filter((r) => r.status === "PRESENT").length;
    const rate = total > 0 ? Math.round((presentCount / total) * 1000) / 10 : null;

    return (
      <div className="panel-card p-4 md:p-5 flex-1 m-4 mt-0 shine-hover">
        <PageHero
          title="My Attendance"
          subtitle="Your day-by-day attendance record."
          emoji="🗓️"
          stats={[
            { label: "Records", value: total },
            { label: "Attendance Rate", value: rate !== null ? `${rate}%` : "—" },
          ]}
        />
        {records.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-slate-400 p-4">
            No attendance has been recorded yet.
          </p>
        ) : (
          <div className="data-table-shell mt-4">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-blue-50 via-sky-50 to-yellow-50 dark:from-blue-950/40 dark:via-slate-900/60 dark:to-yellow-950/20 border-b border-blue-100 dark:border-slate-800">
                <tr className="text-left text-blue-700 dark:text-blue-300 text-sm">
                  <th className="px-4 py-3 font-semibold uppercase tracking-wide text-[11px]">
                    Date
                  </th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wide text-[11px]">
                    Class
                  </th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wide text-[11px]">
                    Status
                  </th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wide text-[11px]">
                    Note
                  </th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-gray-200 dark:border-slate-800 even:bg-slate-50 dark:even:bg-slate-900/40 text-sm"
                  >
                    <td className="px-4 py-3">{new Date(r.date).toLocaleDateString()}</td>
                    <td className="px-4 py-3">{r.class.name}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          STATUS_BADGE[r.status]
                        }`}
                      >
                        {STATUS_LABELS[r.status] ?? r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-slate-400">
                      {r.note || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // admin / teacher: live capture + monitoring
  const classes =
    role === "teacher" && userId
      ? await prisma.class.findMany({
          where: {
            OR: [{ supervisorId: userId }, { lessons: { some: { teacherId: userId } } }],
          },
          orderBy: { name: "asc" },
        })
      : await prisma.class.findMany({ orderBy: { name: "asc" } });

  const selectedClassId = searchParams.classId
    ? parseInt(searchParams.classId, 10)
    : classes[0]?.id;

  const [students, existingRecords] = selectedClassId
    ? await prisma.$transaction([
        prisma.student.findMany({
          where: { classId: selectedClassId },
          select: { id: true, name: true, surname: true },
          orderBy: { name: "asc" },
        }),
        prisma.attendanceRecord.findMany({
          where: { classId: selectedClassId, date: new Date(date) },
        }),
      ])
    : [[], []];

  const recordByStudent = new Map(existingRecords.map((r) => [r.studentId, r.status as Status]));
  const presentToday = existingRecords.filter((r) => r.status === "PRESENT").length;

  return (
    <div className="panel-card p-4 md:p-5 flex-1 m-4 mt-0 shine-hover">
      <PageHero
        title="Attendance"
        subtitle="Take and monitor daily attendance by class, in real time."
        emoji="🗓️"
        stats={[
          { label: "Classes", value: classes.length },
          { label: "Roster Size", value: students.length },
          { label: "Marked Today", value: `${existingRecords.length}/${students.length}` },
          { label: "Present", value: presentToday },
        ]}
      />

      <form
        className="panel-card p-4 rounded-md mb-4 shine-hover flex flex-wrap items-end gap-4"
        method="GET"
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 dark:text-slate-400">Class</label>
          <select
            name="classId"
            defaultValue={selectedClassId}
            className="ring-[1.5px] ring-gray-300 dark:ring-slate-700 dark:bg-slate-800 dark:text-slate-100 p-2 rounded-md text-sm min-w-[10rem]"
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 dark:text-slate-400">Date</label>
          <input
            type="date"
            name="date"
            defaultValue={date}
            className="ring-[1.5px] ring-gray-300 dark:ring-slate-700 dark:bg-slate-800 dark:text-slate-100 p-2 rounded-md text-sm"
          />
        </div>
        <button className="bg-blue-500 text-white px-4 py-2 rounded-md text-sm font-semibold">
          Load roster
        </button>
      </form>

      {classes.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-slate-400 p-4">
          No classes are assigned to you yet.
        </p>
      ) : selectedClassId ? (
        <AttendanceMatrixForm
          classId={selectedClassId}
          date={date}
          students={students.map((s) => ({
            id: s.id,
            name: s.name,
            surname: s.surname,
            existingStatus: recordByStudent.get(s.id),
          }))}
        />
      ) : null}
    </div>
  );
};

export default AttendancePage;
