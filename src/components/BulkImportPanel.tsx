"use client";

import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { useTranslations } from "next-intl";
import {
  BulkImportRole,
  RawImportRow,
  ROLE_FIELDS,
  RowResult,
  TEMPLATE_EXAMPLES,
  resolveHeaderKey,
} from "@/lib/bulkImportShared";
import type { CommitOutcome, CommitRow } from "@/lib/bulkImportServer";

const ROLES: BulkImportRole[] = ["student", "teacher", "parent"];
const COMMIT_BATCH_SIZE = 15;

const csvEscape = (value: string) =>
  /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

const downloadBlob = (content: string, filename: string, type: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

async function parseSpreadsheet(file: File): Promise<RawImportRow[]> {
  const isCsv = /\.csv$/i.test(file.name);
  const workbook = isCsv
    ? XLSX.read(await file.text(), { type: "string", cellDates: true })
    : XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: true });
  if (rows.length === 0) return [];

  const headerKeys = (rows[0] as unknown[]).map((h) => resolveHeaderKey(String(h ?? "")));
  return rows
    .slice(1)
    .filter((r) => r.some((cell) => String(cell ?? "").trim() !== ""))
    .map((r) => {
      const obj: RawImportRow = {};
      headerKeys.forEach((key, i) => {
        if (key) obj[key] = r[i];
      });
      return obj;
    });
}

const chunk = <T,>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

const EXTRA_FIELD_BY_ROLE: Record<BulkImportRole, { key: string; label: (t: ReturnType<typeof useTranslations>) => string }> = {
  student: { key: "class", label: (t) => t("colClass") },
  teacher: { key: "subjects", label: (t) => t("colSubjects") },
  parent: { key: "phone", label: (t) => t("colPhone") },
};

