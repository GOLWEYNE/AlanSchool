'use client';

import { FileDown } from 'lucide-react';
import { ReactNode } from 'react';
import { useFormatter, useTranslations } from 'next-intl';

// One row's worth of what the Exam Management list needs to render. This
// intentionally mirrors the shape src/app/dashboard/list/exam-management/page.tsx
// fetches straight from Prisma (Exam + its lesson's subject/class) - there's
// no local/mock data here anymore, and `actions` is the real
// create/update/delete UI (FormContainer -> ExamForm -> createExam/updateExam,
// the same server actions and DB-backed form used on /dashboard/list/exams).
type ExamRow = {
  id: number;
  title: string;
  description: string | null;
  startTime: Date;
  endTime: Date;
  totalMarks: number | null;
  durationMinutes: number | null;
  questions: unknown;
  lesson: {
    subject: { name: string };
    class: { name: string };
  };
  actions: ReactNode;
};

const TeacherExamManagement = ({
  exams,
  createButton,
}: {
  exams: ExamRow[];
  createButton: ReactNode;
}) => {
  const t = useTranslations('Assessments');
  const format = useFormatter();
  const formatDate = (d: Date | string) =>
    format.dateTime(new Date(d), { year: 'numeric', month: 'numeric', day: 'numeric' });
  const formatTime = (d: Date | string) =>
    format.dateTime(new Date(d), { hour: '2-digit', minute: '2-digit' });
  const downloadExamAsWord = (exam: ExamRow) => {
    const content = `
ALAN INTERNATIONAL SCHOOL
${exam.lesson.subject.name} - ${exam.title}

${t('doc.classLine', { name: exam.lesson.class.name })}
${t('doc.examDate', { date: formatDate(exam.startTime) })}
${t('doc.examTime', { time: formatTime(exam.startTime) })}
${exam.durationMinutes ? t('doc.duration', { count: exam.durationMinutes }) : ""}
${exam.totalMarks ? t('doc.totalMarks', { count: exam.totalMarks }) : ""}

${t('doc.description')}
${exam.description || t('doc.noDescription')}

${t('doc.instructions')}
1. ${t('doc.readCarefully')}
${exam.durationMinutes ? `2. ${t('doc.timeLimit', { count: exam.durationMinutes })}` : ""}
3. ${t('doc.answerAll')}
4. ${t('doc.showCalcWorking')}
5. ${t('doc.manageTime')}
6. ${t('doc.submitBeforeTime')}
    `;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exam.lesson.subject.name}_Exam_${new Date(exam.startTime).toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-6 bg-white dark:bg-gray-900 rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">{t('mgmt.examTitle')}</h2>
        {createButton}
      </div>

      <div className="space-y-3">
        {exams.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400 text-center py-8">{t('mgmt.noExams')}</p>
        ) : (
          exams.map((exam) => {
            const questionCount = Array.isArray(exam.questions) ? exam.questions.length : 0;
            return (
              <div
                key={exam.id}
                className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-md transition"
              >
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-800 dark:text-white">{exam.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {exam.lesson.subject.name} • {exam.lesson.class.name}
                    {exam.durationMinutes ? ` • ${t('mgmt.minutesShort', { count: exam.durationMinutes })}` : ""}
                    {exam.totalMarks ? ` • ${t('mgmt.marks', { count: exam.totalMarks })}` : ""}
                    {questionCount > 0
                      ? ` • ${t('mgmt.autoGraded', { count: questionCount })}`
                      : ""}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500">
                    {t('mgmt.dateAt', { date: formatDate(exam.startTime), time: formatTime(exam.startTime) })}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => downloadExamAsWord(exam)}
                    className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded flex items-center gap-1 text-sm"
                  >
                    <FileDown size={16} />
                    {t('mgmt.download')}
                  </button>
                  {exam.actions}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default TeacherExamManagement;
