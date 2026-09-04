import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { getUserRole } from "@/lib/auth";
import MyCamera from "@/components/MyCamera";
import TeacherQuizManagement from "@/components/TeacherQuizManagement";
import TeacherExamManagement from "@/components/TeacherExamManagement";
import TeacherAssignmentManagement from "@/components/TeacherAssignmentManagement";
import TeacherStudentWork from "@/components/TeacherStudentWork";
import Link from "next/link";
import { Calendar, BookOpen, Award, FileText, Video, Users } from "lucide-react";

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
    <div className="flex-1 p-4 md:p-8 bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-800 dark:text-white mb-2">
          Welcome, {teacher.name}!
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">Teacher Dashboard - Manage Your Classes & Assessments</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600 dark:text-gray-400">Classes Assigned</p>
          <p className="text-3xl font-bold text-blue-600">{teacher.classes?.length || 0}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600 dark:text-gray-400">Subjects Teaching</p>
          <p className="text-3xl font-bold text-green-600">{teacher.subjects?.length || 0}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600 dark:text-gray-400">Today's Lessons</p>
          <p className="text-3xl font-bold text-purple-600">
            {teacher.lessons?.filter(l => new Date(l.startTime).toDateString() === new Date().toDateString()).length || 0}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600 dark:text-gray-400">Total Lessons</p>
          <p className="text-3xl font-bold text-orange-600">{teacher.lessons?.length || 0}</p>
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
        {teacher.lessons && teacher.lessons.length > 0 ? (
          <div className="grid gap-4">
            {teacher.lessons.slice(0, 5).map((lesson) => (
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

      {/* Teacher Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Announcements */}
        <Link href="/dashboard/list/announcements">
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-900/40 rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition h-full">
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
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-900/40 rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition h-full">
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
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-900/40 rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition h-full">
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

      {/* Quiz Management */}
      <div className="mb-8 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="flex items-center gap-2 mb-6">
          <BookOpen className="text-green-600" size={28} />
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
            Quiz Management
          </h2>
        </div>
        <TeacherQuizManagement />
      </div>

      {/* Exam Management */}
      <div className="mb-8 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="flex items-center gap-2 mb-6">
          <BookOpen className="text-indigo-600" size={28} />
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
            Exam Management
          </h2>
        </div>
        <TeacherExamManagement />
      </div>

      {/* Assignment Management */}
      <div className="mb-8 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="flex items-center gap-2 mb-6">
          <FileText className="text-teal-600" size={28} />
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
            Assignment Management
          </h2>
        </div>
        <TeacherAssignmentManagement />
      </div>

      {/* Student Work Management */}
      <div className="mb-8 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="flex items-center gap-2 mb-6">
          <Users className="text-cyan-600" size={28} />
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
            Student Submissions & Grading
          </h2>
        </div>
        <TeacherStudentWork />
      </div>
    </div>
  );
};

export default TeacherUserPage;
