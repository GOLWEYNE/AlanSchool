import FormContainer from "@/components/FormContainer";
import Pagination from "@/components/Pagination";
import Table from "@/components/Table";
import TableSearch from "@/components/TableSearch";
import PageHero from "@/components/PageHero";
import prisma from "@/lib/prisma";
import { ITEM_PER_PAGE } from "@/lib/settings";
import { Club, Prisma, Teacher } from "@/generated/prisma/client";
import { auth } from "@clerk/nextjs/server";
import { getUserRole } from "@/lib/auth";

type ClubList = Club & {
  instructor: Teacher | null;
  _count: { enrollments: number };
};

const CATEGORY_LABELS: Record<string, string> = {
  DANCING: "Dancing",
  PIANO: "Piano",
  CHESS: "Chess",
  HANDICRAFTS: "Handicrafts",
  FOOTBALL: "Football",
  VOLLEYBALL: "Volleyball",
  BASKETBALL: "Basketball",
  TENNIS: "Tennis",
  TABLE_TENNIS: "Table Tennis",
  KARATE: "Karate",
  JUDO: "Judo",
  GYMNASTICS: "Gymnastics",
  ASYQ: "Asyq (traditional game)",
  DOMBRA: "Dombra",
  GUITAR: "Guitar",
  OTHER: "Other",
};

const ClubListPage = async ({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) => {
  const { sessionClaims } = auth();
  const role = getUserRole(sessionClaims);

  const columns = [
    { header: "Club Name", accessor: "name" },
    { header: "Category", accessor: "category", className: "hidden md:table-cell" },
    { header: "Capacity", accessor: "capacity", className: "hidden md:table-cell" },
    { header: "Enrolled", accessor: "enrolled", className: "hidden md:table-cell" },
    { header: "Instructor", accessor: "instructor", className: "hidden md:table-cell" },
    ...(role === "admin" ? [{ header: "Actions", accessor: "action" }] : []),
  ];

  const renderRow = (item: ClubList) => (
    <tr
      key={item.id}
      className="border-b border-gray-200 dark:border-slate-800 even:bg-slate-50 dark:even:bg-slate-900/40 text-sm hover:bg-lamaPurpleLight dark:hover:bg-blue-950/40"
    >
      <td className="flex items-center gap-4 p-4">{item.name}</td>
      <td className="hidden md:table-cell">{CATEGORY_LABELS[item.category] ?? item.category}</td>
      <td className="hidden md:table-cell">{item.capacity}</td>
      <td className="hidden md:table-cell">{item._count.enrollments}</td>
      <td className="hidden md:table-cell">
        {item.instructor ? `${item.instructor.name} ${item.instructor.surname}` : "Unassigned"}
      </td>
      <td>
        <div className="flex items-center gap-2">
          {role === "admin" && (
            <>
              <FormContainer table="club" type="update" data={item} />
              <FormContainer table="club" type="delete" id={item.id} />
            </>
          )}
        </div>
      </td>
    </tr>
  );

  const { page, ...queryParams } = searchParams;
  const p = page ? parseInt(page) : 1;
  const query: Prisma.ClubWhereInput = {};
  if (queryParams) {
    for (const [key, value] of Object.entries(queryParams)) {
      if (value !== undefined) {
        switch (key) {
          case "search":
            query.name = { contains: value, mode: "insensitive" };
            break;
          default:
            break;
        }
      }
    }
  }

  const [data, count] = await prisma.$transaction([
    prisma.club.findMany({
      where: query,
      include: {
        instructor: true,
        _count: { select: { enrollments: { where: { status: "ACTIVE" } } } },
      },
      orderBy: { name: "asc" },
      take: ITEM_PER_PAGE,
      skip: ITEM_PER_PAGE * (p - 1),
    }),
    prisma.club.count({ where: query }),
  ]);

  return (
    <div className="panel-card p-4 md:p-5 flex-1 m-4 mt-0 shine-hover">
      <PageHero
        title="Clubs"
        subtitle="Manage after-school clubs, capacity, and instructors."
        emoji="🎯"
        stats={[
          { label: "Total Clubs", value: count },
          { label: "Visible Now", value: data.length },
          { label: "Admin Mode", value: role === "admin" ? "On" : "Off" },
        ]}
      />
      <div className="flex items-center justify-between">
        <h1 className="hidden md:block text-lg font-semibold text-blue-900">All Clubs</h1>
        <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
          <TableSearch />
          <div className="flex items-center gap-4 self-end">
            {role === "admin" && <FormContainer table="club" type="create" />}
          </div>
        </div>
      </div>
      <Table columns={columns} renderRow={renderRow} data={data} />
      <Pagination page={p} count={count} />
    </div>
  );
};

export default ClubListPage;