const BulkImportPanel = () => {
  const t = useTranslations("BulkImport");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [role, setRole] = useState<BulkImportRole>("student");
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<RowResult[] | null>(null);
  const [commits, setCommits] = useState<CommitRow[] | null>(null);
  const [committing, setCommitting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [outcomes, setOutcomes] = useState<CommitOutcome[] | null>(null);

  const resetForRole = (next: BulkImportRole) => {
    setRole(next);
    setFileName(null);
    setResults(null);
    setCommits(null);
    setOutcomes(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const summary = useMemo(() => {
    if (!results) return null;
    const ready = results.filter((r) => r.status === "ready").length;
    return { total: results.length, ready, errors: results.length - ready };
  }, [results]);

  const outcomeSummary = useMemo(() => {
    if (!outcomes) return null;
    const created = outcomes.filter((o) => o.status === "created").length;
    return { created, failed: outcomes.length - created };
  }, [outcomes]);

  const downloadTemplate = () => {
    const fields = ROLE_FIELDS[role];
    const lines = [fields.map((f) => f.header).join(",")];
    lines.push(TEMPLATE_EXAMPLES[role].map(csvEscape).join(","));
    downloadBlob(lines.join("\n") + "\n", `${role}-import-template.csv`, "text/csv;charset=utf-8;");
  };

  const onFileChosen = async (file: File) => {
    setFileName(file.name);
    setError(null);
    setResults(null);
    setCommits(null);
    setOutcomes(null);
    setLoading(true);
    try {
      const rows = await parseSpreadsheet(file);
      if (rows.length === 0) {
        setError(t("errors.empty"));
        return;
      }
      if (rows.length > 1000) {
        setError(t("errors.tooMany", { max: 1000 }));
        return;
      }
      const res = await fetch("/api/admin/bulk-import/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, rows }),
      });
      if (!res.ok) {
        setError(t("errors.validateFailed"));
        return;
      }
      const data = await res.json();
      setResults(data.results as RowResult[]);
      setCommits(data.commits as CommitRow[]);
    } catch (err) {
      console.log("bulk import parse/validate error", err);
      setError(t("errors.parseFailed"));
    } finally {
      setLoading(false);
    }
  };

  const runImport = async () => {
    if (!commits || commits.length === 0) return;
    if (!window.confirm(t("confirmImport", { count: commits.length }))) return;

    setCommitting(true);
    setOutcomes(null);
    setProgress({ done: 0, total: commits.length });

    const batches = chunk(commits, COMMIT_BATCH_SIZE);
    const collected: CommitOutcome[] = [];

    for (const batch of batches) {
      try {
        const res = await fetch("/api/admin/bulk-import/commit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role, rows: batch }),
        });
        if (res.ok) {
          const data = await res.json();
          collected.push(...(data.outcomes as CommitOutcome[]));
        } else {
          batch.forEach((b) => collected.push({ row: b.row, status: "failed", error: "requestFailed" }));
        }
      } catch (err) {
        console.log("bulk import commit batch error", err);
        batch.forEach((b) => collected.push({ row: b.row, status: "failed", error: "requestFailed" }));
      }
      setProgress({ done: collected.length, total: commits.length });
      setOutcomes([...collected]);
    }

    setCommitting(false);
  };

  const downloadCredentials = () => {
    if (!outcomes) return;
    const lines = ["username,password,status,error"];
    for (const o of outcomes) {
      lines.push(
        [o.username ?? "", o.password ?? "", o.status, o.error ?? ""].map(csvEscape).join(",")
      );
    }
    downloadBlob(lines.join("\n") + "\n", `${role}-import-credentials.csv`, "text/csv;charset=utf-8;");
  };

  const issueText = (issue: RowResult["issues"][number]) => {
    const field = issue.field ? t(`fields.${issue.field}`) : "";
    return t(`issues.${issue.code}`, { field, value: issue.value ?? "" });
  };

  const KNOWN_COMMIT_ERRORS = ["duplicateUsername", "duplicateEmail", "duplicatePhone", "requestFailed"];
  const commitErrorText = (o: CommitOutcome) => {
    if (o.error && KNOWN_COMMIT_ERRORS.includes(o.error)) return t(`commitErrors.${o.error}`);
    return o.error || t("commitErrors.unknown");
  };

  const extraField = EXTRA_FIELD_BY_ROLE[role];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-2">
        {ROLES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => resetForRole(r)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              role === r
                ? "bg-blue-600 text-white"
                : "bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-slate-800 dark:text-blue-200"
            }`}
          >
            {t(`roles.${r}`)}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-blue-100 dark:border-slate-800 bg-blue-50/40 dark:bg-slate-900/40 p-4 flex flex-col gap-3">
        <p className="text-sm text-gray-700 dark:text-slate-300">{t("intro", { role: t(`roles.${role}`) })}</p>
        <p className="text-xs text-gray-500 dark:text-slate-400">{t(`help.${role}`)}</p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={downloadTemplate}
            className="rounded-lg border border-blue-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-slate-800"
          >
            {t("downloadTemplate")}
          </button>
          <label className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 cursor-pointer">
            {t("chooseFile")}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onFileChosen(file);
              }}
            />
          </label>
          {fileName && <span className="text-sm text-gray-600 dark:text-slate-300">{fileName}</span>}
          {loading && <span className="text-sm text-gray-500 dark:text-slate-400">{t("validating")}</span>}
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>

      {results && summary && (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-gray-800 dark:text-blue-100">
            {t("summary", { ready: summary.ready, errors: summary.errors, total: summary.total })}
          </p>

          <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-slate-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-slate-400 bg-gray-50 dark:bg-slate-900/60">
                  <th className="py-2 px-3">#</th>
                  <th className="py-2 px-3">{t("colStatus")}</th>
                  <th className="py-2 px-3">{t("colUsername")}</th>
                  <th className="py-2 px-3">{t("colName")}</th>
                  <th className="py-2 px-3">{extraField.label(t)}</th>
                  <th className="py-2 px-3">{t("colNotes")}</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.row} className="border-t border-gray-100 dark:border-slate-800 align-top">
                    <td className="py-1.5 px-3 text-gray-500 dark:text-slate-400">{r.row}</td>
                    <td className="py-1.5 px-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                          r.status === "ready"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                            : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                        }`}
                      >
                        {r.status === "ready" ? t("statusReady") : t("statusError")}
                      </span>
                    </td>
                    <td className="py-1.5 px-3 text-gray-800 dark:text-slate-200">{r.preview.username}</td>
                    <td className="py-1.5 px-3 text-gray-800 dark:text-slate-200">
                      {r.preview.name} {r.preview.surname}
                    </td>
                    <td className="py-1.5 px-3 text-gray-800 dark:text-slate-200">{r.preview[extraField.key]}</td>
                    <td className="py-1.5 px-3">
                      {r.issues.length === 0 ? (
                        <span className="text-gray-400 dark:text-slate-500">—</span>
                      ) : (
                        <ul className="flex flex-col gap-0.5">
                          {r.issues.map((issue, i) => (
                            <li
                              key={i}
                              className={issue.blocking ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}
                            >
                              {issueText(issue)}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {commits && commits.length > 0 && (
            <div>
              <button
                type="button"
                onClick={runImport}
                disabled={committing}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {committing ? t("importing", progress) : t("importButton", { count: commits.length })}
              </button>
            </div>
          )}

          {committing && (
            <div className="h-2 w-full max-w-md rounded-full bg-gray-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
              />
            </div>
          )}
        </div>
      )}

      {outcomes && outcomeSummary && (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/20 p-4 flex flex-col gap-3">
          <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
            {t("outcomeSummary", { created: outcomeSummary.created, failed: outcomeSummary.failed })}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                  <th className="py-1 pr-4">{t("colUsername")}</th>
                  <th className="py-1 pr-4">{t("colPassword")}</th>
                  <th className="py-1">{t("colStatus")}</th>
                </tr>
              </thead>
              <tbody>
                {outcomes.map((o) => (
                  <tr key={o.row} className="border-t border-emerald-100 dark:border-emerald-900/40">
                    <td className="py-1 pr-4 font-mono text-xs text-gray-800 dark:text-slate-200">{o.username ?? "—"}</td>
                    <td className="py-1 pr-4 font-mono text-xs text-gray-800 dark:text-slate-200">{o.password ?? "—"}</td>
                    <td className="py-1">
                      {o.status === "created" ? (
                        <span className="text-emerald-700 dark:text-emerald-300">{t("statusCreated")}</span>
                      ) : (
                        <span className="text-red-600 dark:text-red-400">
                          {t("statusFailed")}: {commitErrorText(o)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <button
              type="button"
              onClick={downloadCredentials}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              {t("downloadCredentials")}
            </button>
          </div>
          <p className="text-xs text-emerald-800 dark:text-emerald-300">{t("credentialsHint")}</p>
        </div>
      )}
    </div>
  );
};

export default BulkImportPanel;
