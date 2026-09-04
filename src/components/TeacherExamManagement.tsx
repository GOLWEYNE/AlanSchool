'use client';

import { useState } from 'react';
import { Plus, Edit, Trash2, FileDown } from 'lucide-react';

interface Exam {
  id: number;
  title: string;
  subject: string;
  class: string;
  durationMinutes: number;
  totalMarks: number;
  examDate: string;
  startTime: string;
  description?: string;
  createdBy: string;
}

const TeacherExamManagement = () => {
  const [exams, setExams] = useState<Exam[]>([
    {
      id: 1,
      title: "Mid-Term Exam",
      subject: "Science",
      class: "Grade 7A",
      durationMinutes: 120,
      totalMarks: 100,
      examDate: "2026-09-15",
      startTime: "10:00",
      description: "Chapter 1-5 covering all topics",
      createdBy: "teacher1",
    },
  ]);

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<Partial<Exam>>({
    title: '',
    subject: '',
    class: '',
    durationMinutes: 0,
    totalMarks: 0,
    examDate: '',
    startTime: '',
    description: '',
  });

  const handleAddExam = (e: React.FormEvent) => {
    e.preventDefault();
    const newExam: Exam = {
      id: Date.now(),
      title: formData.title || '',
      subject: formData.subject || '',
      class: formData.class || '',
      durationMinutes: formData.durationMinutes || 0,
      totalMarks: formData.totalMarks || 0,
      examDate: formData.examDate || '',
      startTime: formData.startTime || '',
      description: formData.description || '',
      createdBy: 'teacher1',
    };
    setExams([...exams, newExam]);
    setFormData({});
    setShowForm(false);
  };

  const handleDeleteExam = (id: number) => {
    setExams(exams.filter(e => e.id !== id));
  };

  const downloadExamAsWord = (exam: Exam) => {
    const content = `
ALAN INTERNATIONAL SCHOOL
${exam.subject} - ${exam.title}

Class: ${exam.class}
Date: ${exam.examDate}
Time: ${exam.startTime}
Duration: ${exam.durationMinutes} minutes
Total Marks: ${exam.totalMarks}

Description:
${exam.description || 'No description provided'}

Instructions:
1. Read all questions carefully
2. You have ${exam.durationMinutes} minutes to complete the exam
3. Answer all questions
4. Show all your working for calculations
5. Manage your time wisely
6. Submit your completed exam before time runs out
    `;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exam.subject}_Exam_${exam.examDate}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-6 bg-white dark:bg-gray-900 rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Exam Management</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold flex items-center gap-2"
        >
          <Plus size={20} />
          Create Exam
        </button>
      </div>

      {showForm && (
        <div className="mb-6 p-6 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <form onSubmit={handleAddExam} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Exam Title"
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
                type="date"
                value={formData.examDate || ''}
                onChange={(e) => setFormData({ ...formData, examDate: e.target.value })}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                required
              />
              <input
                type="time"
                value={formData.startTime || ''}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                required
              />
              <input
                type="number"
                placeholder="Duration (minutes)"
                value={formData.durationMinutes || ''}
                onChange={(e) => setFormData({ ...formData, durationMinutes: parseInt(e.target.value) })}
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
            </div>
            <textarea
              placeholder="Exam Description"
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              rows={3}
            />
            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-semibold"
              >
                Save Exam
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

      {/* Exams List */}
      <div className="space-y-3">
        {exams.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400 text-center py-8">No exams created yet</p>
        ) : (
          exams.map((exam) => (
            <div
              key={exam.id}
              className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-md transition"
            >
              <div className="flex-1">
                <h3 className="font-semibold text-gray-800 dark:text-white">{exam.title}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {exam.subject} • {exam.class} • {exam.durationMinutes}min • {exam.totalMarks} Marks
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500">
                  {exam.examDate} at {exam.startTime}
                </p>
              </div>
              <div className="flex gap-2 ml-4">
                <button
                  onClick={() => downloadExamAsWord(exam)}
                  className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded flex items-center gap-1 text-sm"
                >
                  <FileDown size={16} />
                  Download
                </button>
                <button className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded flex items-center gap-1 text-sm">
                  <Edit size={16} />
                </button>
                <button
                  onClick={() => handleDeleteExam(exam.id)}
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

export default TeacherExamManagement;
