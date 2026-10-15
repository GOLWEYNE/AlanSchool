"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import { deleteMockScore, saveMockScores } from "@/lib/mockTestActions";
import {
  IELTS_SECTIONS,
  SAT_SECTIONS,
  ieltsOverall,
  satTotal,
  type MockKind,
} from "@/lib/mockTestsShared";

export type EntryStudent = {
  id: string;
  name: string;
  existing: { score: number; sections: Record<string, number> | null } | null;
};

export type RecentScore = {
  id: number;
  studentName: string;
  kind: MockKind;
  score: number;
  date: string; // YYYY-MM-DD (school day)
};

type Draft = { score: string; sections: Record<string, string> };

const input =
  "w-16 rounded-md p-1.5 text-center text-sm ring-[1.5px] ring-gray-300 dark:ring-slate-700 dark:bg-slate-800 dark:text-slate-100";
const select =
  "rounded-md p-2 text-sm ring-[1.5px] ring-gray-300 dark:ring-slate-700 dark:bg-slate-800 dark:text-slate-100";

const num = (s: string): number | null => {
  if (s.trim() === "") return null;
  const n = Number(s);
  return Number.isNaN(n) ? null : n;
};

const MockTestEntry = ({
  classes,
  classId,
  kind,
  date,
  students,
  recent,
}: {
  classes: { id: number; name: string }[];
  classId: number | null;
  kind: MockKind;
  date: string;
  students: EntryStudent[];
  recent: RecentScore[];
}) => {
  const t = useTranslations("MockTests");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const sectionKeys = kind === "IELTS" ? IELTS_SECTIONS : SAT_SECTIONS;

  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => {
    const init: Record<string, Draft> = {};
    for (const s of students) {
      init[s.id] = {
        score: s.existing ? String(s.existing.score) : "",
        sections: Object.fromEntries(
          Object.entries(s.existing?.sections ?? {}).map(([k, v]) => [k, String(v)])
        ),
      };
    }
    return init;
  });

  const go = (next: { classId?: number | null; kind?: MockKind; date?: string }) => {
    const params = new URLSearchParams();
    const c = next.classId === undefined ? classId : next.classId;
    if (c) params.set("classId", String(c));
    params.set("kind", next.kind ?? kind);
    params.set("date", next.date ?? date);
    router.push(`?${params.toString()}`);
  };

  const setScore = (id: string, value: string) =>
    setDrafts((d) => ({ ...d, [id]: { ...(d[id] ?? { score: "", sections: {} }), score: value } }));
  const setSection = (id: string, key: string, value: string) =>
    setDrafts((d) => {
      const cur = d[id] ?? { score: "", sections: {} };
      return { ...d, [id]: { ...cur, sections: { ...cur.sections, [key]: value } } };
    });

  const filledCount = useMemo(
    () =>
      students.filter((s) => {
        const d = drafts[s.id];
        return d && (d.score.trim() !== "" || Object.values(d.sections).some((v) => v.trim() !== ""));
      }).length,
    [drafts, students]
  );

  const computed = (d: Draft | undefined): number | null => {
    if (!d) return null;
    const sec = Object.fromEntries(Object.entries(d.sections).map(([k, v]) => [k, num(v)]));
    return kind === "IELTS" ? ieltsOverall(sec) : satTotal(sec);
  };

  const save = () => {
    const rows = students
      .map((s) => {
        const d = drafts[s.id];
        if (!d) return null;
        const sections = Object.fromEntries(
          Object.entries(d.sections)
            .map(([k, v]) => [k, num(v)] as const)
            .filter(([, v]) => v !== null)
        );
        const score = num(d.score);
        if (score === null && Object.keys(sections).length === 0) return null;
        return { studentId: s.id, score, sections: Object.keys(sections).length ? sections : null };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (!rows.length) {
      toast.error(t("errors.nothingToSave"));
      return;
    }
    startTransition(async () => {
      const res = await saveMockScores({ kind, date, rows });
      if (res.ok) {
        toast.success(t("saved", { count: res.saved ?? rows.length }));
        router.refresh();
      } else {
        toast.error(res.error ?? t("errors.unavailable"));
      }
    });
  };

  const remove = (id: number) => {
    if (!window.confirm(t("confirmDelete"))) return;
    startTransition(async () => {
      const res = await deleteMockScore(id);
      if (res.ok) {
        toast.success(t("deleted"));
        router.refresh();
      } else {
        toast.error(res.error ?? t("errors.unavailable"));
      }
    });
  };

  const totalLabel = kind === "IELTS" ? t("overall") : t("total");

  return (
    <div className="flex flex-col gap-4">
      <div className="panel-card p-4 rounded-md">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 dark:text-slate-400">{t("class")}</label>
            <select className={select} value={classId ?? ""} onChange={(e) => go({ classId: parseInt(e.target.value, 10) })}>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 dark:text-slate-400">{t("test")}</label>
            <div className="flex overflow-hidden rounded-md text-xs font-semibold ring-[1.5px] ring-gray-300 dark:ring-slate-700">
              {(["IELTS", "SAT"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => go({ kind: k })}
                  className={`px-4 py-2 ${k === kind ? "bg-amber-400 text-slate-900" : "bg-transparent text-gray-600 dark:text-slate-300"}`}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 dark:text-slate-400">{t("date")}</label>
            <input type="date" className={select} value={date} onChange={(e) => e.target.value && go({ date: e.target.value })} />
          </div>
          <p className="max-w-md text-xs text-gray-500 dark:text-slate-400">{kind === "IELTS" ? t("hintIelts") : t("hintSat")}</p>
        </div>
      </div>

      <div className="panel-card overflow-x-auto rounded-md p-4">
        {students.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-slate-400">{t("noStudents")}</p>
        ) : (
          <>
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-gray-500 dark:text-slate-400">
                  <th className="p-2">{t("student")}</th>
                  {sectionKeys.map((k) => (
                    <th key={k} className="p-2 text-center">
                      {t(`sections.${k}`)}
                    </th>
                  ))}
                  <th className="p-2 text-center">{totalLabel}</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => {
                  const d = drafts[s.id];
                  const auto = computed(d);
                  return (
                    <tr key={s.id} className="border-t border-gray-200 even:bg-slate-50 dark:border-slate-800 dark:even:bg-slate-900/40">
                      <td className="p-2 font-medium">{s.name}</td>
                      {sectionKeys.map((k) => (
                        <td key={k} className="p-2 text-center">
                          <input
                            type="number"
                            inputMode="decimal"
                            className={input}
                            min={kind === "IELTS" ? 0 : 200}
                            max={kind === "IELTS" ? 9 : 800}
                            step={kind === "IELTS" ? 0.5 : 10}
                            value={d?.sections[k] ?? ""}
                            onChange={(e) => setSection(s.id, k, e.target.value)}
                            aria-label={`${s.name} ${t(`sections.${k}`)}`}
                          />
                        </td>
                      ))}
                      <td className="p-2 text-center">
                        <input
                          type="number"
                          inputMode="decimal"
                          className={`${input} w-20 font-semibold`}
                          min={kind === "IELTS" ? 0 : 400}
                          max={kind === "IELTS" ? 9 : 1600}
                          step={kind === "IELTS" ? 0.5 : 10}
                          value={d?.score ?? ""}
                          placeholder={auto !== null ? String(auto) : ""}
                          onChange={(e) => setScore(s.id, e.target.value)}
                          aria-label={`${s.name} ${totalLabel}`}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-gray-500 dark:text-slate-400">{t("filled", { count: filledCount })}</span>
              <button
                type="button"
                onClick={save}
                disabled={pending}
                className="rounded-md bg-amber-400 px-5 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-300 disabled:opacity-60"
              >
                {pending ? t("saving") : t("save")}
              </button>
            </div>
          </>
        )}
      </div>

      <div className="panel-card overflow-x-auto rounded-md p-4">
        <h2 className="mb-2 text-lg font-semibold text-blue-900 dark:text-blue-100">{t("recentTitle")}</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-slate-400">{t("noRecent")}</p>
        ) : (
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-gray-500 dark:text-slate-400">
                <th className="p-2">{t("date")}</th>
                <th className="p-2">{t("student")}</th>
                <th className="p-2">{t("test")}</th>
                <th className="p-2 text-center">{t("score")}</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.id} className="border-t border-gray-200 dark:border-slate-800">
                  <td className="p-2">{r.date}</td>
                  <td className="p-2">{r.studentName}</td>
                  <td className="p-2">{r.kind}</td>
                  <td className="p-2 text-center font-semibold">{r.score}</td>
                  <td className="p-2 text-right">
                    <button type="button" onClick={() => remove(r.id)} disabled={pending} className="text-xs font-semibold text-rose-600 hover:underline disabled:opacity-60">
                      {t("delete")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default MockTestEntry;
