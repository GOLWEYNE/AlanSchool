import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { getUserRole } from "@/lib/auth";
import MyCamera from "@/components/MyCamera";
import Link from "next/link";
import { Calendar, BookOpen, Award, FileText, Video } from "lucide-react";

const TeacherUserPage = async () => {
  const { userId, sessionClaims } = await auth();
  const role = getUserRole(sessionClaims);

  if (!userId || role !== "teacher") {
    return notFound();
  }

  // Fetch teacher data
  const teacher = await prisma.teacher.findUnique({
    where: { id: userId },
    include: {
      classes: true,
      subjects: true,
      lessons: {
        include: {
          class: true,
          subject: true,
        },
        orderBy: {
          startTime: "asc",
        },
      },
    },
  });

  if (!teacher) {
    return notFound();
  }

  return (
    <div className="flex-1 p-4 md:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">
          Welcome, {teacher.name}!
        </h1>
        <p className="text-gray-600 dark:text-gray-400">Teacher Dashboard</p>
      </div>

      {/* My Schedule Section */}
      <div className="mb-8 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
            My Schedule
          </h2>
        </div>
        {teacher.lessons && teacher.lessons.length > 0 ? (
          <div className="grid gap-4">
            {teacher.lessons.map((lesson) => (
              <div
                key={lesson.id}
                className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-gray-800 dark:text-white">
                      {lesson.name}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {lesson.subject.name}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Class: {lesson.class.name}
                    </p>
                  </div>
                  <div className="text-right text-sm text-gray-600 dark:text-gray-400">
                    <p>{new Date(lesson.startTime).toLocaleTimeString()}</p>
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
          <Video className="text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
            Video Recording
          </h2>
        </div>
        <MyCamera />
      </div>

      {/* Teacher Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Announcements */}
        <Link href="/dashboard/list/announcements">
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-900/40 rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition">
            <FileText className="text-purple-600 mb-3" size={32} />
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
              Announcements
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              View and manage class announcements
            </p>
          </div>
        </Link>

        {/* Report Cards */}
        <Link href="/dashboard/list/report-cards">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-900/40 rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition">
            <Award className="text-blue-600 mb-3" size={32} />
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
              Report Cards
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Generate and manage student report cards
            </p>
          </div>
        </Link>

        {/* Lost & Found */}
        <Link href="/dashboard/list/tickets">
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-900/40 rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition">
            <FileText className="text-orange-600 mb-3" size={32} />
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
              Lost & Found
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Manage lost and found items
            </p>
          </div>
        </Link>

        {/* Featured Video */}
        <Link href="/dashboard/list/featured-video">
          <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-900/40 rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition">
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

      {/* Quiz & Exams */}
      <div className="mb-8 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="text-green-600" />
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
            Quiz & Exams Management
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="/dashboard/list/exams">
            <div className="p-4 border border-green-200 dark:border-green-800 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 transition cursor-pointer">
              <p className="font-semibold text-gray-800 dark:text-white">View All Exams</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Create, edit, or delete exams for your classes
              </p>
            </div>
          </Link>
          <div className="p-4 border border-green-200 dark:border-green-800 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 transition cursor-pointer">
            <p className="font-semibold text-gray-800 dark:text-white">Create Exam</p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Create new exam in Word format
            </p>
          </div>
          <Link href="/dashboard/list/assignments">
            <div className="p-4 border border-green-200 dark:border-green-800 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 transition cursor-pointer">
              <p className="font-semibold text-gray-800 dark:text-white">Assignments</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Create and manage student assignments
              </p>
            </div>
          </Link>
        </div>
      </div>

      {/* Student Work Management */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">
          Student Work Management
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Review, grade, and provide feedback on student submissions. Delete student work when necessary.
        </p>
        <Link href="/dashboard/list/assignments">
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold">
            Manage Student Work
          </button>
        </Link>
      </div>
    </div>
  );
};

export default TeacherUserPage;
