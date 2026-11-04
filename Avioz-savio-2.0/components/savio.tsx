"use client";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Clock3,
  Target,
  ChartPie,
  CalendarDays,
  Sparkles,
  Settings,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  ChevronLeft,
  ChevronRight,
  Search,
  ArrowRight,
  Download,
  Play,
  Square,
  Trash2,
  Pencil,
  Globe,
  Sun,
  Moon,
  Wallet,
  ShieldCheck,
  Menu,
  LogOut,
  Check,
  TrendingUp,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { browserClient, configured } from "@/lib/supabase";
import {
  emptyData,
  dataSchema,
  shiftPay,
  monthTransactions,
  totals,
  goalSaved,
  savingsPlan,
  csvExport,
  transactionSchema,
  workplaceSchema,
  goalSchema,
  shiftSchema,
  type FinanceData,
  type Transaction,
  type Goal,
  type Shift,
  type Workplace,
} from "@/lib/finance";
import { words } from "@/lib/i18n";
import { elapsedLabel, localMonth } from "@/lib/time";
import { useReminders } from "@/lib/use-reminders";
import { categoryLabel } from "@/lib/categories";
import { SpendingAnalytics } from "./spending-analytics";
import { FinancialCalendar } from "./financial-calendar";
import { LegacyImport } from "./legacy-import";
import { Modal, Field, Empty } from "./ui";
type Tab =
  | "overview"
  | "transactions"
  | "shifts"
  | "goals"
  | "budgets"
  | "calendar"
  | "ai"
  | "settings";
type Editor =
  | { kind: "transaction"; value?: Transaction }
  | { kind: "goal"; value?: Goal }
  | { kind: "workplace"; value?: Workplace }
  | { kind: "shift"; value?: Shift }
  | { kind: "contribution"; value: Goal }
  | { kind: "auth" }
  | null;
