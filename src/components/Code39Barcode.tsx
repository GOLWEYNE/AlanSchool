import { code39Runs, sanitizeForBadge } from "@/lib/barcode39";
import { useTranslations } from "next-intl";

// Renders a Code 39 barcode as inline SVG - crisp at any print resolution,
// no canvas/image round trip needed. `value` is sanitized again here
// defensively so a caller can never accidentally hand it raw text.
const Code39Barcode = ({
  value,
  moduleWidth = 2,
  height = 56,
  quietZone = 10,
  className,
}: {
  value: string;
  moduleWidth?: number;
  height?: number;
  quietZone?: number;
  className?: string;
}) => {
  const t = useTranslations("Common");
  const safeValue = sanitizeForBadge(value);
  const runs = code39Runs(safeValue);

  let cursor = quietZone * moduleWidth;
  const bars: { x: number; width: number }[] = [];
  for (const run of runs) {
    const width = run.width * moduleWidth;
    if (run.black) bars.push({ x: cursor, width });
    cursor += width;
  }
  const totalWidth = cursor + quietZone * moduleWidth;

  return (
    <svg
      viewBox={`0 0 ${totalWidth} ${height}`}
      width={totalWidth}
      height={height}
      className={className}
      role="img"
      aria-label={t("barcodeLabel", { value: safeValue })}
    >
      <rect x={0} y={0} width={totalWidth} height={height} fill="white" />
      {bars.map((bar, i) => (
        <rect key={i} x={bar.x} y={0} width={bar.width} height={height} fill="black" />
      ))}
    </svg>
  );
};

export default Code39Barcode;
