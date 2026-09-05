export const ITEM_PER_PAGE = 5

type RouteAccessMap = {
  [key: string]: string[];
};

export const routeAccessMap: RouteAccessMap = {
  "/dashboard/admin(.*)": ["admin"],
  "/dashboard/student(.*)": ["student"],
  "/dashboard/teacher(.*)": ["teacher"],
  "/dashboard/parent(.*)": ["parent"],
  "/dashboard/edit/teacher(.*)": ["admin", "teacher"],
  "/dashboard/list/teachers(.*)": ["admin", "teacher"],
  "/dashboard/list/students(.*)": ["admin", "teacher"],
  "/dashboard/list/parents": ["admin", "teacher"],
  "/dashboard/list/parents/(.*)": ["admin", "teacher", "parent"],
  "/dashboard/list/subjects(.*)": ["admin"],
  "/dashboard/list/classes(.*)": ["admin", "teacher"],
  "/dashboard/list/clubs(.*)": ["admin", "teacher", "student", "parent"],
  "/dashboard/list/lessons(.*)": ["admin", "teacher"],
  "/dashboard/list/exams(.*)": ["admin", "teacher", "student", "parent"],
  "/dashboard/list/assignments(.*)": ["admin", "teacher", "student"],
  "/dashboard/list/results(.*)": ["admin", "teacher", "student", "parent"],
  "/dashboard/list/attendance(.*)": ["admin", "teacher", "student"],
  "/dashboard/list/events(.*)": ["admin", "teacher", "student", "parent"],
  "/dashboard/list/announcements(.*)": ["admin", "teacher", "student"],
  "/dashboard/list/tickets(.*)": ["admin", "teacher", "student", "parent"],
  "/dashboard/list/report-cards(.*)": ["admin", "teacher"],
  "/dashboard/profile": ["admin", "teacher", "student", "parent"],
  "/dashboard/settings": ["admin", "teacher", "student", "parent"],
  "/dashboard/logout": ["admin", "teacher", "student", "parent"],
};
