'use client';

import { useState } from 'react';
import { Plus, Edit, Trash2, FileDown } from 'lucide-react';
import Link from 'next/link';

interface Quiz {
  id: number;
  title: string;
  subject: string;
  class: string;
  totalQuestions: number;
  totalMarks: number;
  dueDate: string;
  createdBy: string;
}

const TeacherQuizManagement = () => {
  const [quizzes, setQuizzes] = useState<Quiz[]>([
    {
      id: 1,
      title: "Mathematics Quiz 1",
      subject: "Mathematics",
      class: "Grade 6A",
      totalQuestions: 20,
      totalMarks: 50,
      dueDate: "2026-09-10",
      createdBy: "teacher1",
    },
  ]);

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<Partial<Quiz>>({
    title: '',
    subject: '',
    class: '',
    totalQuestions: 0,
    totalMarks: 0,
    dueDate: '',
  });

  const handleAddQuiz = (e: React.FormEvent) => {
    e.preventDefault();
    const newQuiz: Quiz = {
      id: Date.now(),
      title: formData.title || '',
      subject: formData.subject || '',
      class: formData.class || '',
      totalQuestions: formData.totalQuestions || 0,
      totalMarks: formData.totalMarks || 0,
      dueDate: formData.dueDate || '',
      createdBy: 'teacher1',
    };
    setQuizzes([...quizzes, newQuiz]);
    setFormData({});
    setShowForm(false);
  };

  const handleDeleteQuiz = (id: number) => {
    setQuizzes(quizzes.filter(q => q.id !== id));
  };

  const downloadQuizAsWord = (quiz: Quiz) => {
    const content = `
ALAN INTERNATIONAL SCHOOL
${quiz.subject} - ${quiz.title}

Class: ${quiz.class}
Total Questions: ${quiz.totalQuestions}
Total Marks: ${quiz.totalMarks}
Due Date: ${quiz.dueDate}

Instructions:
1. Answer all questions
2. Show your working
3. Manage your time wisely
4. Submit before the due date
    `;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${quiz.subject}_Quiz.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-6 bg-white dark:bg-gray-900 rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Quiz Management</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold flex items-center gap-2"
        >
          <Plus size={20} />
          Create Quiz
        </button>
      </div>

      {showForm && (
        <div className="mb-6 p-6 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <form onSubmit={handleAddQuiz} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Quiz Title"
                value={formData.title || ''}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                required
              />
              <input
                type="text"
                placeholder="Subject"
                value={formData.subject || ''}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                required
              />
              <input
                type="text"
                placeholder="Class"
                value={formData.class || ''}
                onChange={(e) => setFormData({ ...formData, class: e.target.value })}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                required
              />
              <input
                type="number"
                placeholder="Total Questions"
                value={formData.totalQuestions || ''}
                onChange={(e) => setFormData({ ...formData, totalQuestions: parseInt(e.target.value) })}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                required
              />
              <input
                type="number"
                placeholder="Total Marks"
                value={formData.totalMarks || ''}
                onChange={(e) => setFormData({ ...formData, totalMarks: parseInt(e.target.value) })}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                required
              />
              <input
                type="date"
                value={formData.dueDate || ''}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                required
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-semibold"
              >
                Save Quiz
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg font-semibold"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Quizzes List */}
      <div className="space-y-3">
        {quizzes.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400 text-center py-8">No quizzes created yet</p>
        ) : (
          quizzes.map((quiz) => (
            <div
              key={quiz.id}
              className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-md transition"
            >
              <div className="flex-1">
                <h3 className="font-semibold text-gray-800 dark:text-white">{quiz.title}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {quiz.subject} • {quiz.class} • {quiz.totalQuestions} Questions • {quiz.totalMarks} Marks
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500">Due: {quiz.dueDate}</p>
              </div>
              <div className="flex gap-2 ml-4">
                <button
                  onClick={() => downloadQuizAsWord(quiz)}
                  className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded flex items-center gap-1 text-sm"
                >
                  <FileDown size={16} />
                  Download
                </button>
                <button className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded flex items-center gap-1 text-sm">
                  <Edit size={16} />
                </button>
                <button
                  onClick={() => handleDeleteQuiz(quiz.id)}
                  className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded flex items-center gap-1 text-sm"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default TeacherQuizManagement;
