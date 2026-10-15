import fs from "fs";
import path from "path";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  Svg,
  Polyline,
  Polygon,
  Line,
  Circle,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import type { ReportCardPdfData } from "@/lib/reportCardData";
import { SCHOOL_MARK_DATA_URI } from "@/lib/reportCardAssets";

// Report card, "Classic Transcript" design: white page, school-yellow double frame, the school mark
// with a faint photo behind the content, summary strip, results tables, weekly record, IELTS/SAT mock
// trends, club attendance, behavior log and signature block. Two A4 pages.

// The built-in PDF fonts (Helvetica) only cover Western Latin, so Cyrillic and Kazakh names rendered
// as garbage. Noto Sans covers Latin, Cyrillic and Kazakh letters. The files live in src/assets/fonts
// and are traced into the serverless bundle via outputFileTracingIncludes in next.config.mjs.
const FONT_DIR = path.join(process.cwd(), "src", "assets", "fonts");

Font.register({
  family: "NotoSans",
  fonts: [
    { src: path.join(FONT_DIR, "NotoSans-400Regular.ttf"), fontWeight: 400 },
    { src: path.join(FONT_DIR, "NotoSans-700Bold.ttf"), fontWeight: 700 },
  ],
});

// Never break names or words with hyphens; keep them whole.
Font.registerHyphenationCallback((word) => [word]);

// Human-readable labels for the Term enum used throughout the schema.
export const TERM_LABELS: Record<string, string> = {
  TERM_1: "Term 1",
  TERM_2: "Term 2",
  TERM_3: "Term 3",
};

export type { ReportCardPdfData } from "@/lib/reportCardData";

const YELLOW = "#F6B52A";
const GOLD = "#C98A00";
const CREAM = "#FFF6DA";
const PALE = "#FFFBEE";
const LINE = "#F3DFA0";
const INK = "#1F2937";
const MUTED = "#6B7280";
const TEAL = "#17607F";

// Optional faint school photo behind the page. Drop a photo at src/assets/school-photo.(jpg|jpeg|png).
function readSchoolPhoto(): { data: Buffer; format: "jpg" | "png" } | null {
  const dir = path.join(process.cwd(), "src", "assets");
  for (const [file, format] of [
    ["school-photo.jpg", "jpg"],
    ["school-photo.jpeg", "jpg"],
    ["school-photo.png", "png"],
  ] as const) {
    try {
      return { data: fs.readFileSync(path.join(dir, file)), format };
    } catch {
      // try the next candidate
    }
  }
  return null;
}

const styles = StyleSheet.create({
  page: { paddingTop: 44, paddingHorizontal: 50, paddingBottom: 60, fontSize: 9, fontFamily: "NotoSans", color: INK },
  frameOuter: { position: "absolute", top: 22, left: 22, right: 22, bottom: 22, border: `1.5 solid ${YELLOW}` },
  frameInner: { position: "absolute", top: 26, left: 26, right: 26, bottom: 26, border: `0.5 solid ${GOLD}` },
  head: { alignItems: "center" },
  schoolName: { fontSize: 17, fontWeight: 700, letterSpacing: 1.4, textTransform: "uppercase", marginTop: 6, color: "#2B1D00" },
  docTitle: { fontSize: 7.5, letterSpacing: 3, textTransform: "uppercase", color: GOLD, fontWeight: 700, marginTop: 3 },
  rule: { height: 1.5, backgroundColor: YELLOW, marginVertical: 8 },
  infoRow: { flexDirection: "row", border: `1 solid ${YELLOW}` },
  infoCell: { flex: 1, paddingVertical: 5, paddingHorizontal: 8, borderRight: `1 solid ${LINE}` },
  infoLabel: { fontSize: 6, letterSpacing: 1, textTransform: "uppercase", color: GOLD, fontWeight: 700 },
  infoValue: { fontSize: 9.5, fontWeight: 700, marginTop: 1 },
  sumRow: { flexDirection: "row", backgroundColor: CREAM, border: `1 solid ${YELLOW}`, marginTop: 7 },
  sumCell: { flex: 1, alignItems: "center", paddingVertical: 7, borderRight: `1 solid ${LINE}` },
  sumValue: { fontSize: 16, fontWeight: 700, color: "#2B1D00" },
  sumLabel: { fontSize: 5.8, letterSpacing: 1, textTransform: "uppercase", color: GOLD, fontWeight: 700, marginTop: 1 },
  secRow: { flexDirection: "row", alignItems: "center", marginTop: 11, marginBottom: 4 },
  secTitle: { fontSize: 7.5, letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 700, color: "#2B1D00" },
  secLine: { flex: 1, height: 0.8, backgroundColor: YELLOW, marginLeft: 7 },
  tr: { flexDirection: "row" },
  th: { backgroundColor: YELLOW, color: "#2B1D00", fontSize: 6.3, letterSpacing: 0.7, textTransform: "uppercase", fontWeight: 700, paddingVertical: 4, paddingHorizontal: 5 },
  td: { fontSize: 8, paddingVertical: 3.6, paddingHorizontal: 5, borderBottom: `0.6 solid #F3E6BE` },
  empty: { fontSize: 8, color: MUTED, paddingVertical: 6, paddingHorizontal: 5, borderBottom: `0.6 solid #F3E6BE` },
  two: { flexDirection: "row" },
  note: { fontSize: 6.5, color: MUTED, marginTop: 3 },
  commentLine: { height: 14, borderBottom: `0.6 solid #9CA3AF` },
  sigRow: { flexDirection: "row", alignItems: "flex-end", marginTop: 20 },
  sig: { flex: 1, borderTop: `0.6 solid ${MUTED}`, paddingTop: 3, marginRight: 18 },
  sigText: { fontSize: 6.5, color: MUTED },
  seal: { width: 54, height: 54, borderRadius: 27, border: `1.6 solid ${GOLD}`, alignItems: "center", justifyContent: "center", transform: "rotate(-8deg)" },
  sealText: { fontSize: 5, letterSpacing: 0.8, textTransform: "uppercase", color: GOLD, fontWeight: 700, textAlign: "center", lineHeight: 1.4 },
  footer: { position: "absolute", bottom: 34, left: 0, right: 0, textAlign: "center", fontSize: 6.3, color: MUTED },
});

