import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";

// Human-readable labels for the Term enum used throughout the schema.
export const TERM_LABELS: Record<string, string> = {
  TERM_1: "Term 1",
  TERM_2: "Term 2",
  TERM_3: "Term 3",
};

export type ReportCardResultRow = {
  subject: string;
  assessment: string;
  type: "Exam" | "Assignment";
  score: number;
};

export type ReportCardPdfData = {
  studentName: string;
  studentUsername: string;
  className: string;
  gradeLevel?: number;
  term: string;
  schoolYear: string;
  gpa: number | null;
  attendanceRate: number | null;
  behaviorSummary: string | null;
  results: ReportCardResultRow[];
  generatedAt: Date;
};

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#1e293b",
  },
  header: {
    borderBottom: "2 solid #1d4ed8",
    paddingBottom: 12,
    marginBottom: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  schoolName: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: "#1d4ed8",
  },
  docTitle: {
    fontSize: 11,
    color: "#475569",
    marginTop: 2,
  },
  metaBlock: {
    textAlign: "right",
  },
  metaLine: {
    fontSize: 9,
    color: "#475569",
  },
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  infoItem: {
    width: "50%",
    marginBottom: 6,
  },
  infoLabel: {
    fontSize: 8,
    color: "#64748b",
    textTransform: "uppercase",
  },
  infoValue: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
  },
  statsRow: {
    flexDirection: "row",
  },
  statCard: {
    flex: 1,
    backgroundColor: "#eff6ff",
    borderRadius: 4,
    padding: 10,
    marginRight: 10,
  },
  statLabel: {
    fontSize: 8,
    color: "#1d4ed8",
    textTransform: "uppercase",
  },
  statValue: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: "#1e3a8a",
    marginTop: 2,
  },
  table: {
    borderTop: "1 solid #cbd5e1",
    borderLeft: "1 solid #cbd5e1",
  },
  tableRow: {
    flexDirection: "row",
  },
  tableHeaderCell: {
    flex: 1,
    backgroundColor: "#1d4ed8",
    color: "#ffffff",
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    padding: 6,
    borderRight: "1 solid #cbd5e1",
    borderBottom: "1 solid #cbd5e1",
  },
  tableCell: {
    flex: 1,
    fontSize: 9,
    padding: 6,
    borderRight: "1 solid #cbd5e1",
    borderBottom: "1 solid #cbd5e1",
  },
  scoreCell: {
    flex: 0.5,
    fontSize: 9,
    padding: 6,
    borderRight: "1 solid #cbd5e1",
    borderBottom: "1 solid #cbd5e1",
    textAlign: "center",
  },
  scoreHeaderCell: {
    flex: 0.5,
    backgroundColor: "#1d4ed8",
    color: "#ffffff",
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    padding: 6,
    borderRight: "1 solid #cbd5e1",
    borderBottom: "1 solid #cbd5e1",
    textAlign: "center",
  },
  emptyState: {
    fontSize: 9,
    color: "#64748b",
    fontStyle: "italic",
    padding: 8,
  },
  behaviorBox: {
    backgroundColor: "#f8fafc",
    borderRadius: 4,
    padding: 10,
    fontSize: 9,
    lineHeight: 1.4,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    borderTop: "1 solid #e2e8f0",
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: {
    fontSize: 8,
    color: "#94a3b8",
  },
});

const formatNumber = (value: number | null, suffix = "") => {
  if (value === null || Number.isNaN(value)) return "—";
  return `${Math.round(value * 100) / 100}${suffix}`;
};

export const ReportCardDocument = ({ data }: { data: ReportCardPdfData }) => {
  const termLabel = TERM_LABELS[data.term] ?? data.term;

  return (
    <Document
      title={`${data.studentName} - ${termLabel} ${data.schoolYear} Report Card`}
    >
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.schoolName}>Alan International School</Text>
            <Text style={styles.docTitle}>Official Student Report Card</Text>
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLine}>{termLabel} · {data.schoolYear}</Text>
            <Text style={styles.metaLine}>
              Generated {data.generatedAt.toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </Text>
          </View>
        </View>

        {/* Student Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Student Information</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Full Name</Text>
              <Text style={styles.infoValue}>{data.studentName}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Student ID</Text>
              <Text style={styles.infoValue}>{data.studentUsername}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Class</Text>
              <Text style={styles.infoValue}>{data.className}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>School Year</Text>
              <Text style={styles.infoValue}>{data.schoolYear}</Text>
            </View>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Academic Summary</Text>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>GPA (avg. score)</Text>
              <Text style={styles.statValue}>{formatNumber(data.gpa)}</Text>
            </View>
            <View style={[styles.statCard, { marginRight: 0 }]}>
              <Text style={styles.statLabel}>Attendance Rate</Text>
              <Text style={styles.statValue}>
                {formatNumber(data.attendanceRate, "%")}
              </Text>
            </View>
          </View>
        </View>

        {/* Results Table */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Results Breakdown</Text>
          <View style={styles.table}>
            <View style={styles.tableRow}>
              <Text style={styles.tableHeaderCell}>Subject</Text>
              <Text style={styles.tableHeaderCell}>Assessment</Text>
              <Text style={styles.scoreHeaderCell}>Score</Text>
            </View>
            {data.results.length === 0 ? (
              <Text style={styles.emptyState}>
                No recorded exam or assignment results yet.
              </Text>
            ) : (
              data.results.map((row, idx) => (
                <View style={styles.tableRow} key={idx}>
                  <Text style={styles.tableCell}>{row.subject}</Text>
                  <Text style={styles.tableCell}>
                    {row.type}: {row.assessment}
                  </Text>
                  <Text style={styles.scoreCell}>{row.score}</Text>
                </View>
              ))
            )}
          </View>
        </View>

        {/* Behavior Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Behavior Summary</Text>
          <View style={styles.behaviorBox}>
            <Text>{data.behaviorSummary || "No behavior logs on file."}</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Alan International School · Official Document</Text>
          <Text style={styles.footerText}>
            This report card was generated electronically and is valid without a signature.
          </Text>
        </View>
      </Page>
    </Document>
  );
};
