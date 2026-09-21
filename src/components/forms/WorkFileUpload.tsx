"use client";

import { useState } from "react";
import { CldUploadWidget } from "next-cloudinary";
import { UploadCloud, FileText, CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";

// Lets a teacher/admin attach the exam or assignment paper itself (a PDF
// students can read in-browser, or a Word doc they download, fill in, and
// re-upload later as their submission). Mirrors the upload pattern already
// used for the featured-video broadcast, just pointed at document formats.
const WorkFileUpload = ({
  defaultFileUrl,
  defaultFileName,
  onChange,
}: {
  defaultFileUrl?: string | null;
  defaultFileName?: string | null;
  onChange: (fileUrl: string, fileName: string) => void;
}) => {
  const t = useTranslations("Assessments.work");
  const [fileName, setFileName] = useState<string | null>(defaultFileName ?? null);
  const [fileUrl, setFileUrl] = useState<string | null>(defaultFileUrl ?? null);

  return (
    <div className="flex flex-col gap-2 w-full">
      <label className="text-xs text-gray-500 dark:text-slate-400">
        {t("paperLabel")}
      </label>
      <CldUploadWidget
        uploadPreset="school"
        options={{
          resourceType: "auto",
          sources: ["local"],
          clientAllowedFormats: ["pdf", "doc", "docx"],
          maxFileSize: 20971520,
        }}
        onSuccess={(result, { widget }) => {
          const info = result?.info as
            | { secure_url?: string; original_filename?: string; format?: string }
            | undefined;
          if (info?.secure_url) {
            const name = info.original_filename
              ? `${info.original_filename}${info.format ? "." + info.format : ""}`
              : "file";
            setFileUrl(info.secure_url);
            setFileName(name);
            onChange(info.secure_url, name);
          }
          widget.close();
        }}
      >
        {({ open }) => (
          <div
            onClick={() => open()}
            className="flex items-center gap-3 cursor-pointer rounded-lg border-2 border-dashed border-gray-300 dark:border-slate-700 p-3 hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-500/10 shrink-0">
              <UploadCloud size={16} className="text-blue-500" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-700 dark:text-slate-200">
                {fileName ? t("fileReady") : t("uploadPaper")}
              </p>
              <p className="text-xs text-gray-400 dark:text-slate-500 truncate">
                {fileName ?? t("fileHint")}
              </p>
            </div>
            {fileName && <CheckCircle2 size={16} className="text-green-500 ml-auto shrink-0" />}
          </div>
        )}
      </CldUploadWidget>
      {fileUrl && (
        <a
          href={fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-500 hover:underline flex items-center gap-1 w-fit"
        >
          <FileText size={12} /> {t("viewCurrent")}
        </a>
      )}
    </div>
  );
};

export default WorkFileUpload;
