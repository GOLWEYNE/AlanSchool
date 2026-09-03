"use client";

import { Download, Printer, Share2 } from "lucide-react";
import { toast } from "react-toastify";

const ReportCardActions = ({ pdfHref }: { pdfHref: string }) => {
  const handleShare = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.clipboard && url) {
        await navigator.clipboard.writeText(url);
        toast("Link copied — share it with the parent.");
      } else {
        toast("Copy the page link from your browser's address bar to share it.");
      }
    } catch {
      toast("Copy the page link from your browser's address bar to share it.");
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
        Share with Parent
      </button>
      <button
        type="button"
        onClick={() => window.print()}
        className="toolbar-chip inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold"
      >
        <Printer size={14} />
        Print
      </button>
      <a
        href={pdfHref}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 text-xs font-semibold shadow-md shadow-blue-600/25 transition-colors"
      >
        <Download size={14} />
        Download Official PDF
      </a>
    </div>
  );
};

export default ReportCardActions;
