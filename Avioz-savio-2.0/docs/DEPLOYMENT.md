# Vercel deployment and verification

## Configuration

1. Import this repository into Vercel using the repository root, Node 24, Next.js, `npm ci`, and `npm run build` (also declared in `vercel.json`).
2. Create/select the Supabase project. Use its **Project URL** from Settings → API. An application domain such as `savio.com` is not automatically a Supabase API URL; use it only if it is actually configured as Supabase's custom API domain.
3. Apply `supabase/schema.sql` in the project's SQL editor. It is additive and safe to reapply. New installations need only this file. If migrating the uploaded app, leave its existing normalized tables in place, then use Settings → Preview source import after signing in. Do not rerun `legacy-schema.sql` over an existing installation; it is the preserved input schema, not the new installation script.
4. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for Preview and Production deployments. The public anon key is intended for browser use under RLS. Never substitute a service-role key. The app no longer requires a service-role key for account deletion.
5. Optional AI: set `SAVIO_AI_KEY` and `SAVIO_AI_MODEL` on the server. Existing `OPENAI_API_KEY` / `OPENAI_MODEL` names from the uploaded source are also accepted. Keep keys out of `NEXT_PUBLIC_*`. If both names exist, SAVIO-prefixed names take precedence. This managed environment can use a personal proxy secret named `SAVIO_AI_KEY`; Vercel uses its own secure environment-variable storage.
6. Configure Supabase Auth's Site URL to the deployed app origin and allow the exact `/auth/callback` URL. The callback handles registration and recovery. Legacy `/auth/reset?code=...` links are forwarded through the callback. Configure the exact production domain and controlled development/preview origins; avoid broad production wildcard redirects.
7. Enable email confirmation, configure SMTP and Auth rate limits, and enable CAPTCHA/abuse controls supported by your Supabase plan. Configure database backups and monitoring.
8. For this cloud development environment, allow the exact Supabase project API hostname. AI requires `api.openai.com`. Vercel outbound access is configured separately.
9. Rebuild/redeploy after changing public Supabase variables; Next.js embeds them at build time. Add `savio.com` in Vercel Domains and follow Vercel's DNS instructions only if you own that domain. No DNS or deployment changes have been made by this task.

## Verification on the actual deployment

Use two disposable accounts, not real customer finances:

- Register each account, follow verification email and sign in. Check expired/reused email links show an error. Password recovery must exchange the code, update the password, and allow login with the new password.
- Refresh and reopen a session. Verify sign out removes account access and a second account cannot read or mutate the first user's records through the Supabase API.
- Add/edit/delete a transaction, recurrence, workplace, overnight shift, contribution, goal, budget and reminder. Refresh and verify stored values and computed totals. Open two tabs/devices and verify stale cloud saves return a conflict rather than overwriting newer data.
- Import an existing installation only after exporting its data. Review the migration warnings: historical shift premiums were not stored, recurring templates lacked start dates, and planned monthly contributions were not persisted. Compare imported counts and totals; original source tables remain intact.
- Verify no personal records are included in AI requests without consent. Without a key, unavailable state and local insights must remain functional. With a key, test a consented request and confirm provider failures never modify financial records.
- Check data export, full financial-data deletion and account deletion. Verify all user-owned rows cascade, including any original source tables.
- Verify mobile Hebrew RTL, English LTR, keyboard access, light/dark mode and browser-supported PWA installation. Reminder notifications require permission and an open app; background push scheduling is not implemented.
- Confirm HTTPS, security headers, redacted application logs, monitoring, recovery procedures, privacy notices and payroll assumptions before accepting real users.

## Commands

`npm run lint`, `npm run typecheck`, `npm test`, `npm run test:db`, `npm run build`, and `npm run test:e2e` cover the repository's automated checks. The PostgreSQL test creates an isolated disposable Docker container with no published ports and synthetic users; it never accesses a production database. Chromium tests require the built app and a local Chromium installation or Playwright's installed browser.
