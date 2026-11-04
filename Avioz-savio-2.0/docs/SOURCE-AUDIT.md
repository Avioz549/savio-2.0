# SAVIO 2.0 source audit

Input: `SAVIO-2.0-source (1).zip`, extracted into an inspection directory without overwriting the published checkout. The archive contained a Next.js 15 app, nine normalized Supabase tables, separate authentication routes, a 25 KB dashboard component, and no lockfile or automated tests. Its README explicitly described missing product functionality; those statements were treated as reference material, not instructions to skip work.

The completed app integrates the uploaded project's functionality with the existing Next.js 16 SAVIO workspace. The original unrelated `index.html` remains unchanged. The uploaded SQL is retained as `supabase/legacy-schema.sql`; `supabase/schema.sql` supplies the additive upgrade. Legacy financial records are imported only after an authenticated preview and explicit confirmation. No source table is silently deleted or rewritten. New app writes use a validated, revisioned per-user snapshot. Retire the old app after migration to avoid two diverging data stores.

## Findings corrected

- Forms accessed React event `currentTarget` after asynchronous saves. Forms now capture input synchronously, validate before mutation, and close only after successful persistence.
- Timer completion discarded state after failed inserts and selected the first workplace. Timers now belong to an explicitly selected workplace and remain running if persistence fails.
- Stored estimates omitted premium selections and were not safely reconstructable. Imported shifts preserve their original gross values, with an import warning; editing explicitly recalculates them from recorded settings.
- The source owner trigger referenced `NEW.goal_id` on a shift row, causing valid inserts to fail. The additive SQL replaces it with separate record-type branches. This defect was reproduced and the correction verified in PostgreSQL 17.
- Partial query failures could render empty financial data. Cloud reads now fail explicitly without enabling editing; imports require complete, counted pagination for all nine source tables.
- Source password reset did not exchange PKCE recovery codes. Recovery now passes through the session callback before allowing a password update.
- Source authentication errors could escape handlers; async auth actions now have loading states and accessible errors, and unavailable configuration is explicit.
- AI used process-local request counters and accepted client-provided financial context. Rate limiting is now database-backed, and optional, month-specific aggregate context is loaded server-side only with per-request consent.
- CSV exports allowed spreadsheet formula injection. Exported cells now escape dangerous prefixes and CSV quotes.
- No real editing controls existed despite unused editing state. Transactions, shifts, workplaces, goals and reminders have working edit/delete controls; contribution records can be added/deleted.
- Concurrent whole-workspace writes could silently overwrite data. PostgreSQL revision checks and browser-local stale-tab checks reject stale saves.
- Long-running timers wrapped at 24 hours. Elapsed hours now continue above 24.
- Source calendar, recurrence handling, light mode, achievements and full export were missing. These are now implemented; recurrence uses virtual monthly occurrences rather than silently creating duplicate posted records.
- `lint` was merely a TypeScript command. The project now has strict Next.js ESLint checks, a separate typecheck, unit tests, real PostgreSQL security tests, Chromium workflow tests and CI configuration.

## External verification still required

Local database checks emulate Supabase's authenticated/anonymous roles and `auth.uid()` claim function. They verify SQL isolation and mutations, not hosted Supabase email delivery, token refresh, PKCE links across browsers or production service availability. A real project URL and public anon key are still needed for those checks. No real credentials are included. AI provider calls and Vercel/domain deployment must be verified after configuration.
