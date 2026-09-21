import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { getUserRole } from "@/lib/auth";
import MyCamera from "@/components/MyCamera";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { schoolTodayLessonDay } from "@/lib/schoolTime";
import { Calendar, BookOpen, Award, FileText, Video, Clock } from "lucide-react";

const StudentUserPage = async () => {
  const { userId, sessionClaims } = await auth();
  const role = getUserRole(sessionClaims);

  if (!userId || role !== "student") {
    return notFound();
  }

  // Fetch student data
  const student = await prisma.student.findUnique({
    where: { id: userId },
    include: {
      class: {
        include: {
          lessons: {
            include: {
              teacher: true,
              subject: true,
            },
            orderBy: {
              startTime: "asc",
            },
          },
        },
      },
      grade: true,
      results: {
        include: {
          exam: {
            include: {
              lesson: {
                include: {
                  subject: true,
                },
              },
            },
          },
          assignment: {
            include: {
              lesson: {
                include: {
                  subject: true,
                },
              },
            },
          },
        },
      },
      submissions: {
        include: {
          exam: true,
          assignment: true,
        },
      },
    },
  });

  if (!student) {
    return notFound();
  }

  const t = await getTranslations("Profiles.home");
  const ts = await getTranslations("Profiles.studentHome");
  const tm = await getTranslations("Menu");
  const tc = await getTranslations("Common");
  const format = await getFormatter();

  return (
    <div className="flex-1 p-4 md:p-8 bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-800 dark:text-white mb-2">
          {t("welcome", { name: student.name })}
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">{ts("subtitle", { level: student.grade.level })}</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600 dark:text-gray-400">{t("todaysLessons")}</p>
          <p className="text-3xl font-bold text-blue-600">
            {student.class?.lessons?.filter(l => l.day === schoolTodayLessonDay()).length || 0}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600 dark:text-gray-400">{t("totalLessons")}</p>
          <p className="text-3xl font-bold text-green-600">{student.class?.lessons?.length || 0}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600 dark:text-gray-400">{ts("submissions")}</p>
          <p className="text-3xl font-bold text-purple-600">{student.submissions?.length || 0}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600 dark:text-gray-400">{t("assessments")}</p>
          <p className="text-3xl font-bold text-orange-600">{student.results?.length || 0}</p>
        </div>
      </div>

      {/* My Schedule Section */}
      <div className="mb-8 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="text-blue-600" size={28} />
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
            {t("mySchedule")}
          </h2>
        </div>
        {student.class?.lessons && student.class.lessons.length > 0 ? (
          <div className="grid gap-4">
            {student.class.lessons.slice(0, 5).map((lesson) => (
              <div
                key={lesson.id}
                className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-gray-800 dark:text-white">
                      {lesson.subject.name}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {t("teacherLine", { name: `${lesson.teacher.name} ${lesson.teacher.surname}` })}
                    </p>
                  </div>
                  <div className="text-right text-sm text-gray-600 dark:text-gray-400">
                    <p className="font-semibold">{format.dateTime(new Date(lesson.startTime), { hour: "2-digit", minute: "2-digit" })}</p>
                    <p>{tc.has(`days.${String(lesson.day).toLowerCase()}`) ? tc(`days.${String(lesson.day).toLowerCase()}`) : lesson.day}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-600 dark:text-gray-400">{t("noLessons")}</p>
        )}
      </div>

      {/* MyCamera Component */}
      <div className="mb-8 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="flex items-center gap-2 mb-4">
          <Video className="text-blue-600" size={28} />
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
            {t("videoStudio")}
          </h2>
        </div>
        <MyCamera />
      </div>

      {/* Student Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Lost & Found */}
        <Link href="/dashboard/list/tickets">
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-900/40 rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition h-full">
            <FileText className="text-orange-600 mb-3" size={32} />
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
              {tm("lostFound")}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t("reportOrFindItems")}
            </p>
          </div>
        </Link>

        {/* Featured Video */}
        <Link href="/dashboard/list/featured-video">
          <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-900/40 rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition h-full">
            <Video className="text-red-600 mb-3" size={32} />
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
              {tm("featuredVideo")}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t("watchFeatured")}
            </p>
          </div>
        </Link>
      </div>

      {/* Exams & Assignments */}
      <div className="mb-8 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="text-green-600" size={28} />
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
            {ts("myExams")}
          </h2>
        </div>
        {student.results && student.results.length > 0 ? (
          <div className="space-y-4">
            {student.results.slice(0, 6).map((result) => {
              const assessment = result.exam || result.assignment;
              return (
                <div
                  key={result.id}
                  className="p-4 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-gray-800 dark:text-white">
                        {assessment?.title}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {result.exam ? t("examBadge") : t("assignmentBadge")} • {assessment?.lesson?.subject?.name}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg text-gray-800 dark:text-white">
                        {result.score}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {ts("score")}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-gray-600 dark:text-gray-400">{ts("noExams")}</p>
        )}
      </div>

      {/* How to Submit */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="text-purple-600" size={28} />
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
            {ts("guidelinesTitle")}
          </h2>
        </div>
        <div className="space-y-3 text-gray-600 dark:text-gray-400">
          <p>
            📄 <strong>{ts("formatLabel")}</strong> {ts("formatText")}
          </p>
          <p>
            ⏱️ <strong>{ts("deadlinesLabel")}</strong> {ts("deadlinesText")}
          </p>
          <p>
            📤 <strong>{ts("submissionLabel")}</strong> {ts("submissionText")}
          </p>
          <p>
            ✅ <strong>{ts("statusLabel")}</strong> {ts("statusText")}
          </p>
          <p className="pt-3 border-t border-gray-200 dark:border-gray-700">
            💡 <strong>{ts("tipsLabel")}</strong> {ts("tipsText")}
          </p>
        </div>
      </div>
    </div>
  );
};

export default StudentUserPage;
