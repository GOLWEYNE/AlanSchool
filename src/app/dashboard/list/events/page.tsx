import type { ReactNode } from "react";
import FormContainer from "@/components/FormContainer";
import TableSearch from "@/components/TableSearch";
import PageHero from "@/components/PageHero";
import EventsCalendar, { CalendarEventItem } from "@/components/EventsCalendar";
import prisma from "@/lib/prisma";
import { Class, Event, Prisma } from "@/generated/prisma/client";
import { auth } from "@clerk/nextjs/server";
import { getUserRole } from "@/lib/auth";
import { getTranslations } from "next-intl/server";

type EventList = Event & { class: Class | null };

const EventListPage = async ({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) => {

  const { userId, sessionClaims } = auth();
  const role = getUserRole(sessionClaims);
  const currentUserId = userId;
  const t = await getTranslations("List.events");

  const { page, ...queryParams } = searchParams;

  // URL PARAMS CONDITION

  const query: Prisma.EventWhereInput = {};

  if (queryParams) {
    for (const [key, value] of Object.entries(queryParams)) {
      if (value !== undefined) {
        switch (key) {
          case "search":
            query.title = { contains: value, mode: "insensitive" };
            break;
          default:
            break;
        }
      }
    }
  }

  // ROLE CONDITIONS

  const roleConditions = {
    teacher: { lessons: { some: { teacherId: currentUserId! } } },
    student: { students: { some: { id: currentUserId! } } },
    parent: { students: { some: { parentId: currentUserId! } } },
  };

  // Admins manage every event regardless of class targeting. Restricting
  // this filter to non-admin roles was the root cause of an admin losing
  // sight of an event the moment it was targeted at a specific class -
  // `roleConditions["admin"]` doesn't exist, so the filter fell back to
  // `{ class: {} }`, which matches no class-bound events at all.
  if (role !== "admin") {
    query.OR = [
      { classId: null },
      {
        class: roleConditions[role as keyof typeof roleConditions] || {},
      },
    ];
  }

  // No take/skip here on purpose: a calendar needs every event that falls
  // in whatever month/week the viewer navigates to, not just one page's
  // worth - pagination doesn't make sense once the flat table is gone.
  const data: EventList[] = await prisma.event.findMany({
    where: query,
    include: {
      class: true,
    },
    orderBy: { startTime: "asc" },
  });

  const calendarEvents: CalendarEventItem[] = data.map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    start: item.startTime,
    end: item.endTime,
    classId: item.classId,
    className: item.class?.name ?? null,
  }));

  // Pre-rendered per-event admin controls (edit/delete), keyed by event id,
  // for the calendar's detail panel to drop in - FormContainer is a server
  // component and can't be constructed from inside the client calendar.
  const actionsByEventId: Record<number, ReactNode> = {};
  if (role === "admin") {
    for (const item of data) {
      actionsByEventId[item.id] = (
        <>
          <FormContainer table="event" type="update" data={item} />
          <FormContainer table="event" type="delete" id={item.id} />
        </>
      );
    }
  }

  return (
    <div className="panel-card p-4 md:p-5 rounded-md flex-1 m-4 mt-0 shine-hover">
      <PageHero
        title={t("title")}
        subtitle={t("subtitle")}
        emoji={t("emoji")}
        stats={[
          { label: t("totalLabel"), value: data.length },
          { label: t("visibleLabel"), value: data.length },
          { label: t("adminControlsLabel"), value: role === "admin" ? t("enabled") : t("readOnly") },
        ]}
      />
      {/* TOP */}
      <div className="flex items-center justify-between">
        <h1 className="hidden md:block text-lg font-semibold text-blue-900">{t("heading")}</h1>
        <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
          <TableSearch />
          <div className="flex items-center gap-4 self-end">
            {role === "admin" && <FormContainer table="event" type="create" />}
          </div>
        </div>
      </div>
      {/* CALENDAR */}
      <EventsCalendar events={calendarEvents} actionsByEventId={actionsByEventId} />
    </div>
  );
};

export default EventListPage;
