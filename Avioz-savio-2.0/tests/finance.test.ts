import { test } from "node:test";
import assert from "node:assert/strict";
import {
  shiftPay,
  monthTransactions,
  totals,
  goalSaved,
  savingsPlan,
  csvExport,
  dataSchema,
  emptyData,
  shiftSchema,
  type Workplace,
  type Shift,
  type Transaction,
  type Goal,
} from "../lib/finance";
const w: Workplace = {
  id: crypto.randomUUID(),
  name: "Cafe",
  wage: 50,
  regularHours: 8,
  overtimeHours: 2,
  overtimeRate: 1.25,
  extraRate: 1.5,
  premiumRate: 1.5,
};
const s: Shift = {
  id: crypto.randomUUID(),
  workplaceId: w.id,
  start: "2026-01-01T20:00:00Z",
  end: "2026-01-02T07:00:00Z",
  breakMinutes: 60,
  paidBreak: false,
  premium: false,
};
test("overnight shifts subtract unpaid breaks and calculate configurable overtime", () => {
  assert.deepEqual(shiftPay(s, w), { hours: 10, gross: 525 });
  assert.equal(shiftPay({ ...s, paidBreak: true }, w).gross, 600);
  assert.equal(shiftPay({ ...s, premium: true }, w).gross, 787.5);
});
test("custom regular-hours and overtime tiers affect estimates", () => {
  assert.equal(
    shiftPay(s, {
      ...w,
      regularHours: 6,
      overtimeHours: 1,
      overtimeRate: 2,
      extraRate: 3,
    }).gross,
    850,
  );
});
test("rejects reversed shifts, excessive breaks and invalid references", () => {
  assert.equal(
    shiftSchema.safeParse({ ...s, end: "2026-01-01T19:00:00Z" }).success,
    false,
  );
  assert.equal(
    shiftSchema.safeParse({ ...s, breakMinutes: 700 }).success,
    false,
  );
  assert.equal(
    dataSchema.safeParse({ ...emptyData(), shifts: [s] }).success,
    false,
  );
});
const tx: Transaction = {
  id: crypto.randomUUID(),
  title: "Rent",
  kind: "expense",
  category: "Housing",
  date: "2026-01-31",
  amount: 1000,
  recurring: true,
};
test("recurrences clamp month-end and never double count their original month", () => {
  assert.equal(monthTransactions([tx], "2026-02")[0].date, "2026-02-28");
  assert.equal(monthTransactions([tx], "2026-01").length, 1);
  assert.equal(monthTransactions([tx], "2025-12").length, 0);
  assert.equal(
    monthTransactions([{ ...tx, recurring: false }], "2026-02").length,
    0,
  );
});
test("totals derive only from records", () => {
  assert.deepEqual(
    totals([
      tx,
      { ...tx, id: crypto.randomUUID(), kind: "income", amount: 3000 },
    ]),
    { income: 3000, expenses: 1000, balance: 2000 },
  );
});
const g: Goal = {
  id: crypto.randomUUID(),
  name: "Trip",
  target: 10000,
  existing: 1000,
  monthly: 1000,
  date: "2027-01-01",
  contributions: [{ id: crypto.randomUUID(), date: "2026-01-01", amount: 500 }],
};
test("savings contributions, surplus limits and completion estimates", () => {
  assert.equal(goalSaved(g), 1500);
  assert.equal(savingsPlan(g, 2000, "conservative").monthly, 400);
  assert.equal(savingsPlan(g, 2000, "accelerated").monthly, 1000);
  assert.equal(savingsPlan(g, -1, "balanced").months, null);
  assert.equal(savingsPlan({ ...g, target: 1000 }, 0, "balanced").months, 0);
});
test("CSV escapes quotes and neutralizes spreadsheet formulas", () => {
  const csv = csvExport([{ ...tx, title: '=HYPERLINK("bad")' }]);
  assert.ok(csv.includes('"\'=HYPERLINK(""bad"")"'));
  assert.ok(csv.startsWith("\uFEFF"));
});
test("rejects negative amounts and multiple running shifts", () => {
  assert.equal(
    dataSchema.safeParse({
      ...emptyData(),
      transactions: [{ ...tx, amount: -1 }],
    }).success,
    false,
  );
  assert.equal(
    dataSchema.safeParse({
      ...emptyData(),
      workplaces: [w],
      shifts: [
        { ...s, end: null },
        { ...s, id: crypto.randomUUID(), end: null },
      ],
    }).success,
    false,
  );
});

test("money totals avoid floating-point residue", () => {
  assert.deepEqual(
    totals([
      { ...tx, amount: 0.1, kind: "income" },
      { ...tx, amount: 0.2, kind: "income" },
    ]),
    { income: 0.3, expenses: 0, balance: 0.3 },
  );
});
test("goal completion clamps to the end of short months", () => {
  assert.equal(
    savingsPlan(
      { ...g, target: 2000 },
      10000,
      "balanced",
      new Date("2026-01-31T12:00:00Z"),
    ).completion,
    "2026-02-28",
  );
});

test("duplicate record IDs are rejected", () => {
  assert.equal(
    dataSchema.safeParse({ ...emptyData(), transactions: [tx, tx] }).success,
    false,
  );
});
