# Report card (PDF)

The official report card is rendered on demand at `/api/report-cards/[id]/pdf` ("Classic Transcript" design:
school-yellow double frame, school mark, faint school photo, two A4 pages).

| Piece | Where |
| --- | --- |
| Layout | `src/lib/reportCardPdf.tsx` (`@react-pdf/renderer`, Noto Sans for Latin/Cyrillic/Kazakh) |
| Data | `src/lib/reportCardData.ts` (`loadReportCardPdfData` reads the DB, `compose` is pure) |
| Logo | `src/lib/reportCardAssets.ts` (inlined PNG) |
| School photo (optional) | drop a photo at `src/assets/school-photo.jpg` (or `.jpeg` / `.png`); it is shown faintly behind the page. No file = logo watermark only |
| IELTS / SAT mock scores | table `MockTestScore` (`prisma/schema.prisma`), created on first use by `ensureMockTests()`; migration `20261015000000_add_mock_test_scores` is also safe to run |

What the report card shows: GPA (average score), attendance and breakdown, behavior (weekly +/− counts and a log),
weekly assignment / quiz / exam averages for the last 8 school weeks, subject results, club attendance
(sessions attended vs held) and IELTS / SAT mock scores per week. A "quiz" is an assignment with auto-graded
questions, matching the Quizzes page.

`MockTestScore` rows: `kind` is `IELTS` (overall band 0-9) or `SAT` (total 400-1600); `sections` is optional JSON,
e.g. IELTS `{"listening":7,"reading":6.5,"writing":6,"speaking":6.5}`, SAT `{"readingWriting":590,"math":620}`.
