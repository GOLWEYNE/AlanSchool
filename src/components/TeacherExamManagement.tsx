'use client';

import { FileDown } from 'lucide-react';
import { ReactNode } from 'react';

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

const formatDate = (d: Date) => new Date(d).toLocaleDateString();
const formatTime = (d: Date) =>
  new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const TeacherExamManagement = ({
  exams,
  createButton,
}: {
  exams: ExamRow[];
  createButton: ReactNode;
}) => {
  const downloadExamAsWord = (exam: ExamRow) => {
    const content = `
ALAN INTERNATIONAL SCHOOL
${exam.lesson.subject.name} - ${exam.title}

Class: ${exam.lesson.class.name}
Date: ${formatDate(exam.startTime)}
Time: ${formatTime(exam.startTime)}
${exam.durationMinutes ? `Duration: ${exam.durationMinutes} minutes` : ""}
${exam.totalMarks ? `Total Marks: ${exam.totalMarks}` : ""}

Description:
${exam.description || 'No description provided'}

Instructions:
1. Read all questions carefully
${exam.durationMinutes ? `2. You have ${exam.durationMinutes} minutes to complete the exam` : ""}
3. Answer all questions
4. Show all your working for calculations
5. Manage your time wisely
6. Submit your completed exam before time runs out
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
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Exam Management</h2>
        {createButton}
      </div>

      <div className="space-y-3">
        {exams.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400 text-center py-8">No exams created yet</p>
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
                    {exam.durationMinutes ? ` • ${exam.durationMinutes}min` : ""}
                    {exam.totalMarks ? ` • ${exam.totalMarks} Marks` : ""}
                    {questionCount > 0
                      ? ` • ${questionCount} auto-graded question${questionCount === 1 ? "" : "s"}`
                      : ""}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500">
                    {formatDate(exam.startTime)} at {formatTime(exam.startTime)}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => downloadExamAsWord(exam)}
                    className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded flex items-center gap-1 text-sm"
                  >
                    <FileDown size={16} />
                    Download
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
