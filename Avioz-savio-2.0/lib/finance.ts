import { z } from "zod";
export const transactionSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(1).max(120),
  amount: z.number().positive().max(1e9),
  kind: z.enum(["income", "expense"]),
  category: z.string().min(1).max(60),
  date: z.iso.date(),
  recurring: z.boolean(),
});
export type Transaction = z.infer<typeof transactionSchema>;
export const workplaceSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(100),
  wage: z.number().min(0).max(100000),
  regularHours: z.number().min(0).max(24),
  overtimeHours: z.number().min(0).max(24),
  overtimeRate: z.number().min(1).max(5),
  extraRate: z.number().min(1).max(5),
  premiumRate: z.number().min(1).max(5),
});
export type Workplace = z.infer<typeof workplaceSchema>;
export const shiftSchema = z
  .object({
    id: z.uuid(),
    workplaceId: z.uuid(),
    start: z.iso.datetime({ offset: true }),
    end: z.iso.datetime({ offset: true }).nullable(),
    breakMinutes: z.number().min(0).max(1440),
    paidBreak: z.boolean(),
    premium: z.boolean(),
    legacyGross: z.number().min(0).max(1e9).optional(),
  })
  .refine(
    (s) => !s.end || new Date(s.end).getTime() > new Date(s.start).getTime(),
    "Shift end must be after start",
  )
  .refine(
    (s) =>
      !s.end ||
      s.breakMinutes <= (Date.parse(s.end) - Date.parse(s.start)) / 60000,
    "Break cannot exceed shift duration",
  );
export type Shift = z.infer<typeof shiftSchema>;
export const goalSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(100),
  target: z.number().positive().max(1e9),
  existing: z.number().min(0).max(1e9),
  monthly: z.number().min(0).max(1e9),
  date: z.iso.date().nullable(),
  contributions: z
    .array(
      z.object({
        id: z.uuid(),
        amount: z.number().positive().max(1e9),
        date: z.iso.date(),
      }),
    )
    .max(10000),
});
export type Goal = z.infer<typeof goalSchema>;
export const dataSchema = z
  .object({
    transactions: z.array(transactionSchema).max(10000),
    workplaces: z.array(workplaceSchema).max(100),
    shifts: z.array(shiftSchema).max(10000),
    goals: z.array(goalSchema).max(100),
    budgets: z.record(z.string(), z.number().min(0).max(1e9)),
    reminders: z
      .array(
        z.object({
          id: z.uuid(),
          title: z.string().trim().min(1).max(120),
          date: z.iso.date(),
          done: z.boolean(),
        }),
      )
      .max(1000)
      .default([]),
    profile: z.object({
      name: z.string().max(100),
      currency: z.enum(["ILS", "USD", "EUR", "GBP"]),
      language: z.enum(["en", "he"]),
      theme: z.enum(["dark", "light"]),
    }),
  })
  .refine(
    (d) =>
      d.shifts.every((s) => d.workplaces.some((w) => w.id === s.workplaceId)),
    "Shift must reference an existing workplace",
  )
  .refine(
    (d) => d.shifts.filter((s) => !s.end).length <= 1,
    "Only one running shift allowed",
  )
  .refine(
    (d) =>
      [
        d.transactions,
        d.workplaces,
        d.shifts,
        d.goals,
        d.reminders,
        ...d.goals.map((g) => g.contributions),
      ].every((rows) => new Set(rows.map((r) => r.id)).size === rows.length),
    "Record IDs must be unique",
  );
