// Pure "at-risk student" rules for the class-supervisor dashboard.
//
// Kept free of Prisma/Next imports so the rules can be unit-tested and tuned in
// one place. A student is at risk when at least one signal trips; the signals
// are deliberately simple and explainable so a supervisor can see WHY a child
// was flagged (the dashboard prints the reasons next to the name).

export const RISK_RULES = {
  // Attendance: look at the last 14 days.
  attendanceWindowDays: 14,
  // ABSENT on this many distinct days (EXCUSED never counts)...
  absentDays: 3,
  // ...or an attendance rate below this share of the days with a record.
  minAttendanceRate: 0.8,
  // Need at least this many recorded days before the rate rule applies, so one
  // missed day out of two does not flag anybody.
  minRecordedDaysForRate: 5,

  // Behavior: look at the last 30 days.
  behaviorWindowDays: 30,
  // This many CONCERN/INCIDENT entries...
  negativeBehaviorEntries: 2,
  // ...or any INCIDENT inside this many days.
  recentIncidentDays: 14,

  // Uniform: look at the last 7 days (same as the Uniform Check page).
  uniformWindowDays: 7,
  // This many days that were not FULL uniform.
  uniformNonCompliantDays: 3,
} as const;

export type RiskReason =
  | { kind: "absences"; days: number }
  | { kind: "attendanceRate"; percent: number }
  | { kind: "behaviorConcerns"; count: number }
  | { kind: "incident"; count: number }
  | { kind: "uniform"; days: number };

export type AttendanceInput = { day: string; status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED" };
export type BehaviorInput = { day: string; type: "POSITIVE" | "CONCERN" | "INCIDENT" };
export type UniformInput = { day: string; status: "FULL" | "PARTIAL" | "NONE" };

// `day` values are YYYY-MM-DD strings; `since*` cut-offs are inclusive YYYY-MM-DD
// strings, which compare correctly as plain strings.
export type RiskInput = {
  attendance: AttendanceInput[];
  behavior: BehaviorInput[];
  uniform: UniformInput[];
  sinceAttendance: string;
  sinceBehavior: string;
  sinceIncident: string;
  sinceUniform: string;
};

export type AttendanceSummary = {
  recordedDays: number;
  attendedDays: number;
  absentDays: number;
  rate: number | null; // 0..1, null when there is nothing to measure
};

// Collapse per-lesson records into one verdict per calendar day: a day counts as
// ABSENT if any record that day is ABSENT, else attended if any is PRESENT/LATE,
// else (all EXCUSED) it is ignored entirely.
export function summariseAttendance(records: AttendanceInput[], since: string): AttendanceSummary {
  const perDay = new Map<string, { absent: boolean; attended: boolean }>();
  for (const r of records) {
    if (r.day < since || r.status === "EXCUSED") continue;
    const cur = perDay.get(r.day) ?? { absent: false, attended: false };
    if (r.status === "ABSENT") cur.absent = true;
    else cur.attended = true;
    perDay.set(r.day, cur);
  }
  let absentDays = 0;
  let attendedDays = 0;
  perDay.forEach((v) => {
    if (v.absent) absentDays += 1;
    else if (v.attended) attendedDays += 1;
  });
  const recordedDays = absentDays + attendedDays;
  return {
    recordedDays,
    attendedDays,
    absentDays,
    rate: recordedDays === 0 ? null : attendedDays / recordedDays,
  };
}

export function computeRiskReasons(input: RiskInput): RiskReason[] {
  const reasons: RiskReason[] = [];
  const R = RISK_RULES;

  const att = summariseAttendance(input.attendance, input.sinceAttendance);
  if (att.absentDays >= R.absentDays) {
    reasons.push({ kind: "absences", days: att.absentDays });
  } else if (
    att.rate !== null &&
    att.recordedDays >= R.minRecordedDaysForRate &&
    att.rate < R.minAttendanceRate
  ) {
    reasons.push({ kind: "attendanceRate", percent: Math.round(att.rate * 100) });
  }

  const negatives = input.behavior.filter(
    (b) => b.day >= input.sinceBehavior && b.type !== "POSITIVE"
  ).length;
  const incidents = input.behavior.filter(
    (b) => b.day >= input.sinceIncident && b.type === "INCIDENT"
  ).length;
  if (incidents > 0) {
    reasons.push({ kind: "incident", count: incidents });
  } else if (negatives >= R.negativeBehaviorEntries) {
    reasons.push({ kind: "behaviorConcerns", count: negatives });
  }

  const badUniformDays = new Set(
    input.uniform.filter((u) => u.day >= input.sinceUniform && u.status !== "FULL").map((u) => u.day)
  ).size;
  if (badUniformDays >= R.uniformNonCompliantDays) {
    reasons.push({ kind: "uniform", days: badUniformDays });
  }

  return reasons;
}

export type ClassAttendanceInput = AttendanceInput & { studentId: string };

export type DailyRate = { day: string; attended: number; absent: number; rate: number | null };

// One entry per requested day. Each student contributes at most one verdict per
// day (absent beats attended; EXCUSED is ignored), mirroring summariseAttendance.
export function classDailyRates(records: ClassAttendanceInput[], days: string[]): DailyRate[] {
  const perDay = new Map<string, Map<string, "absent" | "attended">>();
  for (const r of records) {
    if (r.status === "EXCUSED") continue;
    const students = perDay.get(r.day) ?? new Map<string, "absent" | "attended">();
    const prev = students.get(r.studentId);
    if (r.status === "ABSENT") students.set(r.studentId, "absent");
    else if (prev !== "absent") students.set(r.studentId, "attended");
    perDay.set(r.day, students);
  }
  return days.map((day) => {
    let attended = 0;
    let absent = 0;
    perDay.get(day)?.forEach((v) => {
      if (v === "absent") absent += 1;
      else attended += 1;
    });
    const total = attended + absent;
    return { day, attended, absent, rate: total === 0 ? null : attended / total };
  });
}
