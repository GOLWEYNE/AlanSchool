import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

// A tappable list cell for phones, like a row in the iOS Contacts app.
// The whole top part opens the record; action buttons (edit, delete, report
// card) sit in their own row below so a tap never hits the wrong thing.
// Deliberately NOT positioned and with no filter or overflow clipping: the
// edit and delete pop-ups open inside this card's parent and would be cut off.
export default function PersonCard({
  href,
  img,
  badge,
  title,
  subtitle,
  fields = [],
  actions,
}: {
  href?: string;
  img?: string | null;
  badge?: string;
  title: string;
  subtitle?: string | null;
  fields?: { label: string; value?: string | number | null }[];
  actions?: ReactNode;
}) {
  const shown = fields.filter((f) => f.value !== undefined && f.value !== null && f.value !== "");

  const body = (
    <>
      {badge ? (
        <span className="person-card__badge" aria-hidden="true">
          {badge}
        </span>
      ) : (
        <Image
          src={img || "/Alan.png"}
          alt=""
          width={52}
          height={52}
          className="h-[52px] w-[52px] shrink-0 rounded-full object-cover"
        />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-semibold text-blue-950 dark:text-blue-50">
          {title}
        </span>
        {subtitle && (
          <span className="block truncate text-sm text-blue-800/75 dark:text-blue-200/75">
            {subtitle}
          </span>
        )}
        {shown.length > 0 && (
          <span className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-blue-900/70 dark:text-blue-100/70">
            {shown.map((f) => (
              <span key={f.label} className="max-w-full truncate">
                <span className="font-semibold">{f.label}:</span> {f.value}
              </span>
            ))}
          </span>
        )}
      </span>
      {href && <ChevronRight size={20} className="shrink-0 text-blue-400" aria-hidden="true" />}
    </>
  );

  return (
    <div className="person-card">
      {href ? (
        <Link href={href} className="person-card__main">
          {body}
        </Link>
      ) : (
        <div className="person-card__main">{body}</div>
      )}
      {actions && <div className="person-card__actions">{actions}</div>}
    </div>
  );
}