const fmt = (v: number | null | undefined, suffix = "") =>
  v === null || v === undefined || Number.isNaN(v) ? "–" : `${Math.round(v * 100) / 100}${suffix}`;

const fmtDate = (d: Date) => {
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${d.getUTCFullYear()}`;
};

const BEHAVIOR_LABEL = { POSITIVE: "Positive", CONCERN: "Concern", INCIDENT: "Incident" } as const;

const Section = ({ title }: { title: string }) => (
  <View style={styles.secRow}>
    <Text style={styles.secTitle}>{title}</Text>
    <View style={styles.secLine} />
  </View>
);

type Col = { w: number; align?: "left" | "center" };

// A simple table with a yellow header and zebra rows. `widths` are flex weights.
const Table = ({ cols, head, rows, emptyText }: { cols: Col[]; head: string[]; rows: (string | number)[][]; emptyText?: string }) => (
  <View>
    <View style={styles.tr}>
      {head.map((h, i) => (
        <Text key={i} style={[styles.th, { flex: cols[i].w, textAlign: cols[i].align ?? "left" }]}>
          {h}
        </Text>
      ))}
    </View>
    {rows.length === 0 && emptyText ? <Text style={styles.empty}>{emptyText}</Text> : null}
    {rows.map((row, r) => (
      <View key={r} style={[styles.tr, { backgroundColor: r % 2 ? PALE : "#FFFFFF" }]} wrap={false}>
        {row.map((cell, i) => (
          <Text
            key={i}
            style={[styles.td, { flex: cols[i].w, textAlign: cols[i].align ?? "left", fontWeight: i === 0 ? 700 : 400 }]}
          >
            {cell}
          </Text>
        ))}
      </View>
    ))}
  </View>
);

// ---------------------------------------------------------------------------
// Charts (plain SVG shapes; value labels are drawn as a text row under the chart)
// ---------------------------------------------------------------------------
const CHART_W = 230;
const CHART_H = 78;

const TrendChart = ({
  values,
  labels,
  lo,
  hi,
  color,
  target,
  valueLabel,
}: {
  values: (number | null)[];
  labels: string[];
  lo: number;
  hi: number;
  color: string;
  target?: number;
  valueLabel: (v: number) => string;
}) => {
  const padY = 8;
  const n = values.length;
  // Points sit in the middle of equal-width columns so they line up with the label rows below.
  const padX = CHART_W / (2 * n);
  const x = (i: number) => padX + (i * (CHART_W - 2 * padX)) / (n - 1);
  const y = (v: number) => CHART_H - padY - ((v - lo) / (hi - lo)) * (CHART_H - 2 * padY);
  const pts = values.map((v, i) => (v === null ? null : { x: x(i), y: y(v) }));
  const present = pts.filter((p): p is { x: number; y: number } => p !== null);
  const poly = present.map((p) => `${p.x},${p.y}`).join(" ");
  const hasData = present.length > 0;

  return (
    <View>
      <Svg width={CHART_W} height={CHART_H} viewBox={`0 0 ${CHART_W} ${CHART_H}`}>
        {[0.25, 0.5, 0.75].map((f) => (
          <Line key={f} x1={4} x2={CHART_W - 4} y1={padY + f * (CHART_H - 2 * padY)} y2={padY + f * (CHART_H - 2 * padY)} stroke="#E5E7EB" strokeWidth={0.5} strokeDasharray="2 2" />
        ))}
        {target !== undefined && target >= lo && target <= hi ? (
          <Line x1={4} x2={CHART_W - 4} y1={y(target)} y2={y(target)} stroke={TEAL} strokeWidth={0.8} strokeDasharray="3 2" />
        ) : null}
        {present.length > 1 ? (
          <Polygon points={`${present[0].x},${CHART_H - padY} ${poly} ${present[present.length - 1].x},${CHART_H - padY}`} fill={color} fillOpacity={0.14} />
        ) : null}
        {present.length > 1 ? <Polyline points={poly} fill="none" stroke={color} strokeWidth={1.6} /> : null}
        {present.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={2.4} fill="#FFFFFF" stroke={color} strokeWidth={1.3} />
        ))}
      </Svg>
      <View style={{ flexDirection: "row", width: CHART_W, marginTop: 1 }}>
        {values.map((v, i) => (
          <Text key={i} style={{ flex: 1, textAlign: "center", fontSize: 5.8, fontWeight: 700, color: INK }}>
            {v === null ? "" : valueLabel(v)}
          </Text>
        ))}
      </View>
      <View style={{ flexDirection: "row", width: CHART_W }}>
        {labels.map((l, i) => (
          <Text key={i} style={{ flex: 1, textAlign: "center", fontSize: 5.2, color: MUTED }}>
            {l}
          </Text>
        ))}
      </View>
      {!hasData ? <Text style={styles.note}>No mock test scores recorded in these weeks.</Text> : null}
    </View>
  );
};

const niceRange = (vals: (number | null)[], pad: number, step: number, min: number, max: number) => {
  const nums = vals.filter((v): v is number => v !== null);
  if (!nums.length) return { lo: min, hi: max };
  let lo = Math.max(min, Math.floor((Math.min(...nums) - pad) / step) * step);
  let hi = Math.min(max, Math.ceil((Math.max(...nums) + pad) / step) * step);
  if (hi - lo < step * 2) hi = Math.min(max, lo + step * 2);
  if (hi - lo < step * 2) lo = Math.max(min, hi - step * 2);
  return { lo, hi };
};

// ---------------------------------------------------------------------------
// Page chrome: double frame, logo + photo watermarks (behind everything), footer
// ---------------------------------------------------------------------------
const Chrome = ({ photo, pageLabel }: { photo: ReturnType<typeof readSchoolPhoto>; pageLabel: string }) => (
  <>
    {photo ? (
      // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop
      <Image src={photo} style={{ position: "absolute", left: 0, bottom: 0, width: 595, height: 330, objectFit: "cover", opacity: 0.13 }} fixed />
    ) : null}
    {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop */}
    <Image src={SCHOOL_MARK_DATA_URI} style={{ position: "absolute", left: 147, top: 249, width: 300, height: 246, opacity: 0.07 }} fixed />
    <View style={styles.frameOuter} fixed />
    <View style={styles.frameInner} fixed />
    <Text style={styles.footer} fixed>
      This report card was generated electronically and is valid without a signature · Alan International School · {pageLabel}
    </Text>
  </>
);

const Header = () => (
  <View style={styles.head}>
    {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop */}
    <Image src={SCHOOL_MARK_DATA_URI} style={{ width: 62, height: 51 }} />
    <Text style={styles.schoolName}>Alan International School</Text>
    <Text style={styles.docTitle}>Official Student Report Card</Text>
    <View style={[styles.rule, { alignSelf: "stretch" }]} />
  </View>
);

export const ReportCardDocument = ({ data }: { data: ReportCardPdfData }) => {
  const termLabel = TERM_LABELS[data.term] ?? data.term;
  const photo = readSchoolPhoto();
  const w = data.weekly;
  const att = data.attendance;

  const ieltsRange = niceRange(w.ielts, 0.5, 0.5, 0, 9);
  const satRange = niceRange(w.sat, 50, 100, 400, 1600);
  const ieltsSections = data.ielts.sections ?? {};
  const satSections = data.sat.sections ?? {};

  const weekCells = (vals: (number | null)[]) => vals.map((v) => fmt(v));
  const bandCells = (vals: (number | null)[]) => vals.map((v) => (v === null ? "–" : v.toFixed(1)));
  const band = (v: number | null | undefined) => (v === null || v === undefined ? "–" : v.toFixed(1));
  const behaviorCells = w.positive.map((p, i) => {
    const c = w.concerns[i];
    if (!p && !c) return "–";
    return [p ? `+${p}` : "", c ? `−${c}` : ""].filter(Boolean).join(" ");
  });
  const weeklyRows: (string | number)[][] = [
    ["Assignments", ...weekCells(w.assignments)],
    ["Quizzes", ...weekCells(w.quizzes)],
    ["Exams", ...weekCells(w.exams)],
    ["Behavior", ...behaviorCells],
    ["IELTS mock", ...bandCells(w.ielts)],
    ["SAT mock", ...weekCells(w.sat)],
  ];
  const weekCols: Col[] = [{ w: 1.7 }, ...data.weekLabels.map(() => ({ w: 1, align: "center" as const }))];

  const termTitle = `${termLabel} · ${data.schoolYear}`;

  return (
    <Document title={`${data.studentName} - ${termLabel} ${data.schoolYear} Report Card`} author="Alan International School">
      {/* ------------------------------ Page 1 ------------------------------ */}
      <Page size="A4" style={styles.page}>
        <Chrome photo={photo} pageLabel="Page 1 of 2" />
        <Header />

        <View style={styles.infoRow}>
          <View style={[styles.infoCell, { flex: 1.6 }]}>
            <Text style={styles.infoLabel}>Student</Text>
            <Text style={styles.infoValue}>{data.studentName}</Text>
          </View>
          <View style={[styles.infoCell, { flex: 1.2 }]}>
            <Text style={styles.infoLabel}>Student ID</Text>
            <Text style={styles.infoValue}>{data.studentUsername}</Text>
          </View>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>Class</Text>
            <Text style={styles.infoValue}>{data.gradeLevel ? `${data.className} · Grade ${data.gradeLevel}` : data.className}</Text>
          </View>
          <View style={[styles.infoCell, { borderRight: 0 }]}>
            <Text style={styles.infoLabel}>{termLabel}</Text>
            <Text style={styles.infoValue}>{data.schoolYear}</Text>
          </View>
        </View>

        <View style={styles.sumRow}>
          <View style={styles.sumCell}>
            <Text style={styles.sumValue}>{fmt(data.gpa)}</Text>
            <Text style={styles.sumLabel}>GPA (avg. score)</Text>
          </View>
          <View style={styles.sumCell}>
            <Text style={styles.sumValue}>{fmt(data.attendanceRate, "%")}</Text>
            <Text style={styles.sumLabel}>Attendance</Text>
          </View>
          <View style={styles.sumCell}>
            <Text style={styles.sumValue}>{`+${w.positive.reduce((a, b) => a + b, 0)} / −${w.concerns.reduce((a, b) => a + b, 0)}`}</Text>
            <Text style={styles.sumLabel}>Behavior · 8 weeks</Text>
          </View>
          <View style={styles.sumCell}>
            <Text style={styles.sumValue}>{band(data.ielts.latest)}</Text>
            <Text style={styles.sumLabel}>IELTS mock</Text>
          </View>
          <View style={[styles.sumCell, { borderRight: 0 }]}>
            <Text style={styles.sumValue}>{fmt(data.sat.latest)}</Text>
            <Text style={styles.sumLabel}>SAT mock</Text>
          </View>
        </View>

        <Section title="Academic results" />
        <Table
          cols={[{ w: 2.4 }, { w: 1, align: "center" }, { w: 1, align: "center" }, { w: 1, align: "center" }, { w: 1, align: "center" }]}
          head={["Subject", "Assignments", "Quizzes", "Exams", "Average"]}
          rows={data.subjects.map((s) => [s.subject, fmt(s.assignments), fmt(s.quizzes), fmt(s.exams), fmt(s.average)])}
          emptyText="No recorded exam, quiz or assignment results yet."
        />

        <Section title="Attendance &amp; clubs" />
        <Table
          cols={[{ w: 2.4 }, { w: 1, align: "center" }, { w: 1, align: "center" }, { w: 1, align: "center" }, { w: 1, align: "center" }, { w: 1, align: "center" }]}
          head={["Record", "Present", "Late", "Absent", "Excused", "Rate"]}
          rows={[["School attendance", att.present, att.late, att.absent, att.excused, fmt(data.attendanceRate, "%")]]}
        />
        <View style={{ height: 6 }} />
        <Table
          cols={[{ w: 2.4 }, { w: 2, align: "center" }, { w: 2, align: "center" }, { w: 1, align: "center" }]}
          head={["Club", "Sessions attended", "Sessions held", "Rate"]}
          rows={data.clubs.map((c) => [c.name, c.attended, c.held, c.held ? `${Math.round((100 * c.attended) / c.held)}%` : "–"])}
          emptyText="Not registered in any club."
        />

        <Section title="Weekly record" />
        <Table cols={weekCols} head={["Week of", ...data.weekLabels]} rows={weeklyRows} />
        <Text style={styles.note}>
          Scores are weekly averages. Quizzes are auto-graded assignments. Behavior shows positive (+) and concern (−) entries.
        </Text>
      </Page>

      {/* ------------------------------ Page 2 ------------------------------ */}
      <Page size="A4" style={styles.page}>
        <Chrome photo={photo} pageLabel="Page 2 of 2" />
        <Header />
        <Text style={[styles.note, { textAlign: "center", marginTop: -2, marginBottom: 2 }]}>
          {data.studentName} · {data.className} · {termTitle}
        </Text>

        <View style={styles.two}>
          <View style={{ flex: 1, marginRight: 14 }}>
            <Section title="IELTS mock trend" />
            <TrendChart values={w.ielts} labels={data.weekLabels} lo={ieltsRange.lo} hi={ieltsRange.hi} color={TEAL} target={7} valueLabel={(v) => v.toFixed(1)} />
            <Text style={styles.note}>Overall band · dashed line = target 7.0</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Section title="SAT mock trend" />
            <TrendChart values={w.sat} labels={data.weekLabels} lo={satRange.lo} hi={satRange.hi} color={GOLD} valueLabel={(v) => String(Math.round(v))} />
            <Text style={styles.note}>Total score out of 1600</Text>
          </View>
        </View>

        <Section title="Mock test breakdown · latest" />
        <View style={styles.two}>
          <View style={{ flex: 1, marginRight: 14 }}>
            <Table
              cols={[{ w: 2 }, { w: 1, align: "center" }]}
              head={["IELTS section", "Band"]}
              rows={[
                ["Listening", band(ieltsSections.listening)],
                ["Reading", band(ieltsSections.reading)],
                ["Writing", band(ieltsSections.writing)],
                ["Speaking", band(ieltsSections.speaking)],
                ["Overall", band(data.ielts.latest)],
              ]}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Table
              cols={[{ w: 2 }, { w: 1.3, align: "center" }]}
              head={["SAT section", "Score"]}
              rows={[
                ["Reading & Writing", satSections.readingWriting !== undefined ? `${fmt(satSections.readingWriting)} / 800` : "–"],
                ["Math", satSections.math !== undefined ? `${fmt(satSections.math)} / 800` : "–"],
                ["Total", data.sat.latest !== null ? `${fmt(data.sat.latest)} / 1600` : "–"],
              ]}
            />
          </View>
        </View>

        <Section title="Behavior log" />
        <Table
          cols={[{ w: 1.2 }, { w: 5 }, { w: 1.4, align: "center" }]}
          head={["Date", "Note", "Type"]}
          rows={data.behaviorLog.map((b) => [fmtDate(b.date), b.title, BEHAVIOR_LABEL[b.type]])}
          emptyText="No behavior entries in the last 8 weeks."
        />

        <Section title="Teacher's comment" />
        <View>
          <View style={styles.commentLine} />
          <View style={styles.commentLine} />
          <View style={styles.commentLine} />
        </View>

        <View style={styles.sigRow} wrap={false}>
          <View style={styles.sig}>
            <Text style={styles.sigText}>Homeroom teacher</Text>
          </View>
          <View style={styles.sig}>
            <Text style={styles.sigText}>Director</Text>
          </View>
          <View style={styles.sig}>
            <Text style={styles.sigText}>Parent / guardian</Text>
          </View>
          <View style={styles.seal}>
            <Text style={styles.sealText}>Alan{"\n"}International{"\n"}School{"\n"}Official</Text>
          </View>
        </View>
        <Text style={[styles.note, { marginTop: 8 }]}>
          Generated {data.generatedAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "Etc/GMT-5" })}
        </Text>
      </Page>
    </Document>
  );
};
