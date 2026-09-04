'use client';

import { useState } from 'react';
import { Plus, Edit, Trash2, FileDown } from 'lucide-react';

interface Assignment {
  id: number;
  title: string;
  subject: string;
  class: string;
  student?: string;
  description: string;
  dueDate: string;
  totalMarks: number;
  attachmentUrl?: string;
  createdBy: string;
}

const TeacherAssignmentManagement = () => {
  const [assignments, setAssignments] = useState<Assignment[]>([
    {
      id: 1,
      title: "Chapter 5 - Practice Problems",
      subject: "Mathematics",
      class: "Grade 8A",
      description: "Solve all problems from page 150-155",
      dueDate: "2026-09-12",
      totalMarks: 25,
      createdBy: "teacher1",
    },
  ]);

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<Partial<Assignment>>({
    title: '',
    subject: '',
    class: '',
    description: '',
    dueDate: '',
    totalMarks: 0,
  });

  const handleAddAssignment = (e: React.FormEvent) => {
    e.preventDefault();
    const newAssignment: Assignment = {
      id: Date.now(),
      title: formData.title || '',
      subject: formData.subject || '',
      class: formData.class || '',
      description: formData.description || '',
      dueDate: formData.dueDate || '',
      totalMarks: formData.totalMarks || 0,
      createdBy: 'teacher1',
    };
    setAssignments([...assignments, newAssignment]);
    setFormData({});
    setShowForm(false);
  };

  const handleDeleteAssignment = (id: number) => {
    setAssignments(assignments.filter(a => a.id !== id));
  };

  const downloadAssignmentAsWord = (assignment: Assignment) => {
    const content = `
ALAN INTERNATIONAL SCHOOL
${assignment.subject} - Assignment

Assignment: ${assignment.title}
Class: ${assignment.class}
Total Marks: ${assignment.totalMarks}
Due Date: ${assignment.dueDate}

Description:
${assignment.description}

Submission Instructions:
1. Complete all the assigned work
2. Submit through the assignment portal before the due date
3. Late submissions will be marked as late
4. Follow the format provided by your teacher
5. Include your name and class on the submission

Grading Criteria:
- Completeness (30%)
- Accuracy (40%)
- Presentation (30%)
    `;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${assignment.subject}_Assignment_${assignment.dueDate}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-6 bg-white dark:bg-gray-900 rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Assignment Management</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold flex items-center gap-2"
        >
          <Plus size={20} />
          Create Assignment
        </button>
      </div>

      {showForm && (
        <div className="mb-6 p-6 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <form onSubmit={handleAddAssignment} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Assignment Title"
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
                value={formData.dueDate || ''}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
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
              placeholder="Assignment Description and Instructions"
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              rows={3}
              required
            />
            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-semibold"
              >
                Save Assignment
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

      {/* Assignments List */}
      <div className="space-y-3">
        {assignments.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400 text-center py-8">No assignments created yet</p>
        ) : (
          assignments.map((assignment) => (
            <div
              key={assignment.id}
              className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-md transition"
            >
              <div className="flex-1">
                <h3 className="font-semibold text-gray-800 dark:text-white">{assignment.title}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {assignment.subject} • {assignment.class} • {assignment.totalMarks} Marks
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500">Due: {assignment.dueDate}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{assignment.description.substring(0, 100)}...</p>
              </div>
              <div className="flex gap-2 ml-4">
                <button
                  onClick={() => downloadAssignmentAsWord(assignment)}
                  className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded flex items-center gap-1 text-sm"
                >
                  <FileDown size={16} />
                  Download
                </button>
                <button className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded flex items-center gap-1 text-sm">
                  <Edit size={16} />
                </button>
                <button
                  onClick={() => handleDeleteAssignment(assignment.id)}
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

export default TeacherAssignmentManagement;
