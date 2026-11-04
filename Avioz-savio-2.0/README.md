# SAVIO 2.0

See [the source audit](docs/SOURCE-AUDIT.md) for the ZIP analysis and fixes, and [deployment instructions](docs/DEPLOYMENT.md) for Vercel and hosted-service verification.

A Next.js / TypeScript personal finance application with an English and Hebrew RTL interface, emerald/charcoal design, light mode, Recharts analytics, and a private local workspace. The original `index.html` is preserved; Next.js serves the application from `app/`.

## Develop

Node 24 and npm 11 are validated in this environment.

```sh
npm ci
npm run dev
```

Use the existing `/workspace/Avioz` checkout. Cloud tasks are already isolated; no additional worktree is needed. Webpack mode is deliberate: this cloud sandbox prevents Turbopack from binding its PostCSS helper socket.

```sh
npm test             # financial calculation and validation tests
npm run typecheck
npm run lint
npm run test:db     # real PostgreSQL security checks in disposable Docker
npm run build
npm run start
npm run test:e2e     # Chromium functional checks against the production build
```

The browser tests use `/usr/bin/chromium` in this environment. For other machines, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` or install Playwright's Chromium and omit the executable override. Browser tests create isolated test records; no demo balances appear in the application.

## Cloud authentication and storage

Local workflows operate without credentials. Local data stays in browser storage, is not encrypted at rest, and is separate from signed-in account data. Export JSON before clearing browser data or switching devices. No silent local-data upload occurs on login.

1. Create a Supabase project and run `supabase/schema.sql` in its SQL editor.
2. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in the environment or an ignored `.env.local`. Both are public client configuration. Never put a service-role key in a `NEXT_PUBLIC_` variable.
3. Enable email confirmation in Supabase Auth. Configure the site URL and allow `/auth/callback` redirects for development and your production Vercel domain. Configure an SMTP provider for production email delivery, CAPTCHA/abuse controls, and Supabase Auth rate limits for signup, password login and recovery.
4. Account deletion uses the authenticated `delete_my_account` SQL function. No service-role key is required by the application. Deletion cascades to financial data and rate-limit rows.
5. Allow your exact Supabase project hostname through the environment's network settings. The hostname cannot be determined until a project URL is supplied.

Financial data is stored as one user-owned JSON aggregate in PostgreSQL. Owner RLS policies protect every operation; unauthenticated access is revoked. Server writes validate the complete aggregate with Zod; database checks constrain shape and size. Auth sessions use Supabase SSR cookies and refresh through `proxy.ts`. Account deletion is a narrowly scoped SQL function that can delete only the current authenticated user. Cloud reads/writes, email delivery, account deletion and two-user RLS isolation require a real configured project and have not yet been validated here.

Before production, verify registration/confirmation, login/logout, recovery, refresh persistence, data deletion and account deletion with two disposable accounts. Confirm account B cannot select or mutate A's `finance_data` by calling Supabase directly. Financial aggregate writes use revision checks; stale writes return HTTP 409. Local tabs also reject overwrites when the browser snapshot changed. Reload before retrying a conflict.

## Financial behavior

- Monthly totals include dated records and virtual monthly recurring occurrences, clamped to the month's final day. Edit/delete on a recurring record affects the entire series from its original date.
- Available balance means recorded income minus expenses. It is not a connected bank balance. Currency preferences change display units only; no foreign-exchange conversion occurs.
- Payroll is a gross estimate before deductions. Regular-hours thresholds, overtime tiers, and weekend/holiday multipliers are configurable per workplace. Premiums apply only when selected on a shift, multiplying the entire estimated gross. Rules apply per shift; weekly overtime, holiday calendars, statutory rest, pensions, tax and net-pay calculations are not implemented. Imported legacy shifts retain their original stored estimates until edited, because their premium selections were never saved. Set the correct contractual rules; do not treat defaults as Israeli legal advice.
- Overnight shifts use explicit start/end dates; unpaid breaks are subtracted before overtime. Timer shifts persist across reloads. Breaks and premiums can be edited after stopping.
- Savings plans use conservative (20%), balanced (35%), or accelerated (50%) shares of the selected month's positive surplus. Multiple goals share that allowance proportionally to their planned monthly contributions. Estimates recalculate on input changes and show required monthly funding toward the target date. Contributions record savings intent/activity; they do not move money or verify a bank balance.
- CSV exports escape formulas; full JSON exports contain personal data and should be stored privately.

## AI and privacy

`SAVIO_AI_KEY` is an optional server-only OpenAI key; `SAVIO_AI_MODEL` defaults to `gpt-4.1-mini`. Allow `api.openai.com` if AI is enabled. The AI endpoint requires a signed-in user, same-origin requests, validated input and a database-backed 15-second request limit. A financial summary is loaded only when the user opts in for that request. Consent resets after each request. Without a key, the service returns an unavailable state; deterministic local surplus and savings insights still work. Chat is not persisted.

Account deletion has a database-backed 60-second request limit. Supabase Auth provides authentication endpoint rate limits; configure production thresholds in Supabase.

## PWA and notifications

The manifest, app icon and service worker support a public offline fallback. Financial pages, API responses and authentication requests are never cached by the service worker. Installation availability depends on browser support; offline editing is not supported. Browser notifications can be enabled where supported. While SAVIO is open, it checks recorded payments and incomplete reminders due today once a minute and sends one generic reminder per account/day without financial details. Background push delivery and scheduled reminders when the app is closed are not implemented. The financial calendar displays actual recorded and recurring payments and supports creating, editing, completing and deleting reminders.

## Deployment

Deploy this repository to Vercel as a Next.js application with `npm run build`. Configure the same environment variables and Supabase redirect URLs for the production domain, then redeploy when public Supabase variables change. Apply the SQL before enabling cloud storage. Never commit `.env.local` or keys.

## Validation scope

The local development workflow, production compilation and Chromium interactions can be checked without a remote database. Cloud authentication, email delivery, RLS isolation, AI provider calls and account deletion remain deployment prerequisites until credentials and project access are configured. Do not label those integrations production-verified based on the local tests.
