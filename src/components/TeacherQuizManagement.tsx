'use client';

import { FileDown } from 'lucide-react';
import { ReactNode } from 'react';
import { useFormatter, useTranslations } from 'next-intl';

type QuizQuestion = {
  text: string;
  options: string[];
  correctIndex: number;
  points: number;
};

// A "quiz" has no table of its own - it's an Assignment (see
// src/app/dashboard/list/quizzes/page.tsx) whose `questions` field is a
// non-empty array, filtered and fetched straight from Prisma there.
// `actions` is the real AssignmentForm-backed create/update/delete UI,
// same as Assignment Management - there's nothing local/mock left here.
type QuizRow = {
  id: number;
  title: string;
  dueDate: Date;
  totalMarks: number | null;
  // Prisma's Json? field types as JsonValue | null, not our narrower
  // QuizQuestion[] shape - kept as unknown here (same pattern as
  // TeacherExamManagement/TeacherAssignmentManagement) and narrowed with
  // Array.isArray at each use site below.
  questions: unknown;
  lesson: {
    subject: { name: string };
    class: { name: string };
  };
  actions: ReactNode;
};

const getQuestions = (questions: unknown): QuizQuestion[] =>
  Array.isArray(questions) ? (questions as QuizQuestion[]) : [];

const TeacherQuizManagement = ({
  quizzes,
  createButton,
}: {
  quizzes: QuizRow[];
  createButton: ReactNode;
}) => {
  const t = useTranslations('Assessments');
  const format = useFormatter();
  const fmtDate = (d: Date | string) =>
    format.dateTime(new Date(d), { year: 'numeric', month: 'numeric', day: 'numeric' });
  const downloadQuizAsWord = (quiz: QuizRow) => {
    const questions = getQuestions(quiz.questions);
    const content = `
ALAN INTERNATIONAL SCHOOL
${quiz.lesson.subject.name} - ${quiz.title}

${t('doc.classLine', { name: quiz.lesson.class.name })}
${t('doc.totalQuestions', { count: questions.length })}
${quiz.totalMarks ? t('doc.totalMarks', { count: quiz.totalMarks }) : ""}
${t('doc.dueDate', { date: fmtDate(quiz.dueDate) })}

${t('doc.instructions')}
1. ${t('doc.answerAll')}
2. ${t('doc.showWorking')}
3. ${t('doc.manageTime')}
4. ${t('doc.submitBeforeDue')}
    `;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${quiz.lesson.subject.name}_Quiz.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-6 bg-white dark:bg-gray-900 rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">{t('mgmt.quizTitle')}</h2>
        {createButton}
      </div>

      <div className="space-y-3">
        {quizzes.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400 text-center py-8">
            {t('mgmt.noQuizzes')}
          </p>
        ) : (
          quizzes.map((quiz) => {
            const questions = getQuestions(quiz.questions);
            return (
              <div
                key={quiz.id}
                className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-md transition"
              >
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-800 dark:text-white">{quiz.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {quiz.lesson.subject.name} • {quiz.lesson.class.name} • {t('mgmt.questions', { count: questions.length })}
                    {quiz.totalMarks ? ` • ${t('mgmt.marks', { count: quiz.totalMarks })}` : ""}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500">
                    {t('mgmt.due', { date: fmtDate(quiz.dueDate) })}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => downloadQuizAsWord(quiz)}
                    className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded flex items-center gap-1 text-sm"
                  >
                    <FileDown size={16} />
                    {t('mgmt.download')}
                  </button>
                  {quiz.actions}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default TeacherQuizManagement;
