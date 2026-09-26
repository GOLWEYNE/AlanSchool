// Labels for the Class Locator field (kept here so no locale file needs to change).
const LABELS = {
  en: { field: "Class Locator (room number)", column: "Class Locator", floor: "Floor" },
  ru: { field: "Локатор класса (номер кабинета)", column: "Локатор класса", floor: "Этаж" },
  kk: { field: "Сынып орны (кабинет нөмірі)", column: "Сынып орны", floor: "Қабат" },
} as const;

export const classLocatorLabels = (locale: string) =>
  LABELS[(locale as keyof typeof LABELS) in LABELS ? (locale as keyof typeof LABELS) : "en"];
