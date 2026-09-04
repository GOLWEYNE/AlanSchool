'use client';

import { useState } from 'react';
import { Eye, EyeOff, Download, Trash2 } from 'lucide-react';

interface StudentSubmission {
  id: number;
  studentName: string;
  studentId: string;
  assignmentTitle: string;
  submittedAt: string;
  status: 'pending' | 'submitted' | 'late' | 'graded';
  fileUrl?: string;
  marks?: number;
  feedback?: string;
}

const TeacherStudentWork = () => {
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([
    {
      id: 1,
      studentName: "Ahmed Ali",
      studentId: "STU001",
      assignmentTitle: "Chapter 5 - Practice Problems",
      submittedAt: "2026-09-11",
      status: "submitted",
      marks: 22,
      feedback: "Good work! Minor calculation errors in Q3.",
    },
    {
      id: 2,
      studentName: "Fatima Khan",
      studentId: "STU002",
      assignmentTitle: "Chapter 5 - Practice Problems",
      submittedAt: "2026-09-12",
      status: "late",
      marks: 18,
      feedback: "Submitted late. Work is incomplete.",
    },
  ]);

  const [expandedId, setExpandedId] = useState<number | null>(null);

  const handleDeleteSubmission = (id: number) => {
    setSubmissions(submissions.filter(s => s.id !== id));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'submitted':
        return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200';
      case 'late':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200';
      case 'graded':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200';
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200';
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-6 bg-white dark:bg-gray-900 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">Student Work Submissions</h2>

      <div className="space-y-4">
        {submissions.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400 text-center py-8">No submissions yet</p>
        ) : (
          submissions.map((submission) => (
            <div
              key={submission.id}
              className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
            >
              <div
                onClick={() => setExpandedId(expandedId === submission.id ? null : submission.id)}
                className="p-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition flex justify-between items-center"
              >
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-800 dark:text-white">
                    {submission.studentName} ({submission.studentId})
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {submission.assignmentTitle}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`text-xs px-2 py-1 rounded font-semibold ${getStatusColor(submission.status)}`}>
                      {submission.status.toUpperCase()}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">Submitted: {submission.submittedAt}</span>
                  </div>
                </div>
                <button className="ml-4 text-gray-600 dark:text-gray-400">
                  {expandedId === submission.id ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>

              {/* Expanded Details */}
              {expandedId === submission.id && (
                <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-750">
                  <div className="space-y-4">
                    {/* Marks Section */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-800 dark:text-white mb-2">
                        Marks ({submission.marks || 0}/25)
                      </label>
                      <input
                        type="number"
                        defaultValue={submission.marks || 0}
                        max="25"
                        min="0"
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                      />
                    </div>

                    {/* Feedback Section */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-800 dark:text-white mb-2">
                        Feedback
                      </label>
                      <textarea
                        defaultValue={submission.feedback || ''}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                        rows={4}
                        placeholder="Provide feedback to the student..."
                      />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 justify-end">
                      <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-semibold">
                        Save Feedback
                      </button>
                      <button
                        onClick={() => handleDeleteSubmission(submission.id)}
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded font-semibold flex items-center gap-2"
                      >
                        <Trash2 size={16} />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default TeacherStudentWork;
