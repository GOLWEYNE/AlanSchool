import Announcements from "@/components/Announcements";
import BigCalendarContainer from "@/components/BigCalendarContainer";
import prisma from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";

const TeacherPage = async () => {
  const { userId } = auth();

  const [lessonsCount, assignmentsCount, examsCount, resultsCount] =
    await prisma.$transaction([
      prisma.lesson.count({ where: { teacherId: userId! } }),
      prisma.assignment.count({ where: { lesson: { teacherId: userId! } } }),
      prisma.exam.count({ where: { lesson: { teacherId: userId! } } }),
      prisma.result.count({
        where: {
          OR: [
            { exam: { lesson: { teacherId: userId! } } },
            { assignment: { lesson: { teacherId: userId! } } },
          ],
        },
      }),
    ]);

  return (
    <div className="flex-1 p-4 flex gap-4 flex-col xl:flex-row">
      {/* LEFT */}
      <div className="w-full xl:w-2/3">
        <div className="rounded-2xl p-5 mb-4 shine-hover text-white shadow-xl bg-gradient-to-r from-blue-700 via-cyan-600 to-blue-400">
          <h1 className="text-3xl font-bold">Teacher Planner</h1>
          <p className="text-cyan-50 mt-2 text-sm">Plan lessons, evaluate learners, and manage your academic flow.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-white/90 text-blue-900 px-3 py-1 text-xs font-semibold">Lessons: {lessonsCount}</span>
            <span className="rounded-full bg-white/90 text-blue-900 px-3 py-1 text-xs font-semibold">Assignments: {assignmentsCount}</span>
            <span className="rounded-full bg-white/90 text-blue-900 px-3 py-1 text-xs font-semibold">Exams: {examsCount}</span>
            <span className="rounded-full bg-white/90 text-blue-900 px-3 py-1 text-xs font-semibold">Results: {resultsCount}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <Link href="/dashboard/list/lessons" className="panel-card p-3 text-blue-900 font-semibold text-sm text-center shine-hover">My Lessons</Link>
          <Link href="/dashboard/list/assignments" className="panel-card p-3 text-blue-900 font-semibold text-sm text-center shine-hover">Assignments</Link>
          <Link href="/dashboard/list/exams" className="panel-card p-3 text-blue-900 font-semibold text-sm text-center shine-hover">Exams</Link>
          <Link href="/dashboard/list/results" className="panel-card p-3 text-blue-900 font-semibold text-sm text-center shine-hover">Results</Link>
        </div>

        <div className="h-full panel-card p-4 rounded-md">
          <h1 className="text-xl font-semibold text-blue-900">Schedule</h1>
          <BigCalendarContainer type="teacherId" id={userId!} />
        </div>
      </div>
      {/* RIGHT */}
      <div className="w-full xl:w-1/3 flex flex-col gap-8">
        <Announcements />
      </div>
    </div>
  );
};

export default TeacherPage;