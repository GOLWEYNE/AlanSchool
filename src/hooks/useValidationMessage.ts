"use client";

import { useTranslations } from "next-intl";

// The zod schemas live in shared modules with English message literals.
// Each literal maps to a key in the "Validation" namespace (its slug), so a
// form can show the message in the active language while the schemas - and
// their server-side use - stay unchanged.
export const validationKey = (message: string) =>
  message
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

export function useValidationMessage() {
  const t = useTranslations("Validation");

  return (message?: unknown): string | undefined => {
    if (typeof message !== "string" || !message) return undefined;
    const key = validationKey(message);
    return t.has(key) ? t(key) : message;
  };
}
