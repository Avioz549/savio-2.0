# Verification record

Validated in this cloud workspace on 4 November 2026 with Node 24 / npm 11:

- Clean locked install: `npm ci` completed successfully.
- `npm run lint`: Next.js ESLint checks passed with zero warnings.
- `npm run typecheck`: passed.
- `npm test`: 18 executed unit/regression tests passed, covering calculation precision, overnight payroll, configurable overtime, recurring month-end dates, goal projections, CSV injection escaping, duplicate IDs, legacy conversion, configuration URLs and long-running timers.
- `npm run test:db`: passed against disposable PostgreSQL 17. Applied the uploaded source schema and applied the additive upgrade twice. Checked actual role-based isolation, cross-user writes/foreign ownership, revision conflicts, independent database rate limits, self-deletion and cascading deletion. Supabase Auth's role/claim plumbing was emulated locally for this test.
- `npm run build`: production compilation and Next.js route generation passed.
- `npm run test:e2e`: all 11 executed Chromium workflows passed. They cover transactions/persistence, editing/deleting, CSV export, overnight payroll, savings contributions, budgets, timers, Hebrew RTL, themes, reminder CRUD, navigation, unavailable auth states, data recovery, cross-tab conflicts, cross-origin mutation rejection and PWA assets. See `tests/browser/app.spec.ts` and Playwright output for current counts.
- `npm audit --omit=dev --audit-level=moderate`: zero known production dependency vulnerabilities reported.

## Not verified against external services

No usable Supabase project URL or anon key was configured in this machine. `savio.com` was supplied as a possible domain, but has not been identified as a custom Supabase API endpoint. No key was requested in chat or written to source. Live hosted registration/email verification, password recovery, refreshed sessions, cloud save/import/deletion and hosted RLS tests remain pending real Supabase configuration. AI provider requests require an optional server key and remain unverified. No Vercel deployment, DNS change, hosted smoke test, production monitoring or independent security audit was performed.

Foreground browser reminders are implemented; scheduled background push delivery is not. Payroll estimates are configurable per shift/workplace and do not claim full Israeli statutory, weekly overtime or net salary calculation. See deployment and source-audit documents for scope and migration assumptions.
