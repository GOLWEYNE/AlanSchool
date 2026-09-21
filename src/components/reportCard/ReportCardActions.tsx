"use client";

import { Download, Printer, Share2 } from "lucide-react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";

const ReportCardActions = ({ pdfHref }: { pdfHref: string }) => {
  const t = useTranslations("ReportCards.actions");
  const handleShare = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.clipboard && url) {
        await navigator.clipboard.writeText(url);
        toast(t("linkCopied"));
      } else {
        toast(t("copyManually"));
      }
    } catch {
      toast(t("copyManually"));
    }
  };

  return (
    <div className="print:hidden sticky top-2 z-20 flex flex-wrap justify-end gap-2 mb-4">
      <button
        type="button"
        onClick={handleShare}
        className="toolbar-chip inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold"
      >
        <Share2 size={14} />
        {t("share")}
      </button>
      <button
        type="button"
        onClick={() => window.print()}
        className="toolbar-chip inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold"
      >
        <Printer size={14} />
        {t("print")}
      </button>
      <a
        href={pdfHref}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 text-xs font-semibold shadow-md shadow-blue-600/25 transition-colors"
      >
        <Download size={14} />
        {t("downloadPdf")}
      </a>
    </div>
  );
};

export default ReportCardActions;
