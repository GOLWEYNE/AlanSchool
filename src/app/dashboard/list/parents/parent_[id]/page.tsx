import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { getUserRole } from "@/lib/auth";
import MyCamera from "@/components/MyCamera";
import Link from "next/link";
import { Calendar, Award, FileText, Video, User, BookOpen, MessageSquare } from "lucide-react";

const ParentDashboard = async ({ params }: { params: { id: string } }) => {
  const { userId, sessionClaims } = await auth();
  const role = getUserRole(sessionClaims);

  if (!userId || role !== "parent") {
    return notFound();
  }

  // Fetch parent and their students
  const parent = await prisma.parent.findUnique({
    where: { id: userId },
    include: {
      students: {
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
        },
      },
    },
  });

  if (!parent) {
    return notFound();
  }

  const student = parent.students[0]; // Primary student view

  return (
    <div className="flex-1 p-4 md:p-8 bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-800 dark:text-white mb-2">
          Welcome, {parent.name}!
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">Parent Dashboard - Monitor Your Children's Progress</p>
      </div>

      {/* Students Overview */}
      {parent.students && parent.students.length > 0 && (
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
            <User className="text-blue-600" size={28} />
            Your Children
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {parent.students.map((std) => (
              <div
                key={std.id}
                className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 hover:shadow-lg transition"
              >
                <p className="font-bold text-lg text-gray-800 dark:text-white">
                  {std.name} {std.surname}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Grade {std.grade.level}
                </p>
                <div className="flex gap-2">
                  <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded">
                    📚 {std.class?.lessons?.length || 0} Lessons
                  </span>
                  <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-1 rounded">
                    ✅ {std.results?.length || 0} Assessments
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {student && (
        <>
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Lessons</p>
              <p className="text-3xl font-bold text-blue-600">{student.class?.lessons?.length || 0}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
              <p className="text-sm text-gray-600 dark:text-gray-400">Assessments</p>
              <p className="text-3xl font-bold text-green-600">{student.results?.length || 0}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
              <p className="text-sm text-gray-600 dark:text-gray-400">Teachers</p>
              <p className="text-3xl font-bold text-purple-600">
                {student.class?.lessons?.map(l => l.teacher.id).filter((v, i, a) => a.indexOf(v) === i).length || 0}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
              <p className="text-sm text-gray-600 dark:text-gray-400">Avg Performance</p>
              <p className="text-3xl font-bold text-orange-600">
                {student.results?.length > 0
                  ? Math.round((student.results.reduce((a, b) => a + (b.score || 0), 0) / student.results.length))
                  : 0}%
              </p>
            </div>
          </div>

          {/* Primary Student Schedule */}
          <div className="mb-8 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="text-blue-600" size={28} />
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
                {student.name}'s Schedule
              </h2>
            </div>
            {student.class?.lessons && student.class.lessons.length > 0 ? (
              <div className="grid gap-4">
                {student.class.lessons.slice(0, 6).map((lesson) => (
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
                          Teacher: {lesson.teacher.name} {lesson.teacher.surname}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Room: {lesson.room || "TBA"}</p>
                      </div>
                      <div className="text-right text-sm text-gray-600 dark:text-gray-400">
                        <p className="font-semibold">{new Date(lesson.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        <p>{lesson.day}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600 dark:text-gray-400">No lessons scheduled</p>
            )}
          </div>

          {/* MyCamera Component */}
          <div className="mb-8 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex items-center gap-2 mb-4">
              <Video className="text-blue-600" size={28} />
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
                Video Recording Studio
              </h2>
            </div>
            <MyCamera />
          </div>

          {/* Parent Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Lost & Found */}
            <Link href="/dashboard/list/tickets">
              <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-900/40 rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition h-full">
                <FileText className="text-orange-600 mb-3" size={32} />
                <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
                  Lost & Found
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Report or find lost items
                </p>
              </div>
            </Link>

            {/* Featured Video */}
            <Link href="/dashboard/list/featured-video">
              <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-900/40 rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition h-full">
                <Video className="text-red-600 mb-3" size={32} />
                <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
                  Featured Video
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Watch featured school videos
                </p>
              </div>
            </Link>
          </div>

          {/* Student Academic Progress */}
          <div className="mb-8 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex items-center gap-2 mb-4">
              <BookOpen className="text-green-600" size={28} />
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
                Academic Progress
              </h2>
            </div>
            {student.results && student.results.length > 0 ? (
              <div className="space-y-4">
                {student.results.slice(0, 8).map((result) => {
                  const assessment = result.exam || result.assignment;
                  return (
                    <div
                      key={result.id}
                      className="p-4 border border-green-200 dark:border-green-800 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 transition"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-semibold text-gray-800 dark:text-white">
                            {assessment?.title}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {result.exam ? "📝 Exam" : "📋 Assignment"} • {assessment?.lesson?.subject?.name}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg text-gray-800 dark:text-white">
                            {result.score}%
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {result.score >= 80 ? "🌟 Excellent" : result.score >= 60 ? "✅ Good" : "📈 Needs Improvement"}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-600 dark:text-gray-400">
                No results available yet
              </p>
            )}
          </div>

          {/* Parent Communication */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
              <MessageSquare className="text-purple-600" size={28} />
              Stay Connected
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Communicate directly with teachers about your child's progress, ask questions, and stay informed about school activities.
            </p>
            <div className="flex gap-4">
              <Link href="/dashboard/list/messages">
                <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold">
                  Message Teachers
                </button>
              </Link>
              <Link href="/dashboard/list/events">
                <button className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-semibold">
                  View Events
                </button>
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ParentDashboard;
