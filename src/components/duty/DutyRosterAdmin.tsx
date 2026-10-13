"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import {
  addDayOff,
  autoLinkTeachers,
  importSchedule,
  linkDutyTeacher,
  loadDefaultSchedule,
  mergeDutyTeachers,
  removeDayOff,
  renameDutyTeacher,
  saveDutySettings,
  sendTestNotification,
  setSlotTeachers,
  type ActionResult,
} from "@/lib/dutyActions";
import { DUTY_BLOCKS, DUTY_FLOORS, DUTY_TIME_SLOTS, DUTY_WEEKDAYS, dutyNameKey } from "@/lib/dutyShared";
import type { DutyTeacherDTO, RosterSlotDTO } from "@/lib/duty";

type Account = { id: string; label: string };
type Settings = { enabled: boolean; leadMinutes: number; notifyAtStart: boolean; timeZone: string };
type DayOff = { date: string; reason: string | null };

type Props = {
  slots: RosterSlotDTO[];
  teachers: DutyTeacherDTO[];
  accounts: Account[];
  settings: Settings;
  daysOff: DayOff[];
};

type Tab = "grid" | "teachers" | "import" | "settings";

const INPUT =
  "rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";
const BTN =
  "rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50";
const BTN_GHOST =
  "rounded-md border border-gray-300 px-3 py-1.5 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800";

const DutyRosterAdmin = ({ slots, teachers, accounts, settings, daysOff }: Props) => {
  const t = useTranslations("Duty");
  const [tab, setTab] = useState<Tab>("grid");
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<ActionResult>, after?: (r: ActionResult) => void) =>
    start(async () => {
      try {
        const r = await fn();
        (r.ok ? toast.success : toast.error)(r.message ?? (r.ok ? t("saved") : t("failed")));
        after?.(r);
      } catch {
        toast.error(t("failed"));
      }
    });

  const tabs: { key: Tab; label: string }[] = [
    { key: "grid", label: t("tabs.grid") },
    { key: "teachers", label: t("tabs.teachers") },
    { key: "import", label: t("tabs.import") },
    { key: "settings", label: t("tabs.settings") },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {tabs.map((x) => (
          <button
            key={x.key}
            type="button"
            onClick={() => setTab(x.key)}
            className={
              "rounded-lg px-4 py-2 text-sm font-semibold transition " +
              (tab === x.key
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-700 hover:bg-gray-100 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800")
            }
          >
            {x.label}
          </button>
        ))}
        <button type="button" className={BTN_GHOST + " ml-auto"} disabled={pending} onClick={() => run(() => sendTestNotification())}>
          {t("sendTest")}
        </button>
      </div>

      {tab === "grid" && <GridTab slots={slots} teachers={teachers} run={run} pending={pending} />}
      {tab === "teachers" && <TeachersTab teachers={teachers} accounts={accounts} run={run} pending={pending} />}
      {tab === "import" && <ImportTab run={run} pending={pending} hasData={slots.length > 0} />}
      {tab === "settings" && <SettingsTab settings={settings} daysOff={daysOff} run={run} pending={pending} />}
    </div>
  );
};

type RunFn = (fn: () => Promise<ActionResult>, after?: (r: ActionResult) => void) => void;

