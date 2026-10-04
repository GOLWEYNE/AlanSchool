import prisma from "./prisma";

// Deleting a student or teacher used to fail whenever they had anything
// attached: almost every table that points at a student/teacher is a required
// relation with Prisma's default "restrict" behavior, so Postgres refused the
// delete until each linked row had been removed by hand (and removing a
// lesson first needs its attendance, exams and assignments gone, and so on).
//
// These helpers do that clean-up for the admin, inside ONE transaction: either
// the person and everything that hung off them are gone, or nothing changed.
// Optional links (class supervisor, club instructor, ticket student, ...) are
// not touched here - the database already clears those to NULL on delete.

export async function deleteStudentCascade(studentId: string) {
  await prisma.$transaction([
    prisma.result.deleteMany({ where: { studentId } }),
    prisma.attendance.deleteMany({ where: { studentId } }),
    prisma.studentSubmission.deleteMany({ where: { studentId } }),
    prisma.attendanceRecord.deleteMany({ where: { studentId } }),
    prisma.behaviorLog.deleteMany({ where: { studentId } }),
    prisma.permissionResponse.deleteMany({ where: { studentId } }),
    prisma.portfolioItem.deleteMany({ where: { studentId } }),
    prisma.reportCard.deleteMany({ where: { studentId } }),
    prisma.conferenceBooking.deleteMany({ where: { studentId } }),
    prisma.clubEnrollment.deleteMany({ where: { studentId } }),
    prisma.clubAttendance.deleteMany({ where: { studentId } }),
    // Study goals and uniform checks cascade at the database level.
    prisma.student.delete({ where: { id: studentId } }),
  ]);
}

export async function deleteTeacherCascade(teacherId: string) {
  const lessons = await prisma.lesson.findMany({
    where: { teacherId },
    select: { id: true },
  });
  const lessonIds = lessons.map((l) => l.id);

  const [exams, assignments, slots] = await Promise.all([
    prisma.exam.findMany({
      where: { lessonId: { in: lessonIds } },
      select: { id: true },
    }),
    prisma.assignment.findMany({
      where: { lessonId: { in: lessonIds } },
      select: { id: true },
    }),
    prisma.conferenceSlot.findMany({
      where: { teacherId },
      select: { id: true },
    }),
  ]);
  const examIds = exams.map((e) => e.id);
  const assignmentIds = assignments.map((a) => a.id);
  const slotIds = slots.map((s) => s.id);

  const onTheirWork = {
    OR: [
      { examId: { in: examIds } },
      { assignmentId: { in: assignmentIds } },
    ],
  };

  await prisma.$transaction([
    // Work set in this teacher's lessons, and everything students handed in
    // or scored on it.
    prisma.result.deleteMany({ where: onTheirWork }),
    prisma.studentSubmission.deleteMany({ where: onTheirWork }),
    prisma.exam.deleteMany({ where: { id: { in: examIds } } }),
    prisma.assignment.deleteMany({ where: { id: { in: assignmentIds } } }),
    // Required links to the lessons themselves. (AttendanceRecord.lessonId is
    // optional, so those daily records are kept and just lose the lesson.)
    prisma.attendance.deleteMany({ where: { lessonId: { in: lessonIds } } }),
    prisma.lesson.deleteMany({ where: { teacherId } }),
    prisma.behaviorLog.deleteMany({ where: { teacherId } }),
    prisma.conferenceBooking.deleteMany({ where: { slotId: { in: slotIds } } }),
    prisma.conferenceSlot.deleteMany({ where: { teacherId } }),
    prisma.teacher.delete({ where: { id: teacherId } }),
  ]);
}
