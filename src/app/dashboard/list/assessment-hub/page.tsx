'use client';

import Link from 'next/link';
import { BookOpen, FileText, Users, Plus } from 'lucide-react';

const AssessmentHub = () => {
  return (
    <div className="flex-1 p-4 md:p-8 bg-gray-50 dark:bg-gray-900">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-800 dark:text-white mb-2">
          Assessment Hub
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">Manage all your quizzes, exams, and assignments in one place</p>
      </div>

      {/* Quick Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Quiz Management */}
        <Link href="/dashboard/list/quizzes">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-900/40 rounded-lg shadow-md p-8 cursor-pointer hover:shadow-lg transition h-full">
            <div className="flex items-start justify-between mb-4">
              <BookOpen className="text-blue-600" size={40} />
              <Plus className="text-blue-600" size={24} />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
              Quiz Management
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Create and manage quizzes for your classes. Set questions, marks, and due dates.
            </p>
            <div className="mt-4 text-sm text-blue-600 font-semibold">
              Click to manage →
            </div>
          </div>
        </Link>

        {/* Exam Management */}
        <Link href="/dashboard/list/exam-management">
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-900/40 rounded-lg shadow-md p-8 cursor-pointer hover:shadow-lg transition h-full">
            <div className="flex items-start justify-between mb-4">
              <BookOpen className="text-purple-600" size={40} />
              <Plus className="text-purple-600" size={24} />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
              Exam Management
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Create exams with duration and total marks. Download as Word format for students.
            </p>
            <div className="mt-4 text-sm text-purple-600 font-semibold">
              Click to manage →
            </div>
          </div>
        </Link>

        {/* Assignment Management */}
        <Link href="/dashboard/list/assignment-management">
          <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-900/40 rounded-lg shadow-md p-8 cursor-pointer hover:shadow-lg transition h-full">
            <div className="flex items-start justify-between mb-4">
              <FileText className="text-green-600" size={40} />
              <Plus className="text-green-600" size={24} />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
              Assignment Management
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Create assignments with descriptions and due dates. Download in Word format.
            </p>
            <div className="mt-4 text-sm text-green-600 font-semibold">
              Click to manage →
            </div>
          </div>
        </Link>

        {/* Student Work */}
        <Link href="/dashboard/list/student-work">
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-900/40 rounded-lg shadow-md p-8 cursor-pointer hover:shadow-lg transition h-full">
            <div className="flex items-start justify-between mb-4">
              <Users className="text-orange-600" size={40} />
              <Plus className="text-orange-600" size={24} />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
              Student Submissions
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Review submissions, grade work, add feedback, and manage student performance.
            </p>
            <div className="mt-4 text-sm text-orange-600 font-semibold">
              Click to review →
            </div>
          </div>
        </Link>
      </div>

      {/* Features Overview */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">
          Key Features
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-bold text-gray-800 dark:text-white mb-2">✓ Word Format Documents</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Download all quizzes, exams, and assignments in Word format for easy distribution
            </p>
          </div>
          <div>
            <h3 className="font-bold text-gray-800 dark:text-white mb-2">✓ Deadline Tracking</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Set due dates and track student submissions in real-time
            </p>
          </div>
          <div>
            <h3 className="font-bold text-gray-800 dark:text-white mb-2">✓ Grading System</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Grade student work, add detailed feedback, and track marks
            </p>
          </div>
          <div>
            <h3 className="font-bold text-gray-800 dark:text-white mb-2">✓ Easy Management</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Create, edit, and delete assessments with one click
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssessmentHub;
