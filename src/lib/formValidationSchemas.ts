import { z } from "zod";

export const subjectSchema = z.object({
  id: z.coerce.number().optional(),
  name: z.string().min(1, { message: "Subject name is required!" }),
  teachers: z.array(z.string()), //teacher ids
});

export type SubjectSchema = z.infer<typeof subjectSchema>;

export const classSchema = z.object({
  id: z.coerce.number().optional(),
  name: z.string().min(1, { message: "Subject name is required!" }),
  capacity: z.coerce.number().min(1, { message: "Capacity name is required!" }),
  gradeId: z.coerce.number().min(1, { message: "Grade name is required!" }),
  supervisorId: z.coerce.string().optional(),
});

export type ClassSchema = z.infer<typeof classSchema>;

export const teacherSchema = z.object({
  id: z.string().optional(),
  username: z
    .string()
    .min(3, { message: "Username must be at least 3 characters long!" })
    .max(20, { message: "Username must be at most 20 characters long!" }),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters long!" })
    .optional()
    .or(z.literal("")),
  name: z.string().min(1, { message: "First name is required!" }),
  surname: z.string().min(1, { message: "Last name is required!" }),
  email: z
    .string()
    .email({ message: "Invalid email address!" })
    .optional()
    .or(z.literal("")),
  phone: z.string().optional(),
  address: z.string(),
  img: z.string().optional(),
  bloodType: z.string().min(1, { message: "Blood Type is required!" }),
  birthday: z.coerce.date({ message: "Birthday is required!" }),
  sex: z.enum(["MALE", "FEMALE"], { message: "Sex is required!" }),
  subjects: z.array(z.string()).optional(), // subject ids
});

export type TeacherSchema = z.infer<typeof teacherSchema>;

export const studentSchema = z.object({
  id: z.string().optional(),
  username: z
    .string()
    .min(3, { message: "Username must be at least 3 characters long!" })
    .max(20, { message: "Username must be at most 20 characters long!" }),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters long!" })
    .optional()
    .or(z.literal("")),
  name: z.string().min(1, { message: "First name is required!" }),
  surname: z.string().min(1, { message: "Last name is required!" }),
  email: z
    .string()
    .email({ message: "Invalid email address!" })
    .optional()
    .or(z.literal("")),
  phone: z.string().optional(),
  address: z.string(),
  img: z.string().optional(),
  bloodType: z.string().min(1, { message: "Blood Type is required!" }),
  birthday: z.coerce.date({ message: "Birthday is required!" }),
  sex: z.enum(["MALE", "FEMALE"], { message: "Sex is required!" }),
  gradeId: z.coerce.number().min(1, { message: "Grade is required!" }),
  classId: z.coerce.number().min(1, { message: "Class is required!" }),
  parentId: z.string().min(1, { message: "Parent Id is required!" }),
});

export type StudentSchema = z.infer<typeof studentSchema>;

export const parentSchema = z.object({
  id: z.string().optional(),
  username: z
    .string()
    .min(3, { message: "Username must be at least 3 characters long!" })
    .max(20, { message: "Username must be at most 20 characters long!" }),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters long!" })
    .optional()
    .or(z.literal("")),
  name: z.string().min(1, { message: "First name is required!" }),
  surname: z.string().min(1, { message: "Last name is required!" }),
  email: z
    .string()
    .email({ message: "Invalid email address!" })
    .optional()
    .or(z.literal("")),
  phone: z.string().min(1, { message: "Phone is required!" }),
  address: z.string().min(1, { message: "Address is required!" }),
});

export type ParentSchema = z.infer<typeof parentSchema>;

// A single auto-graded multiple-choice question attached to an exam or
// assignment. Stored as JSON on Exam.questions / Assignment.questions.
export const quizQuestionSchema = z.object({
  text: z.string().min(1, { message: "Question text is required!" }),
  options: z
    .array(z.string().min(1, { message: "Option text is required!" }))
    .min(2, { message: "Add at least 2 options!" }),
  correctIndex: z.coerce.number().int().min(0, { message: "Pick the correct option!" }),
  points: z.coerce.number().int().min(1).default(1),
});

export type QuizQuestion = z.infer<typeof quizQuestionSchema>;

// The quiz builder in the form serializes its question list to a JSON
// string in a hidden input; this preprocesses that string back into a
// typed, validated array (or leaves it undefined when the quiz is off).
const questionsField = z.preprocess((val) => {
  if (typeof val !== "string") return val;
  if (!val.trim()) return undefined;
  try {
    return JSON.parse(val);
  } catch {
    return val; // invalid JSON - let the array/object validation below fail it
  }
}, z.array(quizQuestionSchema).optional());

// Checkbox groups (a single input name reused per option) come back from
// react-hook-form as a string when only one box is checked, so this
// normalizes to a string array either way. An empty/omitted list means
// "the whole class" everywhere this field is used.
const targetStudentIdsField = z
  .preprocess((val) => {
    if (val === undefined || val === null || val === "") return [];
    return Array.isArray(val) ? val : [val];
  }, z.array(z.string()))
  .default([]);

