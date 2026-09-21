'use client';

import { FileDown } from 'lucide-react';
import { ReactNode } from 'react';
import { useFormatter, useTranslations } from 'next-intl';

// Mirrors what src/app/dashboard/list/assignment-management/page.tsx fetches
// straight from Prisma (Assignment + its lesson's subject/class). `actions`
// is the real create/update/delete UI (FormContainer -> AssignmentForm ->
// createAssignment/updateAssignment, the same DB-backed form used on
// /dashboard/list/assignments) - nothing here is local/mock state anymore.
type AssignmentRow = {
  id: number;
  title: string;
  description: string | null;
  startDate: Date;
  dueDate: Date;
  totalMarks: number | null;
  questions: unknown;
  lesson: {
    subject: { name: string };
    class: { name: string };
  };
  actions: ReactNode;
};

const TeacherAssignmentManagement = ({
  assignments,
  createButton,
}: {
  assignments: AssignmentRow[];
  createButton: ReactNode;
}) => {
  const t = useTranslations('Assessments');
  const format = useFormatter();
  const fmtDate = (d: Date | string) =>
    format.dateTime(new Date(d), { year: 'numeric', month: 'numeric', day: 'numeric' });
  const downloadAssignmentAsWord = (assignment: AssignmentRow) => {
    const content = `
ALAN INTERNATIONAL SCHOOL
${assignment.lesson.subject.name} - ${t('doc.assignmentWord')}

${t('doc.assignmentLine', { title: assignment.title })}
${t('doc.classLine', { name: assignment.lesson.class.name })}
${assignment.totalMarks ? t('doc.totalMarks', { count: assignment.totalMarks }) : ""}
${t('doc.dueDate', { date: fmtDate(assignment.dueDate) })}

${t('doc.description')}
${assignment.description || t('doc.noDescription')}

${t('doc.submissionInstructions')}
1. ${t('doc.subCompleteAll')}
2. ${t('doc.subViaPortal')}
3. ${t('doc.subLateMarked')}
4. ${t('doc.subFollowFormat')}
5. ${t('doc.subIncludeName')}

${t('doc.gradingCriteria')}
- ${t('doc.critCompleteness')}
- ${t('doc.critAccuracy')}
- ${t('doc.critPresentation')}
    `;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${assignment.lesson.subject.name}_Assignment_${new Date(assignment.dueDate).toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-6 bg-white dark:bg-gray-900 rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">{t('mgmt.assignmentTitle')}</h2>
        {createButton}
      </div>

      <div className="space-y-3">
        {assignments.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400 text-center py-8">{t('mgmt.noAssignments')}</p>
        ) : (
          assignments.map((assignment) => {
            const questionCount = Array.isArray(assignment.questions) ? assignment.questions.length : 0;
            return (
              <div
                key={assignment.id}
                className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-md transition"
              >
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                    {assignment.title}
                    {questionCount > 0 && (
                      <span className="text-[10px] font-semibold uppercase tracking-wide bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 px-2 py-0.5 rounded-full">
                        {t('mgmt.quizBadge')}
                      </span>
                    )}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {assignment.lesson.subject.name} • {assignment.lesson.class.name}
                    {assignment.totalMarks ? ` • ${t('mgmt.marks', { count: assignment.totalMarks })}` : ""}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500">
                    {t('mgmt.due', { date: fmtDate(assignment.dueDate) })}
                  </p>
                  {assignment.description && (
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      {assignment.description.length > 100
                        ? `${assignment.description.substring(0, 100)}...`
                        : assignment.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => downloadAssignmentAsWord(assignment)}
                    className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded flex items-center gap-1 text-sm"
                  >
                    <FileDown size={16} />
                    {t('mgmt.download')}
                  </button>
                  {assignment.actions}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default TeacherAssignmentManagement;
