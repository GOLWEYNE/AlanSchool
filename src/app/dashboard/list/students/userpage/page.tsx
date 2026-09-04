import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { getUserRole } from "@/lib/auth";
import MyCamera from "@/components/MyCamera";
import Link from "next/link";
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

  return (
    <div className="flex-1 p-4 md:p-8 bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-800 dark:text-white mb-2">
          Welcome, {student.name}!
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">Student Dashboard - Grade {student.grade.level}</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600 dark:text-gray-400">Today's Lessons</p>
          <p className="text-3xl font-bold text-blue-600">
            {student.class?.lessons?.filter(l => new Date(l.startTime).toDateString() === new Date().toDateString()).length || 0}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600 dark:text-gray-400">Total Lessons</p>
          <p className="text-3xl font-bold text-green-600">{student.class?.lessons?.length || 0}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600 dark:text-gray-400">Submissions</p>
          <p className="text-3xl font-bold text-purple-600">{student.submissions?.length || 0}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600 dark:text-gray-400">Assessments</p>
          <p className="text-3xl font-bold text-orange-600">{student.results?.length || 0}</p>
        </div>
      </div>

      {/* My Schedule Section */}
      <div className="mb-8 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="text-blue-600" size={28} />
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
            My Schedule
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
                      Teacher: {lesson.teacher.name} {lesson.teacher.surname}
                    </p>
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

      {/* Student Features Grid */}
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

      {/* Exams & Assignments */}
      <div className="mb-8 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="text-green-600" size={28} />
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
            My Exams & Assignments
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
                        {result.exam ? "📝 Exam" : "📋 Assignment"} • {assessment?.lesson?.subject?.name}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg text-gray-800 dark:text-white">
                        {result.score}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Score
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-gray-600 dark:text-gray-400">No exams or assignments yet</p>
        )}
      </div>

      {/* How to Submit */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="text-purple-600" size={28} />
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
            Submission Guidelines
          </h2>
        </div>
        <div className="space-y-3 text-gray-600 dark:text-gray-400">
          <p>
            📄 <strong>Format:</strong> Exams and assignments are provided in Word format (.docx)
          </p>
          <p>
            ⏱️ <strong>Deadlines:</strong> Check the due date and duration for each assessment
          </p>
          <p>
            📤 <strong>Submission:</strong> Complete the work and submit through the assignment portal
          </p>
          <p>
            ✅ <strong>Status:</strong> Track submission status and receive feedback from teachers
          </p>
          <p className="pt-3 border-t border-gray-200 dark:border-gray-700">
            💡 <strong>Tips:</strong> Start assignments early, read instructions carefully, and submit before deadlines to avoid late penalties.
          </p>
        </div>
      </div>
    </div>
  );
};

export default StudentUserPage;