export type FinanceData = z.infer<typeof dataSchema>;
export function emptyData(): FinanceData {
  return {
    transactions: [],
    workplaces: [],
    shifts: [],
    goals: [],
    budgets: {},
    reminders: [],
    profile: { name: "", currency: "ILS", language: "en", theme: "dark" },
  };
}
export function shiftPay(shift: Shift, workplace: Workplace, now = new Date()) {
  const elapsed = Math.max(
    0,
    ((shift.end ? Date.parse(shift.end) : now.getTime()) -
      Date.parse(shift.start)) /
      3600000,
  );
  const hours = Math.max(
    0,
    elapsed - (shift.paidBreak ? 0 : shift.breakMinutes / 60),
  );
  const regular = Math.min(hours, workplace.regularHours);
  const overtime = Math.min(
    Math.max(0, hours - workplace.regularHours),
    workplace.overtimeHours,
  );
  const extra = Math.max(
    0,
    hours - workplace.regularHours - workplace.overtimeHours,
  );
  return {
    hours,
    gross:
      shift.legacyGross ??
      Math.round(
        (regular +
          overtime * workplace.overtimeRate +
          extra * workplace.extraRate) *
          workplace.wage *
          (shift.premium ? workplace.premiumRate : 1) *
          100,
      ) / 100,
  };
}
// Recurrences are projected virtually by month; no duplicate database inserts.
export function monthTransactions(
  transactions: Transaction[],
  month: string,
): Transaction[] {
  return transactions.flatMap((t) => {
    if (t.date.slice(0, 7) === month) return [t];
    if (!t.recurring || t.date.slice(0, 7) > month) return [];
    const [y, m] = month.split("-").map(Number);
    const day = Math.min(Number(t.date.slice(8)), new Date(y, m, 0).getDate());
    return [{ ...t, date: `${month}-${String(day).padStart(2, "0")}` }];
  });
}
export function totals(transactions: Transaction[]) {
  const income =
    transactions
      .filter((t) => t.kind === "income")
      .reduce((s, t) => s + Math.round(t.amount * 100), 0) / 100;
  const expenses =
    transactions
      .filter((t) => t.kind === "expense")
      .reduce((s, t) => s + Math.round(t.amount * 100), 0) / 100;
  return {
    income,
    expenses,
    balance: Math.round((income - expenses) * 100) / 100,
  };
}
export function goalSaved(g: Goal) {
  return (
    (Math.round(g.existing * 100) +
      g.contributions.reduce((s, c) => s + Math.round(c.amount * 100), 0)) /
    100
  );
}
export function savingsPlan(
  goal: Goal,
  surplus: number,
  mode: "conservative" | "balanced" | "accelerated",
  now = new Date(),
) {
  const factors = { conservative: 0.2, balanced: 0.35, accelerated: 0.5 };
  const monthly = Math.max(
    0,
    Math.min(goal.monthly, Math.max(0, surplus) * factors[mode]),
  );
  const remaining = Math.max(0, goal.target - goalSaved(goal));
  const months =
    remaining === 0 ? 0 : monthly > 0 ? Math.ceil(remaining / monthly) : null;
  const completion =
    months === null
      ? null
      : new Date(
          Date.UTC(
            now.getFullYear(),
            now.getMonth() + months,
            Math.min(
              now.getDate(),
              new Date(
                now.getFullYear(),
                now.getMonth() + months + 1,
                0,
              ).getDate(),
            ),
          ),
        )
          .toISOString()
          .slice(0, 10);
  const deadline = goal.date ? new Date(goal.date + "T12:00:00") : null;
  const monthsUntilTarget = Math.max(
    1,
    (deadline ? deadline.getFullYear() - now.getFullYear() : 0) * 12 +
      (deadline?.getMonth() ?? now.getMonth()) -
      now.getMonth() +
      ((deadline?.getDate() ?? 0) > now.getDate() ? 1 : 0),
  );
  const requiredMonthly = deadline
    ? Math.ceil((remaining / monthsUntilTarget) * 100) / 100
    : null;
  return {
    monthly,
    months,
    completion,
    requiredMonthly,
    onTrack:
      remaining === 0 ||
      Boolean(completion && goal.date && completion <= goal.date),
  };
}
export function csvExport(transactions: Transaction[]) {
  const cell = (v: string | number) =>
    `"${String(v)
      .replace(/^[=+@\-\t\r]/, "'" + "$&")
      .replaceAll('"', '""')}"`;
  return (
    "\uFEFF" +
    [
      ["Date", "Description", "Category", "Type", "Amount"],
      ...transactions.map((t) => [
        t.date,
        t.title,
        t.category,
        t.kind,
        t.amount,
      ]),
    ]
      .map((row) => row.map(cell).join(","))
      .join("\r\n")
  );
}
