import path from "path";
import {
  Circle,
  Defs,
  Document,
  Font,
  Image,
  LinearGradient,
  Page,
  Rect,
  Stop,
  StyleSheet,
  Svg,
  Text,
  View,
} from "@react-pdf/renderer";
import { SCHOOL_LOGO_DATA_URI } from "./schoolLogo";

// A printable, one-page weekly schedule (A4 landscape) for a teacher or a class.
//
// The week is drawn as a real time grid: Monday-Friday columns, hours down the
// side, and every lesson as a coloured block whose height matches its length, so
// breaks and gaps show up as empty space, exactly like the on-screen timetable.
// All times are school time (see src/lib/schoolTime.ts); the caller passes them
// in as minutes since midnight so nothing here depends on a time zone.

// Same fonts as the report card: Noto Sans covers Latin, Cyrillic and Kazakh
// letters. The files are traced into the serverless bundle by next.config.mjs.
const FONT_DIR = path.join(process.cwd(), "src", "assets", "fonts");

Font.register({
  family: "NotoSans",
  fonts: [
    { src: path.join(FONT_DIR, "NotoSans-400Regular.ttf"), fontWeight: 400 },
    { src: path.join(FONT_DIR, "NotoSans-700Bold.ttf"), fontWeight: 700 },
  ],
});
Font.registerHyphenationCallback((word) => [word]);

export type ScheduleDay = "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY";

export const SCHEDULE_DAYS: ScheduleDay[] = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"];

export type SchedulePdfLesson = {
  day: ScheduleDay;
  /** Minutes since midnight, school time. */
  startMin: number;
  endMin: number;
  subject: string;
  subjectId: number;
  className: string;
  teacherName: string;
  room: string | null;
};

export type SchedulePdfLabels = {
  schoolName: string;
  title: string;
  /** "Teacher" or "Class" */
  kind: string;
  schoolYear: string;
  statLessons: string;
  statHours: string;
  /** "Classes" (teacher schedule) or "Teachers" (class schedule) */
  statPeople: string;
  statBusiest: string;
  days: Record<ScheduleDay, string>;
  generated: string;
  timesNote: string;
  empty: string;
  /** e.g. "Room {room}" already resolved per lesson by roomLabel(). */
  roomLabel: (room: string) => string;
};

export type SchedulePdfData = {
  kind: "teacher" | "class";
  name: string;
  /** Optional extra scope line, e.g. "Class 11A" when an admin filtered by both. */
  scopeNote?: string;
  lessons: SchedulePdfLesson[];
  labels: SchedulePdfLabels;
};

// ---------------------------------------------------------------------------
// Look and feel
// ---------------------------------------------------------------------------

const PAGE_W = 842; // A4 landscape, points
const PAGE_H = 595;
const MARGIN = 26;
const CONTENT_W = PAGE_W - MARGIN * 2;
const HEADER_H = 76;
const STATS_H = 34;
const DAY_HEAD_H = 22;
const FOOTER_H = 44;
const GAP = 8;
const GUTTER_W = 40;
const BODY_H =
  PAGE_H - MARGIN * 2 - HEADER_H - STATS_H - DAY_HEAD_H - FOOTER_H - GAP * 3;
const MAX_SCALE = 1.15; // points per minute, so a short day is not stretched absurdly
const MIN_RANGE_MIN = 6 * 60;
const MAX_LEGEND = 16;

const INK = "#0f172a";
const MUTED = "#64748b";
const LINE = "#e2e8f0";
const BLUE = "#1d4ed8";

// Same palette as the on-screen timetable so a subject keeps its colour.
const SUBJECT_PALETTE = [
  "#2563eb",
  "#0d9488",
  "#c2410c",
  "#7c3aed",
  "#be185d",
  "#059669",
  "#b45309",
  "#4f46e5",
  "#0891b2",
  "#65a30d",
];
const colorForSubject = (subjectId: number) => SUBJECT_PALETTE[Math.abs(subjectId) % SUBJECT_PALETTE.length];

/** Mixes a #rrggbb colour with white; amount 0 = the colour, 1 = white. */
const tint = (hex: string, amount: number) => {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
};

const pad2 = (n: number) => String(n).padStart(2, "0");
const hhmm = (minutes: number) => `${pad2(Math.floor(minutes / 60))}:${pad2(minutes % 60)}`;

