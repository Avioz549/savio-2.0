"use client";
import { useState } from "react";
import { Plus, Pencil, Trash2, Check, Bell } from "lucide-react";
import { monthTransactions, type FinanceData } from "@/lib/finance";
import { Field, Modal } from "./ui";
type Reminder = FinanceData["reminders"][number];
export function FinancialCalendar({
  data,
  month,
  money,
  onSave,
  busy,
}: {
  data: FinanceData;
  month: string;
  money: (n: number) => string;
  onSave: (d: FinanceData) => Promise<boolean | undefined>;
  busy: boolean;
}) {
  const he = data.profile.language === "he",
    tr = (en: string, heb: string) => (he ? heb : en);
  const [editing, setEditing] = useState<Reminder | null | undefined>(
      undefined,
    ),
    [notice, setNotice] = useState("");
  const records = monthTransactions(data.transactions, month);
  const [y, m] = month.split("-").map(Number);
  const offset = new Date(y, m - 1, 1).getDay(),
    days = new Date(y, m, 0).getDate();
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const r: Reminder = {
      id: editing?.id || crypto.randomUUID(),
      title: String(form.get("title")),
      date: String(form.get("date")),
      done: editing?.done || false,
    };
    if (
      await onSave({
        ...data,
        reminders: editing
          ? data.reminders.map((x) => (x.id === r.id ? r : x))
          : [...data.reminders, r],
      })
    )
      setEditing(undefined);
    else
      setNotice(
        tr(
          "Could not save. Check the title/date and resolve any workspace conflict before retrying.",
          "לא ניתן לשמור. בדקו כותרת ותאריך ופתרו התנגשות נתונים לפני ניסיון נוסף.",
        ),
      );
  }
  return (
    <>
      <article className="panel">
        <div className="panel-heading">
          <h2>{tr("Your financial calendar", "לוח השנה הכלכלי שלך")}</h2>
          <div className="button-row">
            <button
              className="secondary"
              onClick={async () => {
                try {
                  if (!("Notification" in window)) {
                    setNotice(
                      tr(
                        "Notifications are not supported in this browser.",
                        "הדפדפן אינו תומך בהתראות.",
                      ),
                    );
                    return;
                  }
                  const permission = await Notification.requestPermission();
                  setNotice(
                    permission === "granted"
                      ? tr(
                          "Foreground reminders enabled. Keep SAVIO open for due-date notifications.",
                          "התזכורות הופעלו. השאירו את SAVIO פתוח להתראות במועד.",
                        )
                      : tr(
                          "Notification permission was not granted.",
                          "לא ניתן אישור להתראות.",
                        ),
                  );
                } catch {
                  setNotice(
                    tr(
                      "This browser cannot show notifications. Your reminders are still in the calendar.",
                      "הדפדפן אינו יכול להציג התראות. התזכורות נשמרות בלוח השנה.",
                    ),
                  );
                }
              }}
            >
              <Bell size={15} />
              {tr("Enable reminders", "הפעלת תזכורות")}
            </button>
            <button className="primary" onClick={() => setEditing(null)}>
              <Plus size={15} />
              {tr("New reminder", "תזכורת חדשה")}
            </button>
          </div>
        </div>
        {notice && (
          <p role="status" className="notice">
            {notice}
          </p>
        )}
        <div className="calendar-grid calendar-week">
          <>
            {(he
              ? ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"]
              : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
            ).map((day) => (
              <div key={day} className="weekday">
                {day}
              </div>
            ))}
          </>
          {Array.from({ length: offset }, (_, i) => (
            <div key={"blank" + i} className="calendar-blank" />
          ))}
          {Array.from({ length: days }, (_, i) => {
            const date = `${month}-${String(i + 1).padStart(2, "0")}`;
            return (
              <div
                className={
                  "calendar-day " +
                  (new Date().toLocaleDateString("en-CA") === date
                    ? "today"
                    : "")
                }
                key={date}
              >
                <strong>{i + 1}</strong>
                {records
                  .filter((r) => r.date === date)
                  .map((r) => (
                    <span
                      className={r.kind === "income" ? "positive" : ""}
                      key={r.id}
                    >
                      {r.title}
                      <b>{money(r.amount)}</b>
                    </span>
                  ))}
                {data.reminders
                  .filter((r) => r.date === date)
                  .map((r) => (
                    <button
                      className={
                        "calendar-reminder " + (r.done ? "completed" : "")
                      }
                      key={r.id}
                      onClick={() => setEditing(r)}
                    >
                      {r.done ? "✓" : "◦"} {r.title}
                    </button>
                  ))}
              </div>
            );
          })}
        </div>
      </article>
      <article className="panel spaced">
        <h2>{tr("Reminders", "תזכורות")}</h2>
        {!data.reminders.length && (
          <p className="muted small spaced">
            {tr(
              "Add a reminder for rent, a bill, or a savings contribution.",
              "הוסיפו תזכורת לשכר דירה, חשבון או הפקדה לחיסכון.",
            )}
          </p>
        )}
        {[...data.reminders]
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((r) => (
            <div className="workplace" key={r.id}>
              <button
                className="icon-button"
                aria-label={tr(
                  "Mark reminder " + (r.done ? "incomplete" : "complete"),
                  "סימון תזכורת " + (r.done ? "כלא הושלמה" : "כהושלמה"),
                )}
                aria-pressed={r.done}
                disabled={busy}
                onClick={() =>
                  onSave({
                    ...data,
                    reminders: data.reminders.map((x) =>
                      x.id === r.id ? { ...x, done: !x.done } : x,
                    ),
                  })
                }
              >
                <Check size={18} className={r.done ? "positive" : ""} />
              </button>
              <div className={"grow " + (r.done ? "completed" : "")}>
                <strong>{r.title}</strong>
                <p>{r.date}</p>
              </div>
              <button
                className="icon-button"
                aria-label={tr("Edit reminder", "עריכת תזכורת")}
                onClick={() => setEditing(r)}
              >
                <Pencil size={15} />
              </button>
              <button
                className="icon-button"
                aria-label={tr("Delete reminder", "מחיקת תזכורת")}
                disabled={busy}
                onClick={() => {
                  if (confirm(tr("Delete this reminder?", "למחוק תזכורת זו?")))
                    void onSave({
                      ...data,
                      reminders: data.reminders.filter((x) => x.id !== r.id),
                    });
                }}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
      </article>
      {editing !== undefined && (
        <Modal
          title={
            editing
              ? tr("Edit reminder", "עריכת תזכורת")
              : tr("New reminder", "תזכורת חדשה")
          }
          onClose={() => setEditing(undefined)}
        >
          <form onSubmit={save}>
            {notice && (
              <p role="alert" className="notice">
                {notice}
              </p>
            )}
            <Field label={tr("Reminder title", "כותרת התזכורת")}>
              <input
                name="title"
                autoFocus
                required
                maxLength={120}
                defaultValue={editing?.title}
              />
            </Field>
            <Field label={tr("Due date", "תאריך יעד")}>
              <input
                name="date"
                type="date"
                required
                defaultValue={editing?.date || `${month}-01`}
              />
            </Field>
            <button className="primary" disabled={busy}>
              {tr("Save reminder", "שמירת תזכורת")}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
