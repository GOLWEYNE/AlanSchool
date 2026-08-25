import prisma from "@/lib/prisma";
import { TERM_LABELS } from "@/lib/reportCardPdf";
import Link from "next/link";

// Read-only "download your report card" panel, reused on both the
// student dashboard (single student) and the parent dashboard (one
// instance per child).
const ReportCardsPanel = async ({
  studentId,
  studentName,
}: {
  studentId: string;
  studentName?: string;
}) => {
  const reportCards = await prisma.reportCard.findMany({
    where: { studentId },
    orderBy: [{ schoolYear: "desc" }, { generatedAt: "desc" }],
    take: 10,
  });

  return (
    <div className="panel-card p-4 rounded-md shine-hover">
      <div className="flex items-center gap-2 mb-3">
        <div className="text-2xl">🧾</div>
        <h3 className="text-lg font-bold text-gray-800 dark:text-blue-100">
          Report Cards{studentName ? ` — ${studentName}` : ""}
        </h3>
      </div>

      {reportCards.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-slate-400">
          No report cards have been generated yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {reportCards.map((card) => (
            <li
              key={card.id}
              className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/40 rounded-md px-3 py-2 text-sm"
            >
              <span className="font-medium text-gray-700 dark:text-slate-200">
                {TERM_LABELS[card.term] ?? card.term} · {card.schoolYear}
              </span>
              <Link
                href={card.pdfUrl ?? `/api/report-cards/${card.id}/pdf`}
                target="_blank"
                className="text-blue-600 dark:text-blue-300 font-semibold hover:underline"
              >
                Download PDF
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ReportCardsPanel;