const styles = StyleSheet.create({
  page: {
    padding: MARGIN,
    fontFamily: "NotoSans",
    color: INK,
    backgroundColor: "#ffffff",
  },
  header: {
    height: HEADER_H,
    position: "relative",
  },
  headerContent: {
    position: "absolute",
    top: 0,
    left: 0,
    width: CONTENT_W,
    height: HEADER_H,
    paddingLeft: 16,
    paddingRight: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logoWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  logo: { width: 38, height: 38 },
  brandBlock: { flexDirection: "row", alignItems: "center" },
  schoolName: { fontSize: 10, fontWeight: 700, color: "#dbeafe", letterSpacing: 0.6 },
  docTitle: { fontSize: 19, fontWeight: 700, color: "#ffffff", marginTop: 1 },
  whoBlock: { alignItems: "flex-end", maxWidth: 380 },
  whoKind: { fontSize: 8, fontWeight: 700, color: "#bfdbfe", letterSpacing: 1, textTransform: "uppercase" },
  whoName: { fontSize: 17, fontWeight: 700, color: "#ffffff", marginTop: 1, textAlign: "right" },
  whoNote: { fontSize: 9, color: "#e0f2fe", marginTop: 2 },
  statsRow: {
    height: STATS_H,
    marginTop: GAP,
    flexDirection: "row",
  },
  statCard: {
    flex: 1,
    marginRight: 8,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
    paddingVertical: 4,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  statValue: { fontSize: 15, fontWeight: 700, color: BLUE, marginRight: 8 },
  statLabel: { fontSize: 8, color: MUTED, textTransform: "uppercase", letterSpacing: 0.4, flex: 1 },
  gridWrap: { marginTop: GAP },
  dayHeadRow: { flexDirection: "row", height: DAY_HEAD_H, paddingLeft: GUTTER_W },
  dayHead: {
    flex: 1,
    marginHorizontal: 1.5,
    borderRadius: 6,
    backgroundColor: BLUE,
    alignItems: "center",
    justifyContent: "center",
  },
  dayHeadText: { fontSize: 9.5, fontWeight: 700, color: "#ffffff", letterSpacing: 0.3 },
  footer: {
    height: FOOTER_H,
    marginTop: GAP,
    borderTopWidth: 1,
    borderTopColor: LINE,
    paddingTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  legend: { flexDirection: "row", flexWrap: "wrap", flex: 1, marginRight: 16 },
  legendItem: { flexDirection: "row", alignItems: "center", marginRight: 10, marginBottom: 2 },
  legendDot: { width: 7, height: 7, borderRadius: 3.5, marginRight: 4 },
  legendText: { fontSize: 7.5, color: "#475569" },
  footNote: { fontSize: 7.5, color: MUTED, textAlign: "right", maxWidth: 260 },
});

// ---------------------------------------------------------------------------
// Layout helpers
// ---------------------------------------------------------------------------

type Placed = SchedulePdfLesson & { lane: number; lanes: number };

/**
 * Lessons of one day that overlap in time are drawn side by side (a teacher who
 * is double-booked, or parallel groups in one class) instead of on top of each
 * other. Each overlapping cluster is split into equal lanes.
 */
const layoutDay = (lessons: SchedulePdfLesson[]): Placed[] => {
  const sorted = [...lessons].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  const result: Placed[] = [];
  let cluster: Placed[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -1;

  const flush = () => {
    const lanes = Math.max(1, laneEnds.length);
    cluster.forEach((c) => (c.lanes = lanes));
    result.push(...cluster);
    cluster = [];
    laneEnds = [];
    clusterEnd = -1;
  };

  for (const lesson of sorted) {
    if (cluster.length > 0 && lesson.startMin >= clusterEnd) flush();
    let lane = laneEnds.findIndex((end) => end <= lesson.startMin);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(lesson.endMin);
    } else {
      laneEnds[lane] = lesson.endMin;
    }
    cluster.push({ ...lesson, lane, lanes: 1 });
    clusterEnd = Math.max(clusterEnd, lesson.endMin);
  }
  if (cluster.length > 0) flush();
  return result;
};

const formatHours = (minutes: number) => {
  const hours = Math.round((minutes / 60) * 10) / 10;
  return String(hours);
};

// ---------------------------------------------------------------------------
// The document
// ---------------------------------------------------------------------------

export const SchedulePdfDocument = ({ data }: { data: SchedulePdfData }) => {
  const { labels, lessons, kind } = data;

  // Time range shown by the grid: whole half hours around the lessons.
  let startMin = 8 * 60;
  let endMin = 16 * 60;
  if (lessons.length > 0) {
    startMin = Math.floor(Math.min(...lessons.map((l) => l.startMin)) / 30) * 30;
    endMin = Math.ceil(Math.max(...lessons.map((l) => l.endMin)) / 30) * 30;
    if (endMin - startMin < MIN_RANGE_MIN) endMin = startMin + MIN_RANGE_MIN;
  }
  const range = endMin - startMin;
  const scale = Math.min(BODY_H / range, MAX_SCALE);
  const bodyH = range * scale;
  const colW = (CONTENT_W - GUTTER_W) / SCHEDULE_DAYS.length;

  const byDay = new Map<ScheduleDay, Placed[]>();
  for (const day of SCHEDULE_DAYS) {
    byDay.set(day, layoutDay(lessons.filter((l) => l.day === day)));
  }

  // Header numbers.
  const totalMinutes = lessons.reduce((sum, l) => sum + (l.endMin - l.startMin), 0);
  const people = new Set(lessons.map((l) => (kind === "teacher" ? l.className : l.teacherName)));
  let busiest: ScheduleDay | null = null;
  let busiestCount = 0;
  for (const day of SCHEDULE_DAYS) {
    const count = (byDay.get(day) ?? []).length;
    if (count > busiestCount) {
      busiest = day;
      busiestCount = count;
    }
  }

  const stats: { value: string; label: string }[] = [
    { value: String(lessons.length), label: labels.statLessons },
    { value: formatHours(totalMinutes), label: labels.statHours },
    { value: String(people.size), label: labels.statPeople },
    { value: busiest ? labels.days[busiest] : "–", label: labels.statBusiest },
  ];

  // Legend: each subject once, in the order it first appears (capped so the
  // footer always stays on the page).
  const legend: { id: number; name: string }[] = [];
  for (const l of lessons) {
    if (legend.length < MAX_LEGEND && !legend.some((s) => s.id === l.subjectId)) {
      legend.push({ id: l.subjectId, name: l.subject });
    }
  }

  // Hour lines inside the range.
  const hourMarks: number[] = [];
  for (let m = Math.ceil(startMin / 60) * 60; m < endMin; m += 60) hourMarks.push(m);

  return (
    <Document title={`${labels.title} - ${data.name}`} author={labels.schoolName} subject={labels.title}>
      <Page size="A4" orientation="landscape" style={styles.page} wrap={false}>
        {/* HEADER */}
        <View style={styles.header}>
          <Svg width={CONTENT_W} height={HEADER_H} style={{ position: "absolute", top: 0, left: 0 }}>
            <Defs>
              <LinearGradient id="hg" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0%" stopColor="#1e3a8a" />
                <Stop offset="55%" stopColor="#1d4ed8" />
                <Stop offset="100%" stopColor="#38bdf8" />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width={CONTENT_W} height={HEADER_H} rx={12} ry={12} fill="url(#hg)" />
            <Circle cx={CONTENT_W - 40} cy={-6} r={62} fill="#ffffff" fillOpacity={0.09} />
            <Circle cx={CONTENT_W - 150} cy={HEADER_H + 22} r={48} fill="#ffffff" fillOpacity={0.07} />
            <Rect x={16} y={HEADER_H - 4} width={70} height={4} rx={2} ry={2} fill="#facc15" />
          </Svg>
          <View style={styles.headerContent}>
            <View style={styles.brandBlock}>
              <View style={styles.logoWrap}>
                {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop */}
                <Image src={SCHOOL_LOGO_DATA_URI} style={styles.logo} />
              </View>
              <View>
                <Text style={styles.schoolName}>{labels.schoolName.toUpperCase()}</Text>
                <Text style={styles.docTitle}>{labels.title}</Text>
              </View>
            </View>
            <View style={styles.whoBlock}>
              <Text style={styles.whoKind}>
                {labels.kind} · {labels.schoolYear}
              </Text>
              <Text style={styles.whoName}>{data.name}</Text>
              {data.scopeNote ? <Text style={styles.whoNote}>{data.scopeNote}</Text> : null}
            </View>
          </View>
        </View>

        {/* STATS */}
        <View style={styles.statsRow}>
          {stats.map((s, i) => (
            <View key={s.label} style={[styles.statCard, i === stats.length - 1 ? { marginRight: 0 } : {}]}>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* WEEK GRID */}
        <View style={styles.gridWrap}>
          <View style={styles.dayHeadRow}>
            {SCHEDULE_DAYS.map((day) => (
              <View key={day} style={styles.dayHead}>
                <Text style={styles.dayHeadText}>{labels.days[day]}</Text>
              </View>
            ))}
          </View>

          <View style={{ height: bodyH, marginTop: 4, position: "relative" }}>
            {/* Alternating column tint */}
            {SCHEDULE_DAYS.map((day, i) => (
              <View
                key={`bg-${day}`}
                style={{
                  position: "absolute",
                  top: 0,
                  left: GUTTER_W + i * colW + 1.5,
                  width: colW - 3,
                  height: bodyH,
                  borderRadius: 6,
                  backgroundColor: i % 2 === 0 ? "#f8fafc" : "#ffffff",
                  borderWidth: 0.5,
                  borderColor: LINE,
                }}
              />
            ))}

            {/* Hour lines and labels */}
            {hourMarks.map((m) => {
              const y = (m - startMin) * scale;
              return (
                <View key={`h-${m}`} style={{ position: "absolute", top: y, left: 0, width: CONTENT_W }}>
                  <Text
                    style={{
                      position: "absolute",
                      top: -4.5,
                      left: 0,
                      width: GUTTER_W - 6,
                      textAlign: "right",
                      fontSize: 7.5,
                      color: MUTED,
                    }}
                  >
                    {hhmm(m)}
                  </Text>
                  <View
                    style={{
                      position: "absolute",
                      top: 0,
                      left: GUTTER_W,
                      width: CONTENT_W - GUTTER_W,
                      height: 0.5,
                      backgroundColor: LINE,
                    }}
                  />
                </View>
              );
            })}

            {/* Lessons */}
            {SCHEDULE_DAYS.map((day, dayIndex) =>
              (byDay.get(day) ?? []).map((l, idx) => {
                const laneW = (colW - 7) / l.lanes;
                const left = GUTTER_W + dayIndex * colW + 3.5 + l.lane * laneW;
                const top = (l.startMin - startMin) * scale + 0.75;
                const height = (l.endMin - l.startMin) * scale - 1.5;
                const color = colorForSubject(l.subjectId);
                const roomy = height >= 33;
                const twoLines = height >= 21;
                const fs = height >= 28 ? 8.5 : 7.5;
                const secondary = kind === "teacher" ? l.className : l.teacherName;
                const timeText = `${hhmm(l.startMin)}–${hhmm(l.endMin)}`;
                return (
                  <View
                    key={`${day}-${idx}-${l.startMin}`}
                    style={{
                      position: "absolute",
                      left,
                      top,
                      width: laneW - 1.5,
                      height,
                      borderRadius: 5,
                      backgroundColor: tint(color, 0.86),
                      borderLeftWidth: 3,
                      borderLeftColor: color,
                      paddingHorizontal: 4,
                      paddingVertical: 2,
                      overflow: "hidden",
                    }}
                  >
                    <Text style={{ fontSize: fs, fontWeight: 700, color, maxLines: 1, textOverflow: "ellipsis" }}>
                      {l.subject}
                    </Text>
                    {twoLines ? (
                      <Text style={{ fontSize: fs - 1.5, color: "#334155", maxLines: 1, textOverflow: "ellipsis" }}>
                        {secondary}
                        {roomy ? "" : `  ${timeText}`}
                      </Text>
                    ) : null}
                    {roomy ? (
                      <Text style={{ fontSize: fs - 1.5, color: MUTED, maxLines: 1, textOverflow: "ellipsis" }}>
                        {timeText}
                        {l.room ? `  ·  ${labels.roomLabel(l.room)}` : ""}
                      </Text>
                    ) : null}
                  </View>
                );
              })
            )}

            {lessons.length === 0 ? (
              <View style={{ position: "absolute", top: bodyH / 2 - 10, left: GUTTER_W, width: CONTENT_W - GUTTER_W }}>
                <Text style={{ textAlign: "center", fontSize: 11, color: MUTED }}>{labels.empty}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* FOOTER */}
        <View style={styles.footer}>
          <View style={styles.legend}>
            {legend.map((s) => (
              <View key={s.id} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colorForSubject(s.id) }]} />
                <Text style={styles.legendText}>{s.name}</Text>
              </View>
            ))}
          </View>
          <View>
            <Text style={styles.footNote}>{labels.generated}</Text>
            <Text style={styles.footNote}>{labels.timesNote}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
};
