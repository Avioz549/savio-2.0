import { test } from "node:test";
import assert from "node:assert/strict";
import { convertLegacy, legacyTables, type LegacyTables } from "../lib/legacy";
import { shiftPay } from "../lib/finance";
const id = () => crypto.randomUUID();
function fixture() {
  const w = id(),
    g = id();
  const tables = Object.fromEntries(
    legacyTables.map((t) => [t, []]),
  ) as unknown as LegacyTables;
  tables.profiles = [{ display_name: "Dana", locale: "he", currency: "GBP" }];
  tables.transactions = [
    {
      id: id(),
      kind: "income",
      amount: "10000.50",
      category: "salary",
      note: "Salary",
      occurred_on: "2026-01-31",
    },
  ];
  tables.workplaces = [
    {
      id: w,
      name: "Cafe",
      hourly_rate: "50",
      overtime_after_hours: "8",
      overtime_multiplier: "1.25",
      weekend_multiplier: "1.5",
    },
  ];
  tables.shifts = [
    {
      id: id(),
      workplace_id: w,
      started_at: "2026-01-01T20:00:00Z",
      ended_at: "2026-01-02T06:00:00Z",
      unpaid_break_minutes: 30,
      gross_estimate: "760",
    },
  ];
  tables.goals = [
    {
      id: g,
      title: "Car",
      target_amount: "50000",
      starting_savings: "500",
      target_date: null,
    },
  ];
  tables.contributions = [
    { id: id(), goal_id: g, amount: "100", contributed_on: "2026-01-01" },
  ];
  tables.budgets = [{ category: "food", monthly_limit: "800" }];
  tables.reminders = [
    { id: id(), title: "Rent", due_on: "2026-02-01", done: false },
  ];
  return tables;
}
test("legacy conversion preserves real amounts, GBP, reminders and undated goals", () => {
  const { data, warnings } = convertLegacy(fixture(), "2026-02-01");
  assert.equal(data.transactions[0].amount, 10000.5);
  assert.equal(data.profile.currency, "GBP");
  assert.equal(data.profile.language, "he");
  assert.equal(data.goals[0].date, null);
  assert.equal(data.goals[0].monthly, 0);
  assert.equal(data.goals[0].contributions[0].amount, 100);
  assert.equal(data.budgets["default:food"], 800);
  assert.equal(data.reminders[0].title, "Rent");
  assert.equal(shiftPay(data.shifts[0], data.workplaces[0]).gross, 760);
  assert.equal(warnings.length, 2);
});
test("legacy recurring schedules start in import month, never invent history", () => {
  const tables = fixture();
  tables.recurring_transactions = [
    {
      id: id(),
      kind: "expense",
      amount: "300",
      category: "bills",
      description: "Internet",
      day_of_month: 28,
      active: true,
    },
    {
      id: id(),
      kind: "expense",
      amount: 100,
      category: "bills",
      description: "Inactive",
      day_of_month: 1,
      active: false,
    },
  ];
  const { data, warnings } = convertLegacy(tables, "2026-02-04");
  assert.equal(data.transactions.length, 2);
  assert.equal(data.transactions[1].date, "2026-02-28");
  assert.equal(data.transactions[1].recurring, true);
  assert.ok(warnings.some((w) => w.includes("duplicates")));
});
test("invalid or cross-linked source data aborts import rather than dropping rows", () => {
  const tables = fixture();
  tables.shifts = [{ ...(tables.shifts[0] as object), workplace_id: id() }];
  assert.throws(() => convertLegacy(tables, "2026-02-01"));
});