const baseCategories = [
  "Food & dining",
  "Groceries",
  "Transport",
  "Shopping",
  "Housing",
  "Health",
  "Entertainment",
  "Salary",
  "Freelance",
  "Other",
];
const today = () => new Date().toLocaleDateString("en-CA");
const id = () => crypto.randomUUID();
function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
export function Savio() {
  const revision = useRef(0);
  const saving = useRef(false);
  const signedInId = useRef<string | null>(null);
  const localSnapshot = useRef<string | null>(null);
  const [data, setData] = useState<FinanceData>(emptyData),
    [ready, setReady] = useState(false),
    [user, setUser] = useState<User | null>(null),
    [tab, updateTab] = useState<Tab>("overview"),
    [editor, updateEditor] = useState<Editor>(null),
    [month, setMonth] = useState(today().slice(0, 7)),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [menu, setMenu] = useState(false),
    [now, setNow] = useState(new Date()),
    [consent, setConsent] = useState(false),
    [aiAvailable, setAiAvailable] = useState(false),
    [chat, setChat] = useState<{ role: string; text: string }[]>([]),
    [question, setQuestion] = useState(""),
    [mode, setMode] = useState<"conservative" | "balanced" | "accelerated">(
      "balanced",
    ),
    [authMode, setAuthMode] = useState("login"),
    [recovery, setRecovery] = useState(false);
  useReminders(data.transactions, data.reminders, user?.id || "local", ready);
  function setTab(next: Tab) {
    setMenu(false);
    updateTab(next);
    const url = new URL(location.href);
    url.searchParams.set("tab", next);
    history.replaceState(null, "", url);
  }
  function setEditor(next: Editor) {
    setMessage("");
    updateEditor(next);
  }
  const categories = [
    ...new Set([
      ...baseCategories,
      ...data.transactions.map((t) => t.category),
      ...Object.keys(data.budgets).map((k) => k.slice(k.indexOf(":") + 1)),
    ]),
  ];
  const t = words[data.profile.language],
    he = data.profile.language === "he";
  const txs = monthTransactions(data.transactions, month),
    sum = totals(txs);
  const money = (n: number) =>
    new Intl.NumberFormat(he ? "he-IL" : "en-IL", {
      style: "currency",
      currency: data.profile.currency,
      maximumFractionDigits: 0,
    }).format(n);
  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};
    async function init() {
      const initialTab = new URLSearchParams(location.search).get("tab");
      if (
        initialTab &&
        [
          "overview",
          "transactions",
          "shifts",
          "goals",
          "budgets",
          "calendar",
          "ai",
          "settings",
        ].includes(initialTab)
      )
        updateTab(initialTab as Tab);
      try {
        if (configured) {
          const client = browserClient();
          const {
            data: { user },
          } = await client.auth.getUser();
          if (!active) return;
          setUser(user);
          signedInId.current = user?.id || null;
          if (user) {
            const response = await fetch("/api/data", { cache: "no-store" });
            const snapshot = await response.json();
            if (!response.ok) throw new Error(snapshot.error);
            if (active) {
              setData(dataSchema.parse(snapshot.data));
              revision.current = snapshot.revision;
            }
          } else {
            const raw = localStorage.getItem("savio-local-v1");
            localSnapshot.current = raw;
            if (raw) setData(dataSchema.parse(JSON.parse(raw)));
          }
          const { data: listener } = client.auth.onAuthStateChange((event) => {
            if (event === "SIGNED_OUT") window.location.reload();
            if (event === "SIGNED_IN" && !signedInId.current)
              window.location.reload();
            if (event === "PASSWORD_RECOVERY") setRecovery(true);
          });
          unsubscribe = () => listener.subscription.unsubscribe();
        } else {
          const raw = localStorage.getItem("savio-local-v1");
          localSnapshot.current = raw;
          if (raw) setData(dataSchema.parse(JSON.parse(raw)));
        }
        if (new URLSearchParams(location.search).has("recovery"))
          setRecovery(true);
        if (new URLSearchParams(location.search).has("auth_error"))
          setMessage("Email link could not be verified. Request a fresh link.");
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Could not load records. Please reload before making changes.",
        );
        return;
      }
      if (active) setReady(true);
    }
    void init();
    void fetch("/api/ai")
      .then((r) => r.json())
      .then((result) => {
        if (active) setAiAvailable(Boolean(result.available));
      })
      .catch(() => {});
    if ("serviceWorker" in navigator)
      void navigator.serviceWorker.register("/sw.js").catch(() => {});
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => {
      active = false;
      unsubscribe();
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    document.documentElement.lang = data.profile.language;
    document.documentElement.dir = he ? "rtl" : "ltr";
    document.documentElement.dataset.theme = data.profile.theme;
  }, [data.profile.language, data.profile.theme, he]);
  async function commit(next: FinanceData) {
    if (saving.current || !ready) return false;
    const parsed = dataSchema.safeParse(next);
    if (!parsed.success) {
      setMessage(parsed.error.issues[0].message);
      return false;
    }
    saving.current = true;
    setBusy(true);
    try {
      if (user) {
        const res = await fetch("/api/data", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            data: parsed.data,
            revision: revision.current,
          }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error);
        revision.current = result.revision;
      } else {
        if (localStorage.getItem("savio-local-v1") !== localSnapshot.current)
          throw new Error(
            "Your local records changed in another tab. Reload before saving.",
          );
        const raw = JSON.stringify(parsed.data);
        localStorage.setItem("savio-local-v1", raw);
        localSnapshot.current = raw;
      }
      setData(parsed.data);
      return true;
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Save failed");
      return false;
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    try {
      const { error } = await browserClient().auth.signOut();
      if (error) throw error;
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Sign out failed");
    } finally {
      setBusy(false);
    }
  }
  function changeMonth(delta: number) {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  const monthLabel = new Date(month + "-15T12:00:00").toLocaleDateString(
    he ? "he-IL" : "en-US",
    { month: "long", year: "numeric" },
  );
  const chart = Array.from(
    {
      length: new Date(
        Number(month.slice(0, 4)),
        Number(month.slice(5)),
        0,
      ).getDate(),
    },
    (_, i) => {
      const day = String(i + 1).padStart(2, "0");
      const daily = totals(txs.filter((x) => x.date.endsWith("-" + day)));
      return { day: i + 1, income: daily.income, expenses: daily.expenses };
    },
  );
  const pay = data.shifts
    .filter((s) => localMonth(s.start) === month)
    .reduce(
      (n, s) =>
        n +
        shiftPay(
          s,
          data.workplaces.find((w) => w.id === s.workplaceId)!,
          now,
        ).gross,
      0,
    );
  const saved = data.goals.reduce((n, g) => n + goalSaved(g), 0),
    target = data.goals.reduce((n, g) => n + g.target, 0);
  const activeShift = data.shifts.find((s) => !s.end);
  async function remove(
    kind: "transactions" | "goals" | "shifts" | "workplaces",
    key: string,
  ) {
    if (!confirm(he ? "למחוק את הרשומה?" : "Delete this record?")) return;
    if (
      kind === "workplaces" &&
      data.shifts.some((s) => s.workplaceId === key)
    ) {
      setMessage("Remove associated shifts before deleting a workplace.");
      return;
    }
    await commit({ ...data, [kind]: data[kind].filter((x) => x.id !== key) });
  }
  async function startShift(workplaceId: string) {
    if (activeShift) return;
    await commit({
      ...data,
      shifts: [
        ...data.shifts,
        {
          id: id(),
          workplaceId,
          start: new Date().toISOString(),
          end: null,
          breakMinutes: 0,
          paidBreak: false,
          premium: false,
        },
      ],
    });
  }
  async function stopShift() {
    if (!activeShift) return;
    await commit({
      ...data,
      shifts: data.shifts.map((s) =>
        s.id === activeShift.id ? { ...s, end: new Date().toISOString() } : s,
      ),
    });
  }
  async function submitEditor(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editor) return;
    const f = new FormData(e.currentTarget),
      v = (key: string) => String(f.get(key) || ""),
      n = (key: string) => Number(f.get(key)),
      checked = (key: string) => f.get(key) === "on";
    const next = { ...data };
    try {
      if (editor.kind === "transaction") {
        const value = transactionSchema.parse({
          id: editor.value?.id || id(),
          title: v("title"),
          amount: n("amount"),
          kind: v("kind"),
          category: v("category"),
          date: v("date"),
          recurring: checked("recurring"),
        });
        next.transactions = editor.value
          ? data.transactions.map((x) => (x.id === value.id ? value : x))
          : [...data.transactions, value];
      }
      if (editor.kind === "workplace") {
        const value = workplaceSchema.parse({
          id: editor.value?.id || id(),
          name: v("name"),
          wage: n("wage"),
          regularHours: n("regularHours"),
          overtimeHours: n("overtimeHours"),
          overtimeRate: n("overtimeRate"),
          extraRate: n("extraRate"),
          premiumRate: n("premiumRate"),
        });
        next.workplaces = editor.value
          ? data.workplaces.map((x) => (x.id === value.id ? value : x))
          : [...data.workplaces, value];
      }
      if (editor.kind === "shift") {
        const value = shiftSchema.parse({
          id: editor.value?.id || id(),
          workplaceId: v("workplaceId"),
          start: new Date(v("start")).toISOString(),
          end: new Date(v("end")).toISOString(),
          breakMinutes: n("breakMinutes"),
          paidBreak: checked("paidBreak"),
          premium: checked("premium"),
        });
        next.shifts = editor.value
          ? data.shifts.map((x) => (x.id === value.id ? value : x))
          : [...data.shifts, value];
      }
      if (editor.kind === "goal") {
        const value = goalSchema.parse({
          id: editor.value?.id || id(),
          name: v("name"),
          target: n("target"),
          existing: n("existing"),
          monthly: n("monthly"),
          date: v("date") || null,
          contributions: editor.value?.contributions || [],
        });
        next.goals = editor.value
          ? data.goals.map((x) => (x.id === value.id ? value : x))
          : [...data.goals, value];
      }
      if (editor.kind === "contribution") {
        const amount = n("amount");
        if (amount <= 0 || !Number.isFinite(amount))
          throw new Error("Enter a positive amount");
        next.goals = data.goals.map((g) =>
          g.id === editor.value.id
            ? {
                ...g,
                contributions: [
                  ...g.contributions,
                  { id: id(), amount, date: v("date") },
                ],
              }
            : g,
        );
      }
      if (editor.kind === "auth") {
        if (!configured) {
          setMessage(
            "Supabase is not configured. Add the public Supabase URL and anon key in environment settings.",
          );
          return;
        }
        setBusy(true);
        const client = browserClient();
        let error;
        if (authMode === "register") {
          ({ error } = await client.auth.signUp({
            email: v("email"),
            password: v("password"),
            options: { emailRedirectTo: location.origin + "/auth/callback" },
          }));
          if (!error)
            setMessage(
              "Check your email to verify your account, then sign in.",
            );
        } else if (authMode === "reset") {
          ({ error } = await client.auth.resetPasswordForEmail(v("email"), {
            redirectTo: location.origin + "/auth/callback?type=recovery",
          }));
          if (!error)
            setMessage(
              "If the account exists, a password reset link has been sent.",
            );
        } else {
          ({ error } = await client.auth.signInWithPassword({
            email: v("email"),
            password: v("password"),
          }));
        }
        setBusy(false);
        if (error) throw error;
        setEditor(null);
        return;
      }
      if (await commit(next)) {
        setEditor(null);
        setMessage(he ? "נשמר בהצלחה" : "Saved successfully");
      }
    } catch (err) {
      setBusy(false);
      setMessage(err instanceof Error ? err.message : "Check your entries");
    }
  }
  async function ask(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || busy) return;
    const text = question;
    setChat((c) => [...c, { role: "You", text }]);
    setQuestion("");
    setBusy(true);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, consent, month }),
      });
      const result = await res.json();
      setChat((c) => [
        ...c,
        { role: "SAVIO", text: result.reply || result.error },
      ]);
    } catch {
      setMessage("Unable to reach AI. Please use the local insights.");
    } finally {
      setBusy(false);
      setConsent(false);
    }
  }
  const nav = [
    { key: "overview", icon: LayoutDashboard },
    { key: "transactions", icon: ArrowLeftRight },
    { key: "shifts", icon: Clock3 },
    { key: "goals", icon: Target },
    { key: "budgets", icon: ChartPie },
    { key: "calendar", icon: CalendarDays },
    { key: "ai", icon: Sparkles },
  ] as const;
  const transactionList = (items: Transaction[]) =>
    items.length ? (
      <div className="transaction-list">
        {items.map((x) => (
          <div className="transaction-row" key={x.id}>
            <span
              className={
                "transaction-icon " + (x.kind === "income" ? "positive" : "")
              }
            >
              {x.kind === "income" ? (
                <ArrowDownRight size={19} />
              ) : (
                <ArrowUpRight size={19} />
              )}
            </span>
            <div className="grow">
              <strong>{x.title}</strong>
              <small>
                {categoryLabel(x.category, he)} {x.recurring ? "· ↻" : ""}
              </small>
            </div>
            <div className="transaction-amount">
              <strong className={x.kind === "income" ? "positive" : ""}>
                {x.kind === "income" ? "+" : "−"}
                {money(x.amount)}
              </strong>
              <small>
                {new Date(x.date + "T12:00:00").toLocaleDateString(
                  he ? "he-IL" : "en-US",
                  { month: "short", day: "numeric" },
                )}
              </small>
            </div>
            {tab === "transactions" && (
              <div className="row-actions">
                <button
                  aria-label={t.edit}
                  onClick={() =>
                    setEditor({
                      kind: "transaction",
                      value: data.transactions.find((z) => z.id === x.id),
                    })
                  }
                >
                  <Pencil size={15} />
                </button>
                <button
                  aria-label={t.delete}
                  onClick={() => remove("transactions", x.id)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    ) : (
      <Empty title={t.welcome} description={t.empty} />
    );
  const goalCards = (limit?: number) =>
    (limit ? data.goals.slice(0, limit) : data.goals).map((g, i) => {
      const progress = Math.min(100, (goalSaved(g) / g.target) * 100),
        plan = savingsPlan(
          g,
          sum.balance *
            (g.monthly /
              Math.max(
                1,
                data.goals.reduce((n, x) => n + x.monthly, 0),
              )),
          mode,
        );
      return (
        <article key={g.id} className="goal-card">
          <div className="flex-between">
            <span className={"goal-icon goal-" + (i % 3)}>
              <Target size={21} />
            </span>
            <span className="pill">{Math.round(progress)}%</span>
          </div>
          <h3>{g.name}</h3>
          <div className="goal-values">
            <strong>{money(goalSaved(g))}</strong>
            <span> / {money(g.target)}</span>
          </div>
          <div className="progress">
            <i style={{ width: progress + "%" }} />
          </div>
          <div className="flex-between muted small">
            <span>
              {g.date
                ? new Date(g.date + "T12:00:00").toLocaleDateString(
                    he ? "he-IL" : "en-US",
                    { month: "short", year: "numeric" },
                  )
                : he
                  ? "ללא תאריך יעד"
                  : "No target date"}
            </span>
            <span>
              {money(g.monthly)} / {he ? "חודש" : "mo"}
            </span>
          </div>
          {tab === "goals" && (
            <>
              <p className="small muted">
                {he ? "תכנית מותאמת לתזרים" : "Plan based on cash flow"}:{" "}
                {money(plan.monthly)} / {he ? "חודש" : "mo"} ·{" "}
                {plan.completion ||
                  (he ? "אין אומדן סיום" : "No completion estimate")}
              </p>
              <p className="small muted">
                {he
                  ? "נדרש מדי חודש לתאריך היעד"
                  : "Required monthly to meet your date"}
                :{" "}
                {plan.requiredMonthly === null
                  ? "—"
                  : money(plan.requiredMonthly)}{" "}
                ·{" "}
                {plan.onTrack
                  ? he
                    ? "בקצב המתאים"
                    : "On track"
                  : he
                    ? "נדרשת התאמת התכנית"
                    : "Adjust your plan"}
              </p>
              <div className="button-row">
                <button
                  className="secondary"
                  onClick={() => setEditor({ kind: "contribution", value: g })}
                >
                  <Plus size={14} />
                  {he ? "הפקדה" : "Contribute"}
                </button>
                <button
                  className="icon-button"
                  aria-label={t.edit}
                  onClick={() => setEditor({ kind: "goal", value: g })}
                >
                  <Pencil size={15} />
                </button>
                <button
                  className="icon-button"
                  aria-label={t.delete}
                  onClick={() => remove("goals", g.id)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
              {g.contributions.map((c) => (
                <div className="flex-between small" key={c.id}>
                  <span>
                    {c.date} · {money(c.amount)}
                  </span>
                  <button
                    className="icon-button"
                    aria-label="Delete contribution"
                    onClick={() =>
                      commit({
                        ...data,
                        goals: data.goals.map((x) =>
                          x.id === g.id
                            ? {
                                ...x,
                                contributions: x.contributions.filter(
                                  (z) => z.id !== c.id,
                                ),
                              }
                            : x,
                        ),
                      })
                    }
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </>
          )}
        </article>
      );
    });
  if (!ready)
    return (
      <main className="loading">
        <span className="brand">
          SAVIO<span>●</span>
        </span>
        <p>Preparing your private workspace…</p>
        {message && (
          <>
            <p role="alert">{message}</p>
            <button className="secondary" onClick={() => location.reload()}>
              Retry loading
            </button>
            <button
              className="text-button"
              onClick={() =>
                download(
                  "savio-browser-backup.json",
                  localStorage.getItem("savio-local-v1") || "{}",
                  "application/json",
                )
              }
            >
              Export browser backup
            </button>
          </>
        )}
      </main>
    );
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        {he ? "דילוג לתוכן" : "Skip to content"}
      </a>
      <aside
        id="workspace-navigation"
        className={"sidebar " + (menu ? "open" : "")}
      >
        <button
          className="icon-button mobile-menu close-navigation"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        >
          ×
        </button>
        <Link className="brand" href="/">
          SAVIO<span>●</span>
        </Link>
        <p className="brand-tagline">הכסף שלך. העתיד שלך.</p>
        <div className="workspace-label">
          {he ? "המרחב שלך" : "YOUR WORKSPACE"}
        </div>
        <nav>
          {nav.map(({ key, icon: Icon }) => (
            <button
              className={"nav-item " + (tab === key ? "active" : "")}
              key={key}
              onClick={() => {
                setTab(key);
                setMenu(false);
              }}
            >
              <Icon size={19} />
              <span>{t[key]}</span>
              {key === "ai" && <span className="new-badge">AI</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="side-note">
            <span className="mini-star">✧</span>
            <strong>
              {he ? "העתיד מתחיל בך" : "Your future starts with you."}
            </strong>
            <p>
              {he
                ? "כל צעד קטן נחשב."
                : "Every small step counts. Let’s make yours matter."}
            </p>
            <span className="small positive">
              {he ? "בונים הרגלים טובים" : "Build better money habits"} ↗
            </span>
          </div>
          <button
            className={"nav-item " + (tab === "settings" ? "active" : "")}
            onClick={() => setTab("settings")}
          >
            <Settings size={19} />
            {t.settings}
          </button>
          <div className="profile">
            <span className="avatar">
              {(data.profile.name || user?.email || "S")
                .slice(0, 1)
                .toUpperCase()}
            </span>
            <div className="grow">
              <strong>
                {data.profile.name ||
                  user?.email?.split("@")[0] ||
                  (he ? "החשבון שלך" : "Your workspace")}
              </strong>
              <small>
                {user ? "Personal account" : "Local · on this device"}
              </small>
            </div>
            <button
              className="icon-button"
              aria-label={user ? t.logout : t.login}
              onClick={() => (user ? logout() : setEditor({ kind: "auth" }))}
            >
              {user ? <LogOut size={17} /> : <ArrowRight size={17} />}
            </button>
          </div>
        </div>
      </aside>
      <div className="main-wrap">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="Menu"
            onClick={() => setMenu(!menu)}
          >
            <Menu />
          </button>
          <div className="breadcrumb">
            {he ? "המרחב שלך" : "My workspace"}
            <span>/</span>
            <strong>{t[tab]}</strong>
          </div>
          <div className="top-actions">
            <span className="security">
              <ShieldCheck size={14} />
              {user ? "Secure connection" : "Private by design"}
            </span>
            <button
              className="icon-button"
              aria-label="Change language"
              onClick={() =>
                commit({
                  ...data,
                  profile: { ...data.profile, language: he ? "en" : "he" },
                })
              }
            >
              <Globe size={18} />
              <span className="small">{he ? "EN" : "עב"}</span>
            </button>
            <button
              className="icon-button"
              aria-label="Toggle theme"
              onClick={() =>
                commit({
                  ...data,
                  profile: {
                    ...data.profile,
                    theme: data.profile.theme === "dark" ? "light" : "dark",
                  },
                })
              }
            >
              {data.profile.theme === "dark" ? (
                <Sun size={18} />
              ) : (
                <Moon size={18} />
              )}
            </button>
          </div>
        </header>
        <main id="main-content" className="main-content" tabIndex={-1}>
          <div className="page-heading">
            <div>
              <p className="eyebrow">
                <span /> {t.greeting}
              </p>
              <h1>
                {tab === "overview" ? t.dashboard : t[tab]}
                <span className="heading-dot">.</span>
              </h1>
              <p className="muted">
                {tab === "overview" ? t.subtitle : "הכסף שלך. העתיד שלך."}
              </p>
            </div>
            <div className="heading-actions">
              <div className="month-picker">
                <button
                  aria-label="Previous month"
                  onClick={() => changeMonth(-1)}
                >
                  <ChevronLeft size={16} />
                </button>
                <span>{monthLabel}</span>
                <button aria-label="Next month" onClick={() => changeMonth(1)}>
                  <ChevronRight size={16} />
                </button>
              </div>
              <button
                className="primary"
                onClick={() => setEditor({ kind: "transaction" })}
              >
                <Plus size={17} />
                {t.add}
              </button>
            </div>
          </div>
          {!user && (
            <div className="local-banner">
              <ShieldCheck size={17} />
              <span>
                <strong>{t.local}</strong>{" "}
                <span className="banner-description">{t.localSub}</span>
              </span>
              <button onClick={() => setEditor({ kind: "auth" })}>
                {t.login}
                <ArrowUpRight size={14} />
              </button>
            </div>
          )}
          {message && (
            <div role="status" className="notice">
              <span>{message}</span>
              <button aria-label="Dismiss" onClick={() => setMessage("")}>
                ×
              </button>
            </div>
          )}
          {tab === "overview" && (
            <>
              <section className="stats-grid">
                {[
                  {
                    label: t.income,
                    value: sum.income,
                    icon: ArrowDownRight,
                    color: "green",
                    note: he
                      ? "מתנועות שנרשמו החודש"
                      : "From your recorded income",
                  },
                  {
                    label: t.expenses,
                    value: sum.expenses,
                    icon: ArrowUpRight,
                    color: "coral",
                    note: he
                      ? "הוצאות חד פעמיות וחוזרות"
                      : "One-time & recurring expenses",
                  },
                  {
                    label: t.balance,
                    value: sum.balance,
                    icon: Wallet,
                    color: "blue",
                    note: he
                      ? "הכנסות פחות הוצאות · לא יתרת בנק"
                      : "Income less expenses · not bank balance",
                  },
                  {
                    label: t.savings,
                    value: saved,
                    icon: Target,
                    color: "purple",
                    note: target
                      ? `${Math.round((saved / target) * 100)}% ${he ? "מהיעדים שלך" : "of your combined goals"}`
                      : he
                        ? "צעד ראשון לעבר העתיד"
                        : "Your first step toward the future",
                  },
                ].map(({ label, value, icon: Icon, color, note }) => (
                  <article className="stat-card" key={label}>
                    <div className="flex-between">
                      <span>{label}</span>
                      <span className={"stat-icon " + color}>
                        <Icon size={18} />
                      </span>
                    </div>
                    <div className="stat-value">{money(value)}</div>
                    <p>
                      <span className={"tiny-dot " + color} />
                      {note}
                    </p>
                  </article>
                ))}
              </section>
              <section className="overview-grid">
                <article className="panel cashflow">
                  <div className="panel-heading">
                    <div>
                      <h2>{t.flow}</h2>
                      <p>{t.flowSub}</p>
                    </div>
                    <div className="legend">
                      <span>
                        <i />
                        {t.incomeType}
                      </span>
                      <span>
                        <i />
                        {t.expense}
                      </span>
                    </div>
                  </div>
                  <div className="chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={chart}
                        margin={{ top: 20, right: 10, left: -20, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient
                            id="income-fill"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor="#6de4ac"
                              stopOpacity={0.23}
                            />
                            <stop
                              offset="100%"
                              stopColor="#6de4ac"
                              stopOpacity={0}
                            />
                          </linearGradient>
                          <linearGradient
                            id="expense-fill"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor="#8c9de7"
                              stopOpacity={0.12}
                            />
                            <stop
                              offset="100%"
                              stopColor="#8c9de7"
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          stroke="var(--line)"
                          vertical={false}
                          strokeDasharray="3 5"
                        />
                        <XAxis
                          dataKey="day"
                          tickLine={false}
                          axisLine={false}
                          minTickGap={35}
                          tick={{ fill: "#849087", fontSize: 11 }}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: "#849087", fontSize: 11 }}
                        />
                        <Tooltip
                          contentStyle={{
                            background: "var(--panel)",
                            border: "1px solid var(--line)",
                            borderRadius: 12,
                            color: "var(--text)",
                          }}
                          formatter={(value) => money(Number(value))}
                        />
                        <Area
                          type="monotone"
                          dataKey="income"
                          name={t.incomeType}
                          stroke="#6de4ac"
                          strokeWidth={2.5}
                          fill="url(#income-fill)"
                        />
                        <Area
                          type="monotone"
                          dataKey="expenses"
                          name={t.expense}
                          stroke="#8c9de7"
                          strokeWidth={2}
                          fill="url(#expense-fill)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                    {!txs.length && (
                      <span className="chart-empty">
                        {he
                          ? "הוסיפו תנועות כדי לראות את המגמות"
                          : "Add transactions to reveal your trends"}
                      </span>
                    )}
                  </div>
                  <div className="chart-footer">
                    <TrendingUp size={16} />
                    <span>
                      {sum.income
                        ? `${Math.round((sum.balance / sum.income) * 100)}% ${he ? "מההכנסה נשארת לאחר הוצאות" : "of your income remains after expenses"}`
                        : he
                          ? "התמונה מתבהרת עם כל תנועה"
                          : "Clarity grows with every transaction."}
                    </span>
                  </div>
                </article>
                <article className="panel salary-panel">
                  <div className="flex-between">
                    <span className="stat-icon green">
                      <Clock3 size={21} />
                    </span>
                    <span className="pill">
                      {he ? "עבודה ושכר" : "WORK & SALARY"}
                    </span>
                  </div>
                  <p className="muted">{t.expected}</p>
                  <h2 className="salary-number">{money(pay)}</h2>
                  <p className="small muted">{t.gross}</p>
                  <div className="salary-divider" />
                  <div className="flex-between small">
                    <span className="muted">
                      {he ? "משמרות החודש" : "Shifts this month"}
                    </span>
                    <strong>
                      {
                        data.shifts.filter((s) => localMonth(s.start) === month)
                          .length
                      }
                    </strong>
                  </div>
                  <div className="flex-between small">
                    <span className="muted">
                      {he ? "מקומות עבודה" : "Workplaces"}
                    </span>
                    <strong>{data.workplaces.length}</strong>
                  </div>
                  <button
                    className="secondary full"
                    onClick={() => setTab("shifts")}
                  >
                    {activeShift ? (
                      <>
                        <span className="live-dot" />
                        Shift in progress
                      </>
                    ) : (
                      <>
                        <Clock3 size={16} />
                        {he ? "ניהול המשמרות שלך" : "Manage your shifts"}
                      </>
                    )}
                    <ArrowRight size={16} />
                  </button>
                </article>
              </section>
              <section className="bottom-grid">
                <article className="panel">
                  <div className="panel-heading">
                    <h2>{t.recent}</h2>
                    <button
                      className="text-button"
                      onClick={() => setTab("transactions")}
                    >
                      {t.viewAll}
                      <ArrowRight size={14} />
                    </button>
                  </div>
                  {transactionList(
                    [...txs]
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .slice(0, 4),
                  )}
                </article>
                <article className="panel goals-preview">
                  <div className="panel-heading">
                    <div>
                      <h2>{t.goalTitle}</h2>
                      <p>{t.goalSub}</p>
                    </div>
                    <button
                      className="icon-button"
                      aria-label={t.newGoal}
                      onClick={() => setEditor({ kind: "goal" })}
                    >
                      <Plus size={19} />
                    </button>
                  </div>
                  {data.goals.length ? (
                    <div className="goal-preview-grid">{goalCards(2)}</div>
                  ) : (
                    <button
                      className="new-goal-card"
                      onClick={() => setEditor({ kind: "goal" })}
                    >
                      <span className="new-goal-icon">
                        <Target size={27} />
                      </span>
                      <strong>
                        {he ? "למה אתם חוסכים?" : "What are you saving for?"}
                      </strong>
                      <span>
                        {he
                          ? "טיול גדול, בית ראשון, או פשוט שקט נפשי."
                          : "A big adventure, a first home, or a little peace of mind."}
                      </span>
                      <span className="positive">
                        {t.newGoal} <Plus size={14} />
                      </span>
                    </button>
                  )}
                </article>
              </section>
              <section className="insight-strip">
                <span className="insight-icon">
                  <Sparkles size={24} />
                </span>
                <div className="grow">
                  <span className="eyebrow">SAVIO INSIGHT</span>
                  <h3>
                    {sum.income > 0
                      ? sum.balance > 0
                        ? he
                          ? "יש לך מקום לצמוח."
                          : "You have room to grow."
                        : he
                          ? "זמן לבחון את ההוצאות."
                          : "A good moment to review your spending."
                      : he
                        ? "הצעד הראשון הוא להבין."
                        : "The first step is understanding."}
                  </h3>
                  <p>
                    {sum.income > 0
                      ? `${money(Math.max(0, sum.balance) * 0.2)} ${he ? "הם 20% מהיתרה המחושבת שלך — נקודת התחלה שמרנית לחיסכון." : "is 20% of your recorded surplus — a conservative starting point for savings."}`
                      : he
                        ? "תעדו את ההכנסות וההוצאות כדי לקבל תובנות שמבוססות עליכם."
                        : "Record your income and expenses to get insights grounded in your own numbers."}
                  </p>
                </div>
                <button className="text-button" onClick={() => setTab("ai")}>
                  {he ? "בואו נדבר" : "Let’s talk"}
                  <ArrowUpRight size={17} />
                </button>
              </section>
            </>
          )}
          {tab === "transactions" && (
            <article className="panel">
              <div className="panel-heading">
                <div className="search-box">
                  <Search size={17} />
                  <input
                    aria-label={t.search}
                    placeholder={t.search}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="button-row">
                  <select
                    aria-label="Filter type"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    <option value="all">
                      {he ? "כל התנועות" : "All transactions"}
                    </option>
                    <option value="income">{t.incomeType}</option>
                    <option value="expense">{t.expense}</option>
                    {categories.map((c) => (
                      <option value={c} key={c}>
                        {categoryLabel(c, he)}
                      </option>
                    ))}
                  </select>
                  <button
                    className="secondary"
                    onClick={() =>
                      download(
                        `savio-${month}.csv`,
                        csvExport(txs),
                        "text/csv;charset=utf-8",
                      )
                    }
                  >
                    <Download size={16} />
                    CSV
                  </button>
                </div>
              </div>
              {transactionList(
                [...txs]
                  .filter(
                    (x) =>
                      (filter === "all" ||
                        x.kind === filter ||
                        x.category === filter) &&
                      (x.title + " " + x.category)
                        .toLowerCase()
                        .includes(search.toLowerCase()),
                  )
                  .sort((a, b) => b.date.localeCompare(a.date)),
              )}
              <p className="small muted">
                {he
                  ? "עריכת תנועה חוזרת משנה את סדרת התנועות החל מתאריך המקור."
                  : "Editing a recurring entry changes its series from the original date."}
              </p>
              <SpendingAnalytics
                transactions={data.transactions}
                month={month}
                he={he}
                money={money}
              />
            </article>
          )}
          {tab === "shifts" && (
            <>
              <div className="section-toolbar">
                <div>
                  <h2>{money(pay)}</h2>
                  <span className="small muted">{t.gross}</span>
                </div>
                <div className="button-row">
                  <button
                    className="secondary"
                    onClick={() => setEditor({ kind: "workplace" })}
                  >
                    <Plus size={16} />
                    {t.workplace}
                  </button>
                  <button
                    className="primary"
                    disabled={!data.workplaces.length}
                    onClick={() => setEditor({ kind: "shift" })}
                  >
                    <Plus size={16} />
                    {t.newShift}
                  </button>
                </div>
              </div>
              <div className="panel">
                <h2>{he ? "טיימר משמרת" : "Shift timer"}</h2>
                {activeShift ? (
                  <div className="timer">
                    <span className="live-dot" />
                    <strong>
                      {
                        data.workplaces.find(
                          (w) => w.id === activeShift.workplaceId,
                        )?.name
                      }
                    </strong>
                    <span>{elapsedLabel(activeShift.start, now)}</span>
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={stopShift}
                    >
                      <Square size={16} />
                      {he ? "סיום משמרת" : "Stop shift"}
                    </button>
                  </div>
                ) : (
                  <div className="workplaces">
                    {data.workplaces.map((w) => (
                      <div className="workplace" key={w.id}>
                        <div className="grow">
                          <strong>{w.name}</strong>
                          <p>
                            {money(w.wage)} / {he ? "שעה" : "hour"}
                          </p>
                        </div>
                        <button
                          className="secondary"
                          disabled={busy}
                          onClick={() => startShift(w.id)}
                        >
                          <Play size={15} />
                          {he ? "התחלה" : "Start"}
                        </button>
                        <button
                          className="icon-button"
                          aria-label={t.edit}
                          onClick={() =>
                            setEditor({ kind: "workplace", value: w })
                          }
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          className="icon-button"
                          aria-label={t.delete}
                          onClick={() => remove("workplaces", w.id)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {!data.workplaces.length && (
                  <Empty
                    title={he ? "איפה אתם עובדים?" : "Where do you work?"}
                    description={
                      he
                        ? "הוסיפו מקום עבודה ושכר שעתי כדי להתחיל."
                        : "Add a workplace and hourly wage to start tracking."
                    }
                  />
                )}
              </div>
              <article className="panel spaced">
                <h2>{he ? "דוח שעות חודשי" : "Monthly timesheet"}</h2>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        {(he
                          ? [
                              "מקום עבודה",
                              "התחלה",
                              "סיום",
                              "שעות בתשלום",
                              "אומדן ברוטו",
                              "",
                            ]
                          : [
                              "Workplace",
                              "Start",
                              "End",
                              "Paid hours",
                              "Gross estimate",
                              "",
                            ]
                        ).map((h) => (
                          <th key={h}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.shifts
                        .filter((s) => localMonth(s.start) === month)
                        .map((s) => {
                          const w = data.workplaces.find(
                              (w) => w.id === s.workplaceId,
                            )!,
                            p = shiftPay(s, w, now);
                          return (
                            <tr key={s.id}>
                              <td>
                                {w.name}
                                {s.premium ? " · Premium" : ""}
                                {s.legacyGross !== undefined && (
                                  <small className="muted">
                                    {" "}
                                    · {he ? "אומדן מיובא" : "Imported estimate"}
                                  </small>
                                )}
                              </td>
                              <td>{new Date(s.start).toLocaleString()}</td>
                              <td>
                                {s.end
                                  ? new Date(s.end).toLocaleString()
                                  : "Running"}
                              </td>
                              <td>{p.hours.toFixed(2)}</td>
                              <td>{money(p.gross)}</td>
                              <td>
                                <button
                                  className="icon-button"
                                  aria-label={t.edit}
                                  onClick={() =>
                                    setEditor({ kind: "shift", value: s })
                                  }
                                >
                                  <Pencil size={15} />
                                </button>
                                <button
                                  className="icon-button"
                                  aria-label={t.delete}
                                  onClick={() => remove("shifts", s.id)}
                                >
                                  <Trash2 size={15} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
                <p className="small muted">
                  {he
                    ? "כללי השכר ניתנים להגדרה לכל מקום עבודה. תוספת סופ״ש וחג מופעלת ידנית למשמרת ומכפילה את אומדן השכר כולל שעות נוספות. אין כאן חישוב נטו או ייעוץ משפטי."
                    : "Configure payroll rules per workplace. Weekend/holiday premium is selected per shift and multiplies the gross estimate including overtime. No net salary or tax calculation is implied."}
                </p>
              </article>
            </>
          )}
          {tab === "goals" && (
            <>
              <div className="section-toolbar">
                <p className="muted">
                  {he
                    ? "הפקדות מתועדות אינן יתרת בנק."
                    : "Recorded contributions are not bank balances."}
                </p>
                <div className="button-row">
                  <select
                    aria-label="Savings plan"
                    value={mode}
                    onChange={(e) => setMode(e.target.value as typeof mode)}
                  >
                    <option value="conservative">
                      Conservative · 20% surplus
                    </option>
                    <option value="balanced">Balanced · 35% surplus</option>
                    <option value="accelerated">
                      Accelerated · 50% surplus
                    </option>
                  </select>
                  <button
                    className="primary"
                    onClick={() => setEditor({ kind: "goal" })}
                  >
                    <Plus size={16} />
                    {t.newGoal}
                  </button>
                </div>
              </div>
              <div className="goals-grid">{goalCards()}</div>
              {!data.goals.length && (
                <div className="panel">
                  <Empty title={t.goalTitle} description={t.goalSub} />
                </div>
              )}
              <div className="panel spaced">
                <h2>{he ? "אתגר חיסכון" : "Savings challenge"}</h2>
                <p className="muted">
                  {he
                    ? "בצעו שלוש הפקדות ליעדים שלכם כדי לבנות הרגל."
                    : "Make three contributions toward your goals to build a habit."}
                </p>
                <div className="progress">
                  <i
                    style={{
                      width:
                        Math.min(
                          100,
                          (data.goals.reduce(
                            (n, g) => n + g.contributions.length,
                            0,
                          ) /
                            3) *
                            100,
                        ) + "%",
                    }}
                  />
                </div>
                <p className="positive">
                  {data.goals.reduce((n, g) => n + g.contributions.length, 0) >=
                  3
                    ? "✓ Habit builder achievement unlocked"
                    : `${data.goals.reduce((n, g) => n + g.contributions.length, 0)} / 3 contributions`}
                </p>
              </div>
            </>
          )}
          {tab === "budgets" && (
            <div className="budgets-grid">
              {categories.map((category) => {
                const spent = txs
                    .filter(
                      (t) => t.kind === "expense" && t.category === category,
                    )
                    .reduce((n, t) => n + t.amount, 0),
                  budget =
                    data.budgets[month + ":" + category] ??
                    data.budgets["default:" + category] ??
                    0;
                const [y, m] = month.split("-").map(Number),
                  previous = new Date(y, m - 2, 15),
                  prevKey = `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, "0")}`,
                  prev = monthTransactions(data.transactions, prevKey)
                    .filter(
                      (t) => t.kind === "expense" && t.category === category,
                    )
                    .reduce((n, t) => n + t.amount, 0);
                return (
                  <article className="panel" key={category}>
                    <h3>{categoryLabel(category, he)}</h3>
                    <div className="goal-values">
                      <strong>{money(spent)}</strong>
                      <span> / {money(budget)}</span>
                    </div>
                    <div
                      className={
                        "progress " + (spent > budget ? "over-budget" : "")
                      }
                    >
                      <i
                        style={{
                          width:
                            (budget
                              ? Math.min(100, (spent / budget) * 100)
                              : 0) + "%",
                        }}
                      />
                    </div>
                    <p className="small muted">
                      {he ? "חודש קודם" : "Previous month"}: {money(prev)} ·{" "}
                      {prev
                        ? `${Math.round(((spent - prev) / prev) * 100)}%`
                        : "—"}
                    </p>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const amount = Number(
                          new FormData(e.currentTarget).get("budget"),
                        );
                        await commit({
                          ...data,
                          budgets: {
                            ...data.budgets,
                            [month + ":" + category]: amount,
                          },
                        });
                      }}
                    >
                      <Field label={t.budget}>
                        <div className="input-action">
                          <input
                            name="budget"
                            aria-label={category + " budget"}
                            type="number"
                            min="0"
                            max="1000000000"
                            step="0.01"
                            defaultValue={budget}
                            key={month}
                            required
                          />
                          <button
                            className="icon-button"
                            disabled={busy}
                            aria-label={t.save}
                          >
                            <Check size={18} />
                          </button>
                        </div>
                      </Field>
                    </form>
                  </article>
                );
              })}
            </div>
          )}
          {tab === "calendar" && (
            <FinancialCalendar
              data={data}
              month={month}
              money={money}
              onSave={commit}
              busy={busy}
            />
          )}
          {tab === "ai" && (
            <div className="ai-layout">
              <article className="panel chat-panel">
                <div className="ai-intro">
                  <span className="ai-orb">
                    <Sparkles size={30} />
                  </span>
                  <span className="eyebrow">YOUR FINANCIAL COACH</span>
                  <h2>
                    {he
                      ? "מרחב לשאלות גדולות."
                      : "Big questions. Clearer possibilities."}
                  </h2>
                  <p>
                    {aiAvailable
                      ? he
                        ? "אימון פיננסי המבוסס על השאלות שלך. נתונים אישיים נשלחים רק בהסכמתך לכל בקשה."
                        : "Financial coaching grounded in your questions. Personal records are shared only with your permission for each request."
                      : t.noAI}
                  </p>
                </div>
                <div className="chat-messages" aria-live="polite">
                  {chat.map((c, i) => (
                    <div
                      className={
                        "chat-message " + (c.role === "You" ? "from-user" : "")
                      }
                      key={i}
                    >
                      <strong>{c.role}</strong>
                      <p>{c.text}</p>
                    </div>
                  ))}
                </div>
                <form onSubmit={ask}>
                  <Field label={he ? "מה תרצו לבדוק?" : "What’s on your mind?"}>
                    <textarea
                      required
                      maxLength={2000}
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      placeholder={
                        he
                          ? "איך אוכל לחסוך יותר?"
                          : "How could I make more room for saving?"
                      }
                    />
                  </Field>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                    />
                    {t.consent}
                  </label>
                  <button
                    className="primary"
                    disabled={busy || !user || !aiAvailable}
                  >
                    <Sparkles size={16} />
                    {busy ? "Thinking…" : t.send}
                  </button>
                  {!user && (
                    <p className="small muted">
                      {he
                        ? "התחברו כדי להשתמש בשירות AI."
                        : "Sign in to use the AI service."}
                    </p>
                  )}
                </form>
              </article>
              <div>
                <article className="panel">
                  <Sparkles className="positive" />
                  <h3>{he ? "תובנות מקומיות" : "Local insights"}</h3>
                  <p className="muted">
                    {he ? "יתרה מחושבת" : "Recorded surplus"}:{" "}
                    {money(sum.balance)}
                  </p>
                  <p>
                    {he
                      ? "אפשרות חיסכון שמרנית"
                      : "Conservative savings capacity"}
                    :{" "}
                    <strong className="positive">
                      {money(Math.max(0, sum.balance) * 0.2)}
                    </strong>{" "}
                    / mo
                  </p>
                  <p className="small muted">
                    {he
                      ? "מחושב מקומית מנתוני החודש שנבחר."
                      : "Calculated locally from your selected month. No records leave the device for this insight."}
                  </p>
                </article>
                <article className="panel spaced">
                  <h3>
                    {he ? "כמה שעות זה עולה?" : "What does it cost in hours?"}
                  </h3>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget),
                        wage = Number(f.get("wage")),
                        price = Number(f.get("price"));
                      setMessage(
                        `${(price / wage).toFixed(1)} ${he ? "שעות עבודה ברוטו" : "gross work hours"} · ${he ? "לפני מסים וניכויים" : "before taxes and deductions"}`,
                      );
                    }}
                  >
                    <Field label={he ? "מחיר רכישה" : "Purchase price"}>
                      <input
                        name="price"
                        type="number"
                        min="0"
                        step="0.01"
                        required
                      />
                    </Field>
                    <Field label={he ? "שכר שעתי ברוטו" : "Gross hourly wage"}>
                      <input
                        name="wage"
                        type="number"
                        min="0.01"
                        step="0.01"
                        defaultValue={data.workplaces[0]?.wage}
                        required
                      />
                    </Field>
                    <button className="secondary">
                      {he ? "חישוב" : "Calculate"}
                    </button>
                  </form>
                </article>
              </div>
            </div>
          )}
          {tab === "settings" && (
            <div className="settings-grid">
              <article className="panel">
                <h2>{t.profile}</h2>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    void commit({
                      ...data,
                      profile: {
                        name: String(f.get("name")),
                        currency: f.get("currency") as "ILS",
                        language: f.get("language") as "en",
                        theme: f.get("theme") as "dark",
                      },
                    });
                  }}
                >
                  <Field label={t.name}>
                    <input
                      name="name"
                      maxLength={100}
                      defaultValue={data.profile.name}
                    />
                  </Field>
                  <Field label={he ? "מטבע" : "Display currency"}>
                    <select
                      name="currency"
                      defaultValue={data.profile.currency}
                    >
                      <option value="ILS">ILS · ₪</option>
                      <option value="USD">USD · $</option>
                      <option value="EUR">EUR · €</option>
                      <option value="GBP">GBP · £</option>
                    </select>
                  </Field>
                  <p className="small muted">
                    Changing currency changes display units only. SAVIO does not
                    convert exchange rates; keep all records in one currency.
                  </p>
                  <Field label="Language / שפה">
                    <select
                      name="language"
                      defaultValue={data.profile.language}
                    >
                      <option value="en">English</option>
                      <option value="he">עברית</option>
                    </select>
                  </Field>
                  <Field label={he ? "מראה" : "Appearance"}>
                    <select name="theme" defaultValue={data.profile.theme}>
                      <option value="dark">Dark</option>
                      <option value="light">Light</option>
                    </select>
                  </Field>
                  <button className="primary" disabled={busy}>
                    {t.save}
                  </button>
                </form>
              </article>
              <div>
                <article className="panel">
                  <h2>{he ? "הנתונים שלך" : "Your data, your control"}</h2>
                  <p className="muted">
                    {user
                      ? "Financial records are saved to your authenticated account."
                      : "Local records are saved in this browser. Signing in opens a separate account workspace. Export local records before switching."}
                  </p>
                  <button
                    className="secondary"
                    onClick={() =>
                      download(
                        "savio-data.json",
                        JSON.stringify(data, null, 2),
                        "application/json",
                      )
                    }
                  >
                    <Download size={16} />
                    {t.export}
                  </button>
                  <p className="small muted">
                    Exports contain personal financial records. Store them
                    privately.
                  </p>
                  <button
                    className="danger"
                    disabled={busy}
                    onClick={async () => {
                      if (
                        confirm("Delete all financial records permanently?")
                      ) {
                        const next = emptyData();
                        next.profile = data.profile;
                        if (await commit(next))
                          setMessage("All financial records deleted.");
                      }
                    }}
                  >
                    {he ? "מחיקת הנתונים" : "Delete all financial data"}
                  </button>
                </article>
                {user && <LegacyImport data={data} onSave={commit} />}
                <article className="panel spaced">
                  <h2>{he ? "החשבון שלך" : "Your account"}</h2>
                  {user ? (
                    <>
                      <p className="muted">{user.email}</p>
                      <button
                        className="secondary"
                        onClick={() =>
                          browserClient()
                            .auth.resetPasswordForEmail(user.email!, {
                              redirectTo:
                                location.origin +
                                "/auth/callback?type=recovery",
                            })
                            .then(({ error }) =>
                              setMessage(
                                error
                                  ? error.message
                                  : "Check your email for a password reset link.",
                              ),
                            )
                        }
                      >
                        Reset password
                      </button>
                      <button
                        className="danger"
                        disabled={busy}
                        onClick={async () => {
                          if (
                            !confirm(
                              "Permanently delete your account and all financial data?",
                            )
                          )
                            return;
                          setBusy(true);
                          try {
                            const res = await fetch("/api/account", {
                              method: "DELETE",
                            });
                            const result = await res.json();
                            if (!res.ok) throw new Error(result.error);
                            location.reload();
                          } catch (e) {
                            setMessage(
                              e instanceof Error
                                ? e.message
                                : "Deletion failed",
                            );
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        Delete account
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="muted">
                        {configured
                          ? "Sign in to save to your private account."
                          : "Cloud authentication requires Supabase configuration."}
                      </p>
                      <button
                        className="primary"
                        onClick={() => setEditor({ kind: "auth" })}
                      >
                        {t.login}
                      </button>
                    </>
                  )}
                </article>
              </div>
            </div>
          )}
          <footer>
            <span className="footer-brand">
              SAVIO<span>●</span>
            </span>
            <span>
              {he
                ? "בונים עתיד טוב יותר. צעד אחר צעד."
                : "Building a better future. One step at a time."}
            </span>
            <span>
              <span className="tiny-dot green" />
              {user ? "Account workspace" : "Private local workspace"}
            </span>
          </footer>
        </main>
      </div>
      {editor && (
        <Modal
          title={
            editor.kind === "auth"
              ? authMode === "register"
                ? "Create your account"
                : authMode === "reset"
                  ? "Reset password"
                  : t.login
              : editor.kind === "transaction"
                ? t.add
                : editor.kind === "goal"
                  ? t.newGoal
                  : editor.kind === "workplace"
                    ? t.workplace
                    : editor.kind === "contribution"
                      ? "Record a contribution"
                      : t.newShift
          }
          onClose={() => setEditor(null)}
        >
          <form onSubmit={submitEditor}>
            {message && (
              <p role="alert" className="notice">
                {message}
              </p>
            )}
            {editor.kind === "transaction" && (
              <>
                <Field label={t.title}>
                  <input
                    autoFocus
                    name="title"
                    maxLength={120}
                    defaultValue={editor.value?.title}
                    required
                  />
                </Field>
                <div className="form-grid">
                  <Field label={t.amount}>
                    <input
                      name="amount"
                      type="number"
                      min="0.01"
                      max="1000000000"
                      step="0.01"
                      defaultValue={editor.value?.amount}
                      required
                    />
                  </Field>
                  <Field label={t.type}>
                    <select
                      name="kind"
                      defaultValue={editor.value?.kind || "expense"}
                    >
                      <option value="expense">{t.expense}</option>
                      <option value="income">{t.incomeType}</option>
                    </select>
                  </Field>
                </div>
                <Field label={t.category}>
                  <select name="category" defaultValue={editor.value?.category}>
                    {categories.map((c) => (
                      <option value={c} key={c}>
                        {categoryLabel(c, he)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t.date}>
                  <input
                    name="date"
                    type="date"
                    defaultValue={editor.value?.date || today()}
                    required
                  />
                </Field>
                <label className="checkbox">
                  <input
                    name="recurring"
                    type="checkbox"
                    defaultChecked={editor.value?.recurring}
                  />
                  {t.recurring}
                </label>
              </>
            )}
            {editor.kind === "goal" && (
              <>
                <Field label={t.name}>
                  <input
                    name="name"
                    maxLength={100}
                    defaultValue={editor.value?.name}
                    required
                  />
                </Field>
                <div className="form-grid">
                  <Field label={he ? "סכום יעד" : "Target amount"}>
                    <input
                      name="target"
                      type="number"
                      min="0.01"
                      max="1000000000"
                      step="0.01"
                      defaultValue={editor.value?.target}
                      required
                    />
                  </Field>
                  <Field label={he ? "חיסכון קיים" : "Existing savings"}>
                    <input
                      name="existing"
                      type="number"
                      min="0"
                      max="1000000000"
                      step="0.01"
                      defaultValue={editor.value?.existing || 0}
                      required
                    />
                  </Field>
                </div>
                <Field
                  label={
                    he ? "הפקדה חודשית מתוכננת" : "Planned monthly contribution"
                  }
                >
                  <input
                    name="monthly"
                    type="number"
                    min="0"
                    max="1000000000"
                    step="0.01"
                    defaultValue={editor.value?.monthly || 0}
                    required
                  />
                </Field>
                <Field label={he ? "תאריך יעד" : "Target date"}>
                  <input
                    name="date"
                    type="date"
                    defaultValue={editor.value?.date || undefined}
                  />
                </Field>
              </>
            )}
            {editor.kind === "contribution" && (
              <>
                <p className="muted">
                  {editor.value.name} · This records a contribution, it does not
                  transfer money.
                </p>
                <Field label={t.amount}>
                  <input
                    name="amount"
                    type="number"
                    min="0.01"
                    max="1000000000"
                    step="0.01"
                    required
                  />
                </Field>
                <Field label={t.date}>
                  <input
                    name="date"
                    type="date"
                    defaultValue={today()}
                    required
                  />
                </Field>
              </>
            )}
            {editor.kind === "workplace" && (
              <>
                <Field label={t.name}>
                  <input
                    name="name"
                    defaultValue={editor.value?.name}
                    required
                    maxLength={100}
                  />
                </Field>
                <Field label={he ? "שכר שעתי ברוטו" : "Hourly wage (gross)"}>
                  <input
                    name="wage"
                    type="number"
                    min="0.01"
                    max="100000"
                    step="0.01"
                    defaultValue={editor.value?.wage}
                    required
                  />
                </Field>
                <p className="small muted">
                  Set the rules from your employment agreement. These defaults
                  are examples, not a universal Israeli payroll rule.
                </p>
                <div className="form-grid">
                  {(
                    [
                      {
                        key: "regularHours",
                        label: he
                          ? "שעות רגילות למשמרת"
                          : "Regular hours per shift",
                        value: 8,
                        max: 24,
                      },
                      {
                        key: "overtimeHours",
                        label: he
                          ? "שעות במדרגת שעות נוספות ראשונה"
                          : "First overtime tier hours",
                        value: 2,
                        max: 24,
                      },
                      {
                        key: "overtimeRate",
                        label: he
                          ? "מכפיל מדרגה ראשונה"
                          : "First tier multiplier",
                        value: 1.25,
                        max: 5,
                      },
                      {
                        key: "extraRate",
                        label: he
                          ? "מכפיל לשעות הנותרות"
                          : "Remaining hours multiplier",
                        value: 1.5,
                        max: 5,
                      },
                      {
                        key: "premiumRate",
                        label: he
                          ? "מכפיל סוף שבוע / חג"
                          : "Weekend / holiday multiplier",
                        value: 1.5,
                        max: 5,
                      },
                    ] as const
                  ).map((f) => (
                    <Field label={f.label} key={f.key}>
                      <input
                        name={f.key}
                        type="number"
                        min={f.key.includes("Hours") ? 0 : 1}
                        max={f.max}
                        step="0.01"
                        defaultValue={editor.value?.[f.key] ?? f.value}
                        required
                      />
                    </Field>
                  ))}
                </div>
              </>
            )}
            {editor.kind === "shift" && (
              <>
                {editor.value?.legacyGross !== undefined && (
                  <p className="notice">
                    {he
                      ? "משמרת זו שומרת אומדן היסטורי מיובא. שמירת עריכה תחשב אותו מחדש לפי הכללים הנוכחיים; בדקו את תוספות השכר."
                      : "This imported shift keeps its historical gross estimate. Saving edits recalculates it using current rules; review the premium setting."}
                  </p>
                )}
                <Field label={he ? "מקום עבודה" : "Workplace"}>
                  <select
                    name="workplaceId"
                    defaultValue={editor.value?.workplaceId}
                  >
                    {data.workplaces.map((w) => (
                      <option value={w.id} key={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={he ? "התחלה (זמן מקומי)" : "Start (local time)"}>
                  <input
                    name="start"
                    type="datetime-local"
                    defaultValue={
                      editor.value
                        ? localDateTime(editor.value.start)
                        : undefined
                    }
                    required
                  />
                </Field>
                <Field
                  label={
                    he
                      ? "סיום (בחרו את היום הבא למשמרת לילה)"
                      : "End (use next date for overnight shifts)"
                  }
                >
                  <input
                    name="end"
                    type="datetime-local"
                    defaultValue={
                      editor.value?.end
                        ? localDateTime(editor.value.end)
                        : undefined
                    }
                    required
                  />
                </Field>
                <Field label={he ? "דקות הפסקה" : "Break minutes"}>
                  <input
                    name="breakMinutes"
                    type="number"
                    min="0"
                    max="1440"
                    step="1"
                    defaultValue={editor.value?.breakMinutes || 0}
                    required
                  />
                </Field>
                <label className="checkbox">
                  <input
                    name="paidBreak"
                    type="checkbox"
                    defaultChecked={editor.value?.paidBreak}
                  />
                  {he ? "הפסקה בתשלום" : "Paid break"}
                </label>
                <label className="checkbox">
                  <input
                    name="premium"
                    type="checkbox"
                    defaultChecked={editor.value?.premium}
                  />
                  {he
                    ? "החלת תוספת סוף שבוע / חג של מקום העבודה"
                    : "Apply workplace weekend / holiday premium"}
                </label>
              </>
            )}
            {editor.kind === "auth" && (
              <>
                <p className="muted">
                  {configured
                    ? "Your financial data belongs to you."
                    : "Supabase is not configured. Local finance tools are available; cloud authentication requires environment settings."}
                </p>
                <Field label={he ? "אימייל" : "Email"}>
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    maxLength={254}
                  />
                </Field>
                {authMode !== "reset" && (
                  <Field label={he ? "סיסמה" : "Password"}>
                    <input
                      name="password"
                      type="password"
                      minLength={8}
                      maxLength={128}
                      autoComplete={
                        authMode === "register"
                          ? "new-password"
                          : "current-password"
                      }
                      required
                    />
                  </Field>
                )}
                <div className="button-row">
                  <button
                    type="button"
                    className="text-button"
                    onClick={() =>
                      setAuthMode(
                        authMode === "register" ? "login" : "register",
                      )
                    }
                  >
                    {authMode === "register"
                      ? "Already have an account?"
                      : "Create an account"}
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() =>
                      setAuthMode(authMode === "reset" ? "login" : "reset")
                    }
                  >
                    {authMode === "reset"
                      ? "Back to login"
                      : "Forgot password?"}
                  </button>
                </div>
              </>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setEditor(null)}
              >
                {t.cancel}
              </button>
              <button
                className="primary"
                disabled={busy || (editor.kind === "auth" && !configured)}
              >
                {busy
                  ? "Saving…"
                  : editor.kind === "auth"
                    ? "Continue"
                    : t.save}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {recovery && (
        <Modal title="Choose a new password" onClose={() => setRecovery(false)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              const password = String(
                new FormData(e.currentTarget).get("password"),
              );
              const { error } = await browserClient().auth.updateUser({
                password,
              });
              setBusy(false);
              if (error) setMessage(error.message);
              else {
                setRecovery(false);
                setMessage("Password updated.");
                history.replaceState(null, "", "/");
              }
            }}
          >
            <Field label={he ? "סיסמה חדשה" : "New password"}>
              <input
                name="password"
                type="password"
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
                required
              />
            </Field>
            <button className="primary" disabled={busy}>
              Update password
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
function localDateTime(iso: string) {
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
