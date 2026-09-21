'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { BookOpen, FileText, Users, Plus } from 'lucide-react';

const AssessmentHub = () => {
  const t = useTranslations('Assessments');
  const tm = useTranslations('Menu');
  return (
    <div className="flex-1 p-4 md:p-8 bg-gray-50 dark:bg-gray-900">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-800 dark:text-white mb-2">
          {tm('assessmentHub')}
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">{t('hub.subtitle')}</p>
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
              {t('mgmt.quizTitle')}
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              {t('hub.quizDesc')}
            </p>
            <div className="mt-4 text-sm text-blue-600 font-semibold">
              {t('hub.clickToManage')}
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
              {t('mgmt.examTitle')}
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              {t('hub.examDesc')}
            </p>
            <div className="mt-4 text-sm text-purple-600 font-semibold">
              {t('hub.clickToManage')}
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
              {t('mgmt.assignmentTitle')}
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              {t('hub.assignmentDesc')}
            </p>
            <div className="mt-4 text-sm text-green-600 font-semibold">
              {t('hub.clickToManage')}
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
              {t('hub.submissionsTitle')}
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              {t('hub.submissionsDesc')}
            </p>
            <div className="mt-4 text-sm text-orange-600 font-semibold">
              {t('hub.clickToReview')}
            </div>
          </div>
        </Link>
      </div>

      {/* Features Overview */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">
          {t('hub.keyFeatures')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-bold text-gray-800 dark:text-white mb-2">{t('hub.wordTitle')}</h3>
            <p className="text-gray-600 dark:text-gray-400">
              {t('hub.wordDesc')}
            </p>
          </div>
          <div>
            <h3 className="font-bold text-gray-800 dark:text-white mb-2">{t('hub.deadlineTitle')}</h3>
            <p className="text-gray-600 dark:text-gray-400">
              {t('hub.deadlineDesc')}
            </p>
          </div>
          <div>
            <h3 className="font-bold text-gray-800 dark:text-white mb-2">{t('hub.gradingTitle')}</h3>
            <p className="text-gray-600 dark:text-gray-400">
              {t('hub.gradingDesc')}
            </p>
          </div>
          <div>
            <h3 className="font-bold text-gray-800 dark:text-white mb-2">{t('hub.easyTitle')}</h3>
            <p className="text-gray-600 dark:text-gray-400">
              {t('hub.easyDesc')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssessmentHub;
