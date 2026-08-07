import Announcements from "@/components/Announcements";
import AttendanceChartContainer from "@/components/AttendanceChartContainer";
import CountChartContainer from "@/components/CountChartContainer";
import EventCalendarContainer from "@/components/EventCalendarContainer";
import FinanceChart from "@/components/FinanceChart";
import UserCard from "@/components/UserCard";
import FormContainer from "@/components/FormContainer";
import { getUserRole } from "@/lib/auth";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";

const AdminPage = ({
  searchParams,
}: {
  searchParams: { [keys: string]: string | undefined };
}) => {
  const { sessionClaims } = auth();
  const role = getUserRole(sessionClaims);

  return (
    <div className="p-4 flex gap-4 flex-col md:flex-row">
      {/* LEFT */}
      <div className="w-full lg:w-2/3 flex flex-col gap-8">
        {/* USER CARDS HEADER */}
        <div className="page-top-banner p-5 flex items-center justify-between shine-hover">
          <div>
            <h2 className="text-3xl font-bold">Admin Command Center</h2>
            <p className="text-blue-50 text-sm mt-1">Manage users, classes, and performance from one place.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full bg-white/90 text-blue-900 px-3 py-1 text-xs font-semibold">Role: Admin</span>
              <span className="rounded-full bg-white/90 text-blue-900 px-3 py-1 text-xs font-semibold">Access: Full</span>
              <span className="rounded-full bg-white/90 text-blue-900 px-3 py-1 text-xs font-semibold">Workspace: School Ops</span>
            </div>
          </div>
          {role === "admin" && <FormContainer table="teacher" type="create" />}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="/dashboard/list/classes" className="panel-card p-4 shine-hover">
            <p className="text-xs uppercase tracking-wide text-blue-500 font-semibold">Operations</p>
            <h3 className="text-lg font-bold text-blue-900 mt-2">Class Management</h3>
            <p className="text-sm text-blue-700 mt-1">Create, assign supervisors, and adjust class capacity.</p>
          </Link>
          <Link href="/dashboard/list/teachers" className="panel-card p-4 shine-hover">
            <p className="text-xs uppercase tracking-wide text-blue-500 font-semibold">People</p>
            <h3 className="text-lg font-bold text-blue-900 mt-2">Teacher Directory</h3>
            <p className="text-sm text-blue-700 mt-1">Update profiles and keep subject allocations aligned.</p>
          </Link>
          <Link href="/dashboard/list/results" className="panel-card p-4 shine-hover">
            <p className="text-xs uppercase tracking-wide text-blue-500 font-semibold">Performance</p>
            <h3 className="text-lg font-bold text-blue-900 mt-2">Academic Results</h3>
            <p className="text-sm text-blue-700 mt-1">Review outcomes, trends, and publish improvements.</p>
          </Link>
        </div>

        {/* USER CARDS */}
        <div className="flex gap-4 justify-between flex-wrap">
          <UserCard type="admin" />
          <UserCard type="teacher" />
          <UserCard type="student" />
          <UserCard type="parent" />
        </div>
        {/* MIDDLE CHARTS */}
        <div className="flex gap-4 flex-col lg:flex-row">
          {/* COUNT CHART */}
          <div className="w-full lg:w-1/3 h-[450px]">
            <CountChartContainer />
          </div>
          {/* ATTENDANCE CHART */}
          <div className="w-full lg:w-2/3 h-[450px]">
            <AttendanceChartContainer />
          </div>
        </div>
        {/* BOTTOM CHART */}
        <div className="w-full h-[500px]">
          <FinanceChart />
        </div>
      </div>
      {/* RIGHT */}
      <div className="w-full lg:w-1/3 flex flex-col gap-8">
        <EventCalendarContainer searchParams={searchParams}/>
        <Announcements />
      </div>
    </div>
  );
};

export default AdminPage;