"use client";

import Image from "next/image";
import { useFormatter, useTranslations } from "next-intl";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// Placeholder figures (no finance data model yet); month is a 0-based index so
// the axis label can be formatted per language.
const data = [
  { month: 0, income: 4000, expense: 2400 },
  { month: 1, income: 3000, expense: 1398 },
  { month: 2, income: 2000, expense: 9800 },
  { month: 3, income: 2780, expense: 3908 },
  { month: 4, income: 1890, expense: 4800 },
  { month: 5, income: 2390, expense: 3800 },
  { month: 6, income: 3490, expense: 4300 },
  { month: 7, income: 3490, expense: 4300 },
  { month: 8, income: 3490, expense: 4300 },
  { month: 9, income: 3490, expense: 4300 },
  { month: 10, income: 3490, expense: 4300 },
  { month: 11, income: 3490, expense: 4300 },
];

const FinanceChart = () => {
  const t = useTranslations("Widgets.finance");
  const format = useFormatter();
  const chartData = data.map((d) => ({
    ...d,
    name: format.dateTime(new Date(2000, d.month, 1), { month: "short" }),
  }));
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl w-full h-full p-4">
      <div className="flex justify-between items-center">
        <h1 className="text-lg font-semibold dark:text-blue-100">{t("title")}</h1>
        <Image src="/moreDark.png" alt="" width={20} height={20} className="dark:invert dark:opacity-70" />
      </div>
      <ResponsiveContainer width="100%" height="90%">
        <LineChart
          width={500}
          height={300}
          data={chartData}
          margin={{
            top: 5,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#ddd" />
          <XAxis
            dataKey="name"
            axisLine={false}
            tick={{ fill: "#d1d5db" }}
            tickLine={false}
            tickMargin={10}
          />
          <YAxis axisLine={false} tick={{ fill: "#d1d5db" }} tickLine={false}  tickMargin={20}/>
          <Tooltip />
          <Legend
            align="center"
            verticalAlign="top"
            wrapperStyle={{ paddingTop: "10px", paddingBottom: "30px" }}
          />
          <Line
            type="monotone"
            dataKey="income"
            name={t("income")}
            stroke="#C3EBFA"
            strokeWidth={5}
          />
          <Line type="monotone" dataKey="expense" name={t("expense")} stroke="#CFCEFF" strokeWidth={5}/>
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default FinanceChart;
