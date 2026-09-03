import {
  Calculator,
  BookOpen,
  FlaskConical,
  Landmark,
  Palette,
  Music,
  Dumbbell,
  Laptop2,
  Globe2,
  Languages,
  Drama,
  Leaf,
  GraduationCap,
  type LucideIcon,
} from "lucide-react";

// Best-effort icon lookup by subject name so the results list feels
// hand-crafted without needing a per-subject config anywhere else in the
// app. Falls back to a generic cap icon for anything unrecognized —
// every subject in the school, current or future, gets a sensible icon.
const RULES: [RegExp, LucideIcon][] = [
  [/math/i, Calculator],
  [/(english|literature|reading|writing)/i, BookOpen],
  [/(science|biology|chemistry|physics)/i, FlaskConical],
  [/history/i, Landmark],
  [/(art|design)/i, Palette],
  [/music/i, Music],
  [/(pe|physical|sport|gym)/i, Dumbbell],
  [/(computer|ict|programming|coding)/i, Laptop2],
  [/geograph/i, Globe2],
  [/(kazakh|russian|language|foreign)/i, Languages],
  [/(drama|theatre|theater)/i, Drama],
  [/(biology|nature|environment)/i, Leaf],
];

export const getSubjectIcon = (subject: string): LucideIcon => {
  const match = RULES.find(([pattern]) => pattern.test(subject));
  return match ? match[1] : GraduationCap;
};
