# Duty Roster + Notifications

Teachers get a reminder before (default 10 min) and at the start of each duty.
Source schedule: `School_Duty_Schedule_EN.pdf` (3 floors, Mon-Fri, blocks 1-2 / 3-4, 9 time slots,
two teachers in the 16:00-17:30 slot on floor 2) = 270 slots, 280 assignments, 78 names.

## Where things are

| What | Where |
| --- | --- |
| Tables | `prisma/schema.prisma` (`Duty*` models), migration `prisma/migrations/20261013000000_add_duty_roster`, idempotent bootstrap `src/lib/dutyDdl.ts` (same pattern as the hall pass: tables are created on first use, `prisma migrate deploy` is also safe) |
| Logic | `src/lib/duty.ts` (server), `src/lib/dutyShared.ts` (pure helpers), `src/lib/dutyActions.ts` (server actions, admin-checked) |
| Scheduler endpoint | `src/app/api/cron/duty-reminders/route.ts` |
| Admin page (admin only) | `/dashboard/list/duty-roster` |
| Teacher page | `/dashboard/list/my-duties` (admin + teacher) |
| In-app bell | `src/app/api/notifications/route.ts` + `NotificationBell.tsx` ("Duty reminders" section) |
| Push | existing `lib/push.ts` + `public/sw.js` + the bell button in the top bar |
| PWA | `src/app/manifest.ts`, `public/icon-192.png`, `public/icon-512.png` |
| Scheduler trigger | `.github/workflows/duty-reminders.yml` |
| Seed | `src/lib/dutySeed.json` (built by `scripts/build_duty_seed.py` from `scripts/duty_source.txt`) |

## Environment variables

Already used by the app (no change): `DATABASE_URL`, `DIRECT_DATABASE_URL`, Clerk keys,
`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `RESEND_API_KEY`, `EMAIL_FROM`.

New:

| Where | Name | Value |
| --- | --- | --- |
| Vercel (Production) | `CRON_SECRET` | long random string, e.g. `openssl rand -hex 32` |
| GitHub repo secrets | `CRON_SECRET` | the same value |
| GitHub repo secrets | `DUTY_APP_URL` | production URL without trailing slash |

Lead time, time zone (default `Asia/Almaty`), reminder-at-start and days off are set in the admin page
(Duty Roster -> Settings & days off). If `CRON_SECRET` is not set the endpoint refuses every request.

## First-time setup (after deploy)

1. Add the env var and GitHub secrets above, then redeploy once so Vercel picks up `CRON_SECRET`.
2. Sign in as admin -> **Duty Roster** -> Import -> **Load built-in schedule (replace roster)**.
3. Teachers & accounts -> **Auto-link by name**, then link the rest by hand. Review the
   "Possible duplicate names" panel and merge names that are the same person.
4. Each teacher opens **My Duties**, ticks the channels they want and taps the bell button to allow browser notifications
   (phones: install the app first - Android "Install app", iPhone Share -> Add to Home Screen).
5. GitHub -> Actions -> "Duty reminders" -> Run workflow once and confirm it returns `{"ok":true,...}`.

## Behaviour

* Every scheduler tick (every 5 minutes, 03:00-12:59 UTC Mon-Fri) finds duties starting soon on the **school clock**.
  "Lead" is due from `start - lead` until the start; "start" from the start until 10 min later (so a late run still delivers).
* The log row `(assignment, date, kind)` is unique and is written **before** sending, so overlapping or repeated runs never double-send.
* Skipped: weekends, admin-marked days off, teachers with no linked account (counted as `unlinked` in the response),
  duty reminders switched off.
* Two teachers in a slot: each gets their own reminder that also says who they are on duty with.
* Dead push subscriptions (HTTP 404/410) are deleted automatically by `lib/push.ts`.
* Message: `Duty: Floor 2, Block 3-4, 11:10–11:55 (starts in 10 min)`.

## Security

* Admin pages/APIs: middleware route map **and** a server-side admin check in every server action.
* Teachers can only change their own preferences, read their own bell rows and manage their own push subscription.
* `/api/cron/duty-reminders` is public to Clerk but requires `Authorization: Bearer $CRON_SECRET` (constant-time compare).
  Only that one cron route is opened up in `middleware.ts`.

## Test plan

1. **Test button**: Duty Roster -> "Send test notification now" -> expect a toast, a bell entry and (if subscribed) a push.
2. **Roster**: load the built-in schedule; open each floor/day and compare with the PDF; change a teacher, reload, confirm it stuck.
3. **Import**: upload a 2-row CSV with `merge`; a bad row (floor 4) must reject the whole file with a clear message.
4. **Linking**: Auto-link, then link one by hand; a second name cannot take an already linked account.
5. **My Duties**: as a linked teacher confirm Today / This week match the roster; an unlinked account sees the "ask an administrator" message.
6. **Endpoint auth**: `curl -i https://<app>/api/cron/duty-reminders` -> 401; with the correct Bearer token -> 200 JSON.
7. **Real reminder**: in Settings set lead time to e.g. 3 and give yourself a duty starting ~5 minutes from now; wait for
   the next workflow run; expect exactly one "lead" and one "start" notification. Re-running the workflow must send nothing more.
8. **Days off**: add today as a day off, re-run the workflow -> response shows `"skipped":"day-off"`.
9. **Opt-out**: untick push and in-app in My Duties -> no push / no bell entry for the next reminder.
10. **Expired subscription**: clear site data in a subscribed browser, trigger a test -> the dead subscription is removed.
