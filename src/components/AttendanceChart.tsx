"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useTheme } from "@/context/ThemeContext";

type AttendanceDatum = { name: string; present: number; absent: number };

type CustomTooltipProps = {
  active?: boolean;
  payload?: { dataKey?: string; value?: number | string }[];
  label?: string;
  isDark: boolean;
};

const CustomTooltip = ({ active, payload, label, isDark }: CustomTooltipProps) => {
  if (!active || !payload || !payload.length) return null;

  const present = payload.find((p) => p.dataKey === "present")?.value ?? 0;
  const absent = payload.find((p) => p.dataKey === "absent")?.value ?? 0;
  const total = Number(present) + Number(absent);
  const rate = total > 0 ? Math.round((Number(present) / total) * 100) : null;

  return (
    <div
      className="rounded-xl px-4 py-3 text-sm shadow-xl backdrop-blur-md border"
      style={{
        background: isDark ? "rgba(16, 24, 43, 0.96)" : "rgba(255, 255, 255, 0.98)",
        borderColor: isDark ? "rgba(31, 42, 68, 0.9)" : "rgba(191, 219, 254, 0.9)",
      }}
    >
      <p className="font-semibold mb-1.5" style={{ color: isDark ? "#e5edff" : "#0b3b8f" }}>
        {label}
        {rate !== null && (
          <span className="ml-2 text-xs font-medium" style={{ color: isDark ? "#7dd3fc" : "#1d4ed8" }}>
            {rate}% present
          </span>
        )}
      </p>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: isDark ? "#60a5fa" : "#2563eb" }} />
          <span style={{ color: isDark ? "#c3c2b7" : "#52514e" }}>Present</span>
          <span className="ml-auto font-semibold" style={{ color: isDark ? "#e5edff" : "#0b0b0b" }}>{present}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: isDark ? "#fbbf24" : "#f59e0b" }} />
          <span style={{ color: isDark ? "#c3c2b7" : "#52514e" }}>Absent</span>
          <span className="ml-auto font-semibold" style={{ color: isDark ? "#e5edff" : "#0b0b0b" }}>{absent}</span>
        </div>
      </div>
    </div>
  );
};

const CustomLegend = ({ isDark }: { isDark: boolean }) => (
  <div className="flex items-center gap-5 px-1">
    <div className="flex items-center gap-2">
      <span
        className="w-3 h-3 rounded-full shadow-sm"
        style={{ background: `linear-gradient(135deg, ${isDark ? "#93c5fd" : "#60a5fa"}, ${isDark ? "#60a5fa" : "#1d4ed8"})` }}
      />
      <span className="text-xs font-medium" style={{ color: isDark ? "#c3c2b7" : "#52514e" }}>Present</span>
    </div>
    <div className="flex items-center gap-2">
      <span
        className="w-3 h-3 rounded-full shadow-sm"
        style={{ background: `linear-gradient(135deg, ${isDark ? "#fde68a" : "#fbbf24"}, ${isDark ? "#fbbf24" : "#f59e0b"})` }}
      />
      <span className="text-xs font-medium" style={{ color: isDark ? "#c3c2b7" : "#52514e" }}>Absent</span>
    </div>
  </div>
);

const AttendanceChart = ({ data }: { data: AttendanceDatum[] }) => {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const axisColor = isDark ? "#94a3b8" : "#64748b";
  const gridColor = isDark ? "#1f2a44" : "#e2e8f0";

  return (
    <ResponsiveContainer width="100%" height="88%">
      <BarChart data={data} barSize={22} barGap={6} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id="presentBarGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={isDark ? "#93c5fd" : "#60a5fa"} />
            <stop offset="100%" stopColor={isDark ? "#3b82f6" : "#1d4ed8"} />
          </linearGradient>
          <linearGradient id="absentBarGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={isDark ? "#fde68a" : "#fbbf24"} />
            <stop offset="100%" stopColor={isDark ? "#eab308" : "#f59e0b"} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="4 4" vertical={false} stroke={gridColor} />
        <XAxis
          dataKey="name"
          axisLine={false}
          tick={{ fill: axisColor, fontSize: 12, fontWeight: 500 }}
          tickLine={false}
          dy={6}
        />
        <YAxis
          axisLine={false}
          tick={{ fill: axisColor, fontSize: 12 }}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip
          cursor={{ fill: isDark ? "rgba(96, 165, 250, 0.08)" : "rgba(59, 130, 246, 0.06)", radius: 8 }}
          content={(props) => <CustomTooltip {...(props as CustomTooltipProps)} isDark={isDark} />}
        />
        <Legend
          align="left"
          verticalAlign="top"
          content={() => <CustomLegend isDark={isDark} />}
          wrapperStyle={{ paddingBottom: 18 }}
        />
        <Bar
          dataKey="present"
          fill="url(#presentBarGradient)"
          radius={[8, 8, 0, 0]}
          maxBarSize={28}
          animationDuration={700}
        />
        <Bar
          dataKey="absent"
          fill="url(#absentBarGradient)"
          radius={[8, 8, 0, 0]}
          maxBarSize={28}
          animationDuration={700}
          animationBegin={100}
        />
      </BarChart>
    </ResponsiveContainer>
  );
};

export default AttendanceChart;
