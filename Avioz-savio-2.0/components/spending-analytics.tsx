"use client";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { totals, monthTransactions, type Transaction } from "@/lib/finance";
import { categoryLabel } from "@/lib/categories";
const colors = [
  "#81e7af",
  "#9aabe8",
  "#c6a4e9",
  "#e6b48c",
  "#80cfd2",
  "#e48fa2",
  "#aabf8d",
];
export function SpendingAnalytics({
  transactions,
  month,
  he,
  money,
}: {
  transactions: Transaction[];
  month: string;
  he: boolean;
  money: (n: number) => string;
}) {
  const current = monthTransactions(transactions, month);
  const grouped = new Map<string, number>();
  for (const row of current.filter((t) => t.kind === "expense"))
    grouped.set(row.category, (grouped.get(row.category) || 0) + row.amount);
  const categories = [...grouped]
    .map(([name, value]) => ({ name: categoryLabel(name, he), value }))
    .sort((a, b) => b.value - a.value);
  const [year, mon] = month.split("-").map(Number);
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(year, mon - 6 + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return {
      label: d.toLocaleDateString(he ? "he-IL" : "en-US", { month: "short" }),
      ...totals(monthTransactions(transactions, key)),
    };
  });
  return (
    <section className="analytics-grid spaced">
      <article>
        <h3>{he ? "לאן הכסף הולך?" : "Where your money goes"}</h3>
        {categories.length ? (
          <>
            <div
              className="chart"
              role="img"
              aria-label={
                he
                  ? "חלוקת הוצאות לפי קטגוריה"
                  : "Expense breakdown by category"
              }
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categories}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="55%"
                    outerRadius="85%"
                    paddingAngle={3}
                    stroke="none"
                  >
                    {categories.map((c, i) => (
                      <Cell fill={colors[i % colors.length]} key={c.name} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "var(--panel)",
                      border: "1px solid var(--line)",
                      borderRadius: 8,
                    }}
                    formatter={(v) => money(Number(v))}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="analytics-legend">
              {categories.map((c, i) => (
                <div className="flex-between small" key={c.name}>
                  <span>
                    <i style={{ background: colors[i % colors.length] }} />
                    {c.name}
                  </span>
                  <strong>{money(c.value)}</strong>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="empty small muted">
            {he
              ? "הוסיפו הוצאות כדי לראות את החלוקה."
              : "Add expenses to see your spending breakdown."}
          </p>
        )}
      </article>
      <article>
        <h3>{he ? "שישה חודשים במבט אחד" : "Six months at a glance"}</h3>
        <div
          className="chart"
          role="img"
          aria-label={
            he
              ? "השוואת הכנסות והוצאות לשישה חודשים"
              : "Six-month income and expense comparison"
          }
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={months} margin={{ left: -15, top: 20 }}>
              <CartesianGrid vertical={false} stroke="var(--line)" />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--muted)", fontSize: 10 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--muted)", fontSize: 10 }}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--panel)",
                  border: "1px solid var(--line)",
                  borderRadius: 8,
                }}
                formatter={(v) => money(Number(v))}
              />
              <Bar
                dataKey="income"
                name={he ? "הכנסה" : "Income"}
                fill="#81e7af"
                radius={[3, 3, 0, 0]}
              />
              <Bar
                dataKey="expenses"
                name={he ? "הוצאות" : "Expenses"}
                fill="#9aabe8"
                radius={[3, 3, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="small muted">
          {months.map((m) => (
            <div className="flex-between" key={m.label}>
              <span>{m.label}</span>
              <span>
                {money(m.income)} / {money(m.expenses)}
              </span>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
