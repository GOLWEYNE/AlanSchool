import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { requireApiRole } from "@/lib/auth";
import {
  formatSchoolDate,
  formatSchoolTime,
  loadPassHistoryForExport,
  parseHistoryFilters,
} from "@/lib/hallPass";

export const dynamic = "force-dynamic";

const esc = (v: string) => '"' + v.replace(/"/g, '""') + '"';
// A leading = + - @ makes Excel treat a cell as a formula; neutralise it.
const safe = (v: string) => (/^[=+\-@\t\r]/.test(v) ? "'" + v : v);

// CSV export of the hall pass history (opens directly in Excel). Same filters and
// same scoping as the history page: admins see everything, teachers their own classes.
export async function GET(req: Request) {
  const access = await requireApiRole(["admin", "teacher"]);
  if (access instanceof NextResponse) return access;

  const t = await getTranslations("HallPass");
  const params = Object.fromEntries(new URL(req.url).searchParams.entries());
  const rows = await loadPassHistoryForExport(
    { role: access.role as "admin" | "teacher", userId: access.userId },
    parseHistoryFilters(params)
  );

  const header = [
    t("history.cols.student"),
    t("history.cols.studentId"),
    t("history.cols.grade"),
    t("history.cols.class"),
    t("history.cols.destination"),
    t("history.cols.date"),
    t("history.cols.out"),
    t("history.cols.back"),
    t("history.cols.minutes"),
    t("history.cols.status"),
  ];
  const lines = rows.map((r) => {
    const minutes = r.returnedAt
      ? Math.max(0, Math.round((new Date(r.returnedAt).getTime() - new Date(r.issuedAt).getTime()) / 60000))
      : "";
    return [
      safe(r.studentName),
      safe(r.username),
      String(r.gradeLevel),
      safe(r.className),
      safe(r.destination),
      formatSchoolDate(r.issuedAt),
      formatSchoolTime(r.issuedAt),
      r.returnedAt ? formatSchoolTime(r.returnedAt) : "",
      String(minutes),
      t("status." + r.status),
    ]
      .map(esc)
      .join(",");
  });

  // BOM so Excel reads Cyrillic / Kazakh names as UTF-8.
  const csv = "﻿" + [header.map(esc).join(","), ...lines].join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="hall-pass-${formatSchoolDate(new Date())}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
