import { z } from "zod";
import { dataSchema, emptyData, type FinanceData } from "./finance";
const row = z.record(z.string(), z.unknown());
export const legacyTables = [
  "transactions",
  "workplaces",
  "shifts",
  "goals",
  "contributions",
  "budgets",
  "recurring_transactions",
  "reminders",
  "profiles",
] as const;
export type LegacyTables = Record<(typeof legacyTables)[number], unknown[]>;
const number = (v: unknown) => Number(v);
const text = (v: unknown) => String(v ?? "");
// Explicit one-time conversion. Original normalized tables are never modified.
export function convertLegacy(
  tables: LegacyTables,
  asOf: string,
): { data: FinanceData; warnings: string[] } {
  const rows = Object.fromEntries(
    legacyTables.map((t) => [t, z.array(row).parse(tables[t])]),
  ) as Record<(typeof legacyTables)[number], Record<string, unknown>[]>;
  const data = emptyData(),
    warnings: string[] = [];
  data.transactions = rows.transactions.map((t) => ({
    id: text(t.id),
    title: text(t.note) || text(t.category) || "Transaction",
    amount: number(t.amount),
    kind: t.kind as "income",
    category: text(t.category) || "Other",
    date: text(t.occurred_on),
    recurring: false,
  }));
  for (const t of rows.recurring_transactions) {
    if (!t.active) continue;
    const month = asOf.slice(0, 7);
    const [y, m] = month.split("-").map(Number);
    const day = Math.min(number(t.day_of_month), new Date(y, m, 0).getDate());
    data.transactions.push({
      id: text(t.id),
      title: text(t.description) || text(t.category),
      amount: number(t.amount),
      kind: t.kind as "income",
      category: text(t.category),
      date: `${month}-${String(day).padStart(2, "0")}`,
      recurring: true,
    });
  }
  if (rows.recurring_transactions.length)
    warnings.push(
      "Legacy recurring schedules have no start date. Active schedules begin in the import month; review them for duplicates against manually recorded payments. Inactive schedules remain in the original tables.",
    );
  data.workplaces = rows.workplaces.map((w) => ({
    id: text(w.id),
    name: text(w.name),
    wage: number(w.hourly_rate),
    regularHours: number(w.overtime_after_hours),
    overtimeHours: 24,
    overtimeRate: number(w.overtime_multiplier),
    extraRate: number(w.overtime_multiplier),
    premiumRate: number(w.weekend_multiplier),
  }));
  data.shifts = rows.shifts.map((s) => ({
    id: text(s.id),
    workplaceId: text(s.workplace_id),
    start: text(s.started_at),
    end: text(s.ended_at),
    breakMinutes: number(s.unpaid_break_minutes),
    paidBreak: false,
    premium: false,
    legacyGross: number(s.gross_estimate),
  }));
  if (data.shifts.length)
    warnings.push(
      "Imported shifts retain their stored gross estimates because the source did not record premium selection. Editing a shift replaces that estimate with the configured payroll calculation.",
    );
  data.goals = rows.goals.map((g) => ({
    id: text(g.id),
    name: text(g.title),
    target: number(g.target_amount),
    existing: number(g.starting_savings),
    monthly: 0,
    date: g.target_date ? text(g.target_date) : null,
    contributions: rows.contributions
      .filter((c) => c.goal_id === g.id)
      .map((c) => ({
        id: text(c.id),
        amount: number(c.amount),
        date: text(c.contributed_on),
      })),
  }));
  if (data.goals.length)
    warnings.push(
      "The source stored no monthly plan per goal. Set each goal’s planned contribution to calculate a completion date.",
    );
  data.budgets = Object.fromEntries(
    rows.budgets.map((b) => [
      "default:" + text(b.category),
      number(b.monthly_limit),
    ]),
  );
  data.reminders = rows.reminders.map((r) => ({
    id: text(r.id),
    title: text(r.title),
    date: text(r.due_on),
    done: Boolean(r.done),
  }));
  const p = rows.profiles[0];
  if (p)
    data.profile = {
      name: text(p.display_name),
      language: p.locale as "en",
      currency: p.currency as "ILS",
      theme: "dark",
    };
  return { data: dataSchema.parse(data), warnings };
}