export const examSchema = z.object({
  id: z.coerce.number().optional(),
  title: z.string().min(1, { message: "Title name is required!" }),
  description: z.string().optional(),
  startTime: z.coerce.date({ message: "Start time is required!" }),
  endTime: z.coerce.date({ message: "End time is required!" }),
  totalMarks: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().int().min(1).optional()
  ),
  durationMinutes: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().int().min(1).optional()
  ),
  instructionsFileUrl: z.string().optional(),
  instructionsFileName: z.string().optional(),
  questions: questionsField,
  targetStudentIds: targetStudentIdsField,
  lessonId: z.coerce.number({ message: "Lesson is required!" }),
});

export type ExamSchema = z.infer<typeof examSchema>;

export const assignmentSchema = z.object({
  id: z.coerce.number().optional(),
  title: z.string().min(1, { message: "Title is required!" }),
  description: z.string().optional(),
  startDate: z.coerce.date({ message: "Start date is required!" }),
  dueDate: z.coerce.date({ message: "Due date is required!" }),
  totalMarks: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().int().min(1).optional()
  ),
  instructionsFileUrl: z.string().optional(),
  instructionsFileName: z.string().optional(),
  questions: questionsField,
  targetStudentIds: targetStudentIdsField,
  lessonId: z.coerce.number({ message: "Lesson is required!" }),
});

export type AssignmentSchema = z.infer<typeof assignmentSchema>;

export const resultSchema = z.object({
  id: z.coerce.number().optional(),
  score: z.coerce.number().min(0, { message: "Score is required!" }),
  studentId: z.string().min(1, { message: "Student is required!" }),
  examId: z.coerce.number().optional(),
  assignmentId: z.coerce.number().optional(),
});

export type ResultSchema = z.infer<typeof resultSchema>;

// A student's own file/quiz submission for one exam or assignment.
export const submissionSchema = z.object({
  examId: z.coerce.number().optional(),
  assignmentId: z.coerce.number().optional(),
  fileUrl: z.string().optional(),
  fileName: z.string().optional(),
  answers: z.preprocess((val) => {
    if (typeof val !== "string") return val;
    if (!val.trim()) return undefined;
    try {
      return JSON.parse(val);
    } catch {
      return val;
    }
  }, z.array(z.coerce.number().int().min(0)).optional()),
});

export type SubmissionSchema = z.infer<typeof submissionSchema>;

// A teacher/admin grading one student's submission by hand (file-based
// work that isn't an auto-graded quiz).
export const gradeSubmissionSchema = z.object({
  submissionId: z.coerce.number({ message: "Submission is required!" }),
  grade: z.coerce.number().min(0, { message: "Grade is required!" }),
  feedback: z.string().optional(),
});

export type GradeSubmissionSchema = z.infer<typeof gradeSubmissionSchema>;

export const eventSchema = z.object({
  id: z.coerce.number().optional(),
  title: z.string().min(1, { message: "Title is required!" }),
  description: z.string().min(1, { message: "Description is required!" }),
  startTime: z.coerce.date({ message: "Start time is required!" }),
  endTime: z.coerce.date({ message: "End time is required!" }),
  classId: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().optional()
  ),
});

export type EventSchema = z.infer<typeof eventSchema>;

export const announcementSchema = z.object({
  id: z.coerce.number().optional(),
  title: z.string().min(1, { message: "Title is required!" }),
  description: z.string().min(1, { message: "Description is required!" }),
  date: z.coerce.date({ message: "Date is required!" }),
  classId: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().optional()
  ),
});

export type AnnouncementSchema = z.infer<typeof announcementSchema>;

export const lessonSchema = z.object({
  id: z.coerce.number().optional(),
  name: z.string().min(1, { message: "Lesson name is required!" }),
  day: z.enum(["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"], { message: "Day is required!" }),
  startTime: z.coerce.date({ message: "Start time is required!" }),
  endTime: z.coerce.date({ message: "End time is required!" }),
  subjectId: z.coerce.number({ message: "Subject is required!" }),
  classId: z.coerce.number({ message: "Class is required!" }),
  teacherId: z.string().min(1, { message: "Teacher is required!" }),
});

export type LessonSchema = z.infer<typeof lessonSchema>;

export const clubCategories = [
  "DANCING",
  "PIANO",
  "CHESS",
  "HANDICRAFTS",
  "FOOTBALL",
  "VOLLEYBALL",
  "BASKETBALL",
  "TENNIS",
  "TABLE_TENNIS",
  "KARATE",
  "JUDO",
  "GYMNASTICS",
  "ASYQ",
  "DOMBRA",
  "GUITAR",
  "OTHER",
] as const;

export const clubSchema = z.object({
  id: z.coerce.number().optional(),
  name: z.string().min(1, { message: "Club name is required!" }),
  category: z.enum(clubCategories, { message: "Category is required!" }),
  description: z.string().optional(),
  capacity: z.coerce.number().min(1, { message: "Capacity is required!" }),
  schedule: z.string().optional(),
  location: z.string().optional(),
  instructorId: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().optional()
  ),
});

export type ClubSchema = z.infer<typeof clubSchema>;

export const featuredVideoSchema = z.object({
  title: z.string().min(1, { message: "Title is required!" }),
  videoUrl: z
    .string()
    .min(1, { message: "Video URL is required!" })
    .url({ message: "Enter a valid video URL!" }),
});

export type FeaturedVideoSchema = z.infer<typeof featuredVideoSchema>;