// ---------------------------------------------------------------------------
function GridTab({ slots, teachers, run, pending }: { slots: RosterSlotDTO[]; teachers: DutyTeacherDTO[]; run: RunFn; pending: boolean }) {
  const t = useTranslations("Duty");
  const [floor, setFloor] = useState<number>(1);
  const [weekday, setWeekday] = useState<number>(1);
  // Local copy so a changed dropdown shows immediately; the server action is the source of truth on reload.
  const [local, setLocal] = useState<Record<number, number[]>>({});

  const idsFor = (s: RosterSlotDTO) => local[s.id] ?? s.teacherIds;
  const find = (block: string, start: string) =>
    slots.find((s) => s.floor === floor && s.weekday === weekday && s.block === block && s.startTime === start);

  const update = (s: RosterSlotDTO, ids: number[]) => {
    const prev = idsFor(s);
    setLocal((l) => ({ ...l, [s.id]: ids }));
    run(
      () => setSlotTeachers(s.id, ids),
      (r) => {
        if (!r.ok) setLocal((l) => ({ ...l, [s.id]: prev }));
      }
    );
  };

  const renderSelect = (s: RosterSlotDTO, index: number) => {
    const ids = idsFor(s);
    return (
      <select
        className={INPUT + " w-full min-w-[9rem]"}
        value={ids[index] ?? ""}
        disabled={pending}
        onChange={(e) => {
          const v = e.target.value ? Number(e.target.value) : null;
          const next = [...ids];
          if (v === null) next.splice(index, 1);
          else next[index] = v;
          update(s, next.filter((n) => n !== undefined));
        }}
      >
        <option value="">{index === 0 ? t("unassigned") : t("none")}</option>
        {teachers.map((x) => (
          <option key={x.id} value={x.id}>
            {x.nameEn}
          </option>
        ))}
      </select>
    );
  };

  if (!slots.length) {
    return <p className="rounded-xl bg-white p-4 text-sm dark:bg-slate-900 dark:text-slate-200">{t("emptyRoster")}</p>;
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap gap-2">
        {DUTY_FLOORS.map((f) => (
          <button key={f} type="button" onClick={() => setFloor(f)} className={f === floor ? BTN : BTN_GHOST}>
            {t("floor", { n: f })}
          </button>
        ))}
        <span className="mx-2 hidden w-px bg-gray-300 sm:block" />
        {DUTY_WEEKDAYS.map((d) => (
          <button key={d} type="button" onClick={() => setWeekday(d)} className={d === weekday ? BTN : BTN_GHOST}>
            {t(`days.${d}`)}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-gray-500 dark:text-slate-400">
              <th className="p-2">{t("time")}</th>
              {DUTY_BLOCKS.map((b) => (
                <th key={b} className="p-2">
                  {t("block", { b })}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DUTY_TIME_SLOTS.map(([s, e]) => (
              <tr key={s} className="border-t border-gray-100 align-top dark:border-slate-800">
                <td className="whitespace-nowrap p-2 font-semibold dark:text-slate-100">
                  {s}–{e}
                </td>
                {DUTY_BLOCKS.map((b) => {
                  const slot = find(b, s);
                  if (!slot) return <td key={b} className="p-2 text-gray-400">—</td>;
                  const ids = idsFor(slot);
                  const showSecond = ids.length >= 2 || s === "16:00";
                  return (
                    <td key={b} className="p-2">
                      <div className="flex flex-col gap-1">
                        {renderSelect(slot, 0)}
                        {showSecond && renderSelect(slot, 1)}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
function TeachersTab({ teachers, accounts, run, pending }: { teachers: DutyTeacherDTO[]; accounts: Account[]; run: RunFn; pending: boolean }) {
  const t = useTranslations("Duty");
  const unlinked = teachers.filter((x) => !x.teacherId).length;

  const duplicates = useMemo(() => {
    const groups = new Map<string, DutyTeacherDTO[]>();
    for (const x of teachers) {
      const k = dutyNameKey(x.nameEn);
      groups.set(k, [...(groups.get(k) ?? []), x]);
    }
    return Array.from(groups.values()).filter((g) => g.length > 1);
  }, [teachers]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm dark:text-slate-200">{t("unlinkedCount", { count: unlinked, total: teachers.length })}</p>
        <button type="button" className={BTN} disabled={pending} onClick={() => run(() => autoLinkTeachers())}>
          {t("autoLink")}
        </button>
      </div>

      {duplicates.length > 0 && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="mb-2 font-semibold">{t("duplicatesTitle")}</p>
          <p className="mb-3 text-xs opacity-80">{t("duplicatesHint")}</p>
          <div className="flex flex-col gap-2">
            {duplicates.map((g) => (
              <div key={g.map((x) => x.id).join("-")} className="flex flex-wrap items-center gap-2">
                {g.map((x) => (
                  <span key={x.id} className="rounded bg-white px-2 py-0.5 dark:bg-slate-800">
                    {x.nameEn} ({x.dutyCount})
                  </span>
                ))}
                {g.slice(1).map((x) => (
                  <button
                    key={x.id}
                    type="button"
                    className={BTN_GHOST}
                    disabled={pending}
                    onClick={() => {
                      if (confirm(t("mergeConfirm", { from: x.nameEn, into: g[0].nameEn }))) run(() => mergeDutyTeachers(x.id, g[0].id));
                    }}
                  >
                    {t("mergeInto", { from: x.nameEn, into: g[0].nameEn })}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-gray-500 dark:text-slate-400">
              <th className="p-2">{t("nameEn")}</th>
              <th className="p-2">{t("nameOriginal")}</th>
              <th className="p-2">{t("duties")}</th>
              <th className="p-2">{t("account")}</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {teachers.map((x) => (
              <TeacherRow key={x.id} x={x} accounts={accounts} run={run} pending={pending} all={teachers} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TeacherRow({
  x,
  accounts,
  run,
  pending,
  all,
}: {
  x: DutyTeacherDTO;
  accounts: Account[];
  run: RunFn;
  pending: boolean;
  all: DutyTeacherDTO[];
}) {
  const t = useTranslations("Duty");
  const [nameEn, setNameEn] = useState(x.nameEn);
  const [nameOriginal, setNameOriginal] = useState(x.nameOriginal ?? "");
  const dirty = nameEn !== x.nameEn || nameOriginal !== (x.nameOriginal ?? "");
  const takenIds = new Set(all.filter((o) => o.teacherId && o.id !== x.id).map((o) => o.teacherId as string));

  return (
    <tr className="border-t border-gray-100 dark:border-slate-800">
      <td className="p-2">
        <input className={INPUT + " w-44"} value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
      </td>
      <td className="p-2">
        <input className={INPUT + " w-44"} value={nameOriginal} onChange={(e) => setNameOriginal(e.target.value)} placeholder="—" />
      </td>
      <td className="p-2 dark:text-slate-200">{x.dutyCount}</td>
      <td className="p-2">
        <select
          className={INPUT + " w-56"}
          value={x.teacherId ?? ""}
          disabled={pending}
          onChange={(e) => run(() => linkDutyTeacher(x.id, e.target.value || null))}
        >
          <option value="">{t("notLinked")}</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id} disabled={takenIds.has(a.id)}>
              {a.label}
              {takenIds.has(a.id) ? ` (${t("alreadyLinked")})` : ""}
            </option>
          ))}
        </select>
      </td>
      <td className="p-2">
        {dirty && (
          <button type="button" className={BTN} disabled={pending} onClick={() => run(() => renameDutyTeacher(x.id, nameEn, nameOriginal))}>
            {t("save")}
          </button>
        )}
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
function ImportTab({ run, pending, hasData }: { run: RunFn; pending: boolean; hasData: boolean }) {
  const t = useTranslations("Duty");
  const [text, setText] = useState("");
  const [format, setFormat] = useState<"csv" | "json">("csv");
  const [mode, setMode] = useState<"replace" | "merge">("merge");
  const [errors, setErrors] = useState<string[]>([]);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setText(await file.text());
    setFormat(file.name.toLowerCase().endsWith(".json") ? "json" : "csv");
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold dark:text-slate-100">{t("builtInTitle")}</h2>
        <p className="text-sm text-gray-600 dark:text-slate-300">{t("builtInHint")}</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={BTN}
            disabled={pending}
            onClick={() => {
              if (!hasData || confirm(t("replaceConfirm"))) run(() => loadDefaultSchedule("replace"));
            }}
          >
            {t("loadReplace")}
          </button>
          <button type="button" className={BTN_GHOST} disabled={pending} onClick={() => run(() => loadDefaultSchedule("merge"))}>
            {t("loadMerge")}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold dark:text-slate-100">{t("importTitle")}</h2>
        <p className="text-sm text-gray-600 dark:text-slate-300">{t("importHint")}</p>
        <pre className="overflow-x-auto rounded bg-gray-100 p-2 text-xs dark:bg-slate-800 dark:text-slate-200">
{`floor,weekday,block,start,end,teachers
1,Mon,1-2,08:55,09:40,Isakhova U.
2,Mon,1-2,16:00,17:30,Kerimova D. / Ashim A.`}
        </pre>
        <div className="flex flex-wrap items-center gap-2">
          <input type="file" accept=".csv,.json,text/csv,application/json" onChange={(e) => onFile(e.target.files?.[0])} className="text-sm dark:text-slate-200" />
          <select className={INPUT} value={format} onChange={(e) => setFormat(e.target.value as "csv" | "json")}>
            <option value="csv">CSV</option>
            <option value="json">JSON</option>
          </select>
          <select className={INPUT} value={mode} onChange={(e) => setMode(e.target.value as "replace" | "merge")}>
            <option value="merge">{t("modeMerge")}</option>
            <option value="replace">{t("modeReplace")}</option>
          </select>
        </div>
        <textarea
          className={INPUT + " h-48 w-full font-mono"}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("pasteHere")}
        />
        {errors.length > 0 && (
          <ul className="list-disc pl-5 text-sm text-red-600 dark:text-red-400">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
        <div>
          <button
            type="button"
            className={BTN}
            disabled={pending || !text.trim()}
            onClick={() => {
              if (mode === "replace" && !confirm(t("replaceConfirm"))) return;
              setErrors([]);
              run(() => importSchedule(text, format, mode), (r) => setErrors(r.errors ?? []));
            }}
          >
            {t("import")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
function SettingsTab({ settings, daysOff, run, pending }: { settings: Settings; daysOff: DayOff[]; run: RunFn; pending: boolean }) {
  const t = useTranslations("Duty");
  const [s, setS] = useState(settings);
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold dark:text-slate-100">{t("remindersTitle")}</h2>
        <label className="flex items-center gap-2 text-sm dark:text-slate-200">
          <input type="checkbox" checked={s.enabled} onChange={(e) => setS({ ...s, enabled: e.target.checked })} />
          {t("enabled")}
        </label>
        <label className="flex items-center gap-2 text-sm dark:text-slate-200">
          {t("leadMinutes")}
          <input type="number" min={0} max={120} className={INPUT + " w-20"} value={s.leadMinutes} onChange={(e) => setS({ ...s, leadMinutes: Number(e.target.value) })} />
        </label>
        <label className="flex items-center gap-2 text-sm dark:text-slate-200">
          <input type="checkbox" checked={s.notifyAtStart} onChange={(e) => setS({ ...s, notifyAtStart: e.target.checked })} />
          {t("notifyAtStart")}
        </label>
        <label className="flex items-center gap-2 text-sm dark:text-slate-200">
          {t("timeZone")}
          <input className={INPUT + " w-48"} value={s.timeZone} onChange={(e) => setS({ ...s, timeZone: e.target.value })} />
        </label>
        <div>
          <button type="button" className={BTN} disabled={pending} onClick={() => run(() => saveDutySettings(s))}>
            {t("save")}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold dark:text-slate-100">{t("daysOffTitle")}</h2>
        <p className="text-sm text-gray-600 dark:text-slate-300">{t("daysOffHint")}</p>
        <div className="flex flex-wrap gap-2">
          <input type="date" className={INPUT} value={date} onChange={(e) => setDate(e.target.value)} />
          <input className={INPUT} placeholder={t("reason")} value={reason} onChange={(e) => setReason(e.target.value)} />
          <button
            type="button"
            className={BTN}
            disabled={pending || !date}
            onClick={() =>
              run(
                () => addDayOff(date, reason),
                (r) => {
                  if (r.ok) {
                    setDate("");
                    setReason("");
                  }
                }
              )
            }
          >
            {t("add")}
          </button>
        </div>
        <ul className="flex flex-col gap-1 text-sm dark:text-slate-200">
          {daysOff.length === 0 && <li className="text-gray-500">{t("noDaysOff")}</li>}
          {daysOff.map((d) => (
            <li key={d.date} className="flex items-center justify-between rounded bg-gray-50 px-2 py-1 dark:bg-slate-800">
              <span>
                {d.date}
                {d.reason ? ` — ${d.reason}` : ""}
              </span>
              <button type="button" className="text-red-600 hover:underline" disabled={pending} onClick={() => run(() => removeDayOff(d.date))}>
                {t("remove")}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default DutyRosterAdmin;
