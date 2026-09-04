"use client";

type LessonLite = { id: number; name: string; classId: number };
type StudentLite = { id: string; name: string; surname: string; classId: number };

// Whole-class vs. specific-student targeting for an exam or assignment.
// Leaving every box unchecked (the default) keeps today's behavior - the
// whole class the lesson belongs to. Checking students narrows it to just
// them, e.g. for a make-up exam or a differentiated assignment.
const WorkTargetPicker = ({
  lessons,
  students,
  selectedLessonId,
  register,
  defaultTargetIds,
}: {
  lessons: LessonLite[];
  students: StudentLite[];
  selectedLessonId: number | string | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: any;
  defaultTargetIds?: string[];
}) => {
  const lesson = lessons.find((l) => String(l.id) === String(selectedLessonId));
  const classStudents = lesson ? students.filter((s) => s.classId === lesson.classId) : [];

  return (
    <div className="flex flex-col gap-2 w-full">
      <label className="text-xs text-gray-500 dark:text-slate-400">Assign to</label>
      <p className="text-xs text-gray-400 dark:text-slate-500">
        Leave every box unchecked to send this to the whole class. Check specific students to
        send it only to them.
      </p>
      <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto rounded-lg border border-gray-200 dark:border-slate-700 p-2">
        {classStudents.length === 0 ? (
          <span className="text-xs text-gray-400 dark:text-slate-500 p-1">
            Pick a lesson above to see its students.
          </span>
        ) : (
          classStudents.map((s) => (
            <label
              key={s.id}
              className="flex items-center gap-1.5 text-xs bg-gray-50 dark:bg-slate-800 rounded-full px-2.5 py-1 cursor-pointer"
            >
              <input
                type="checkbox"
                value={s.id}
                defaultChecked={defaultTargetIds?.includes(s.id)}
                {...register("targetStudentIds")}
              />
              {s.name} {s.surname}
            </label>
          ))
        )}
      </div>
    </div>
  );
};

export default WorkTargetPicker;
