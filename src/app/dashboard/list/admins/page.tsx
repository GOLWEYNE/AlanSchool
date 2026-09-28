import FormContainer from "@/components/FormContainer";
import Pagination from "@/components/Pagination";
import Table from "@/components/Table";
import TableSearch from "@/components/TableSearch";
import PageHero from "@/components/PageHero";
import prisma from "@/lib/prisma";
import { Admin, Prisma } from "@/generated/prisma/client";
import Image from "next/image";
import { resolvePageSize } from "@/lib/settings";
import { requireRole } from "@/lib/auth";
import { routeAccessMap } from "@/lib/settings";
import { getTranslations } from "next-intl/server";

// Admin-only directory: this is where "Add Admin" now lives, replacing the
// unlabeled + icon that used to sit on the admin dashboard banner. The
// Admin Prisma model only stores id + username (see schema.prisma), so this
// page is intentionally leaner than Teachers/Students/Parents - no photo,
// email, or class columns to show.
const AdminListPage = async ({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) => {
  const { userId, role } = requireRole(routeAccessMap["/dashboard/list/admins(.*)"]);
  const t = await getTranslations("List.admins");

  const columns = [
    {
      header: t("columns.info"),
      accessor: "info",
    },
    {
      header: t("columns.actions"),
      accessor: "action",
    },
  ];

  const renderRow = (item: Admin) => (
    <tr
      key={item.id}
      className="border-b border-gray-200 dark:border-slate-800 even:bg-slate-50 dark:even:bg-slate-900/40 text-sm hover:bg-lamaPurpleLight dark:hover:bg-blue-950/40"
    >
      <td className="flex items-center gap-4 p-4">
        <Image
          src="/Alan.png"
          alt=""
          width={40}
          height={40}
          className="w-10 h-10 rounded-full object-cover"
        />
        <div className="flex flex-col">
          <h3 className="font-semibold">{item.username}</h3>
          {item.id === userId && (
            <p className="text-xs text-gray-500 dark:text-slate-400">{t("you")}</p>
          )}
        </div>
      </td>
      <td>
        <div className="flex items-center gap-2">
          <FormContainer table="admin" type="update" data={item} />
          {item.id !== userId && (
            <FormContainer table="admin" type="delete" id={item.id} />
          )}
        </div>
      </td>
    </tr>
  );

  const { page, pageSize, ...queryParams } = searchParams;
  const p = page ? parseInt(page) : 1;
  const size = resolvePageSize(pageSize);

  const query: Prisma.AdminWhereInput = {};
  if (queryParams?.search) {
    query.username = { contains: queryParams.search, mode: "insensitive" };
  }

  const [data, count] = await prisma.$transaction([
    prisma.admin.findMany({
      where: query,
      take: size,
      skip: size * (p - 1),
      orderBy: { username: "asc" },
    }),
    prisma.admin.count({ where: query }),
  ]);

  return (
    <div className="panel-card p-4 md:p-5 rounded-md flex-1 m-4 mt-0 list-page-shell">
      <PageHero
        title={t("title")}
        subtitle={t("subtitle")}
        emoji={t("emoji")}
        stats={[{ label: t("totalLabel"), value: count }]}
      />
      {/* TOP */}
      <div className="flex items-center justify-between">
        <h1 className="hidden md:block text-lg font-semibold text-blue-900">{t("heading")}</h1>
        <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
          <TableSearch />
          <div className="flex items-center gap-4 self-end">
            <FormContainer table="admin" type="create" />
          </div>
        </div>
      </div>
      {/* LIST */}
      <Table columns={columns} renderRow={renderRow} data={data} />
      {/* PAGINATION */}
      <Pagination page={p} count={count} pageSize={size} />
    </div>
  );
};

export default AdminListPage;
