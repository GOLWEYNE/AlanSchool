// Default rows shown per page on list screens. Was 5, which turned
// browsing Teachers (136 records / 28 pages), Students (746 / 32 pages)
// wide open into a lot of clicking - 25 cuts that down a lot while still
// keeping tables readable without scrolling. Users can override this per
// page with the page-size selector in <Pagination />.
export const ITEM_PER_PAGE = 25

// Choices offered by the page-size selector in <Pagination />.
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

// Turns the raw ?pageSize= URL value into a safe take/skip size for Prisma.
// Restricting it to PAGE_SIZE_OPTIONS (rather than accepting any number)
// keeps someone from hand-editing the URL into e.g. pageSize=999999 and
// pulling an entire table in one query.
export function resolvePageSize(value?: string): number {
  const parsed = value ? parseInt(value, 10) : NaN;
  return PAGE_SIZE_OPTIONS.includes(parsed) ? parsed : ITEM_PER_PAGE;
}

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
