"use client";
import { useState } from "react";
import { Download, Database } from "lucide-react";
import { dataSchema, type FinanceData } from "@/lib/finance";
import { Modal } from "./ui";
export function LegacyImport({
  data,
  onSave,
}: {
  data: FinanceData;
  onSave: (d: FinanceData) => Promise<boolean | undefined>;
}) {
  const [preview, setPreview] = useState<{
      data: FinanceData;
      warnings: string[];
      sourceCounts: Record<string, number>;
    } | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [consent, setConsent] = useState(false);
  const he = data.profile.language === "he",
    tr = (en: string, heb: string) => (he ? heb : en);
  async function load() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/import", { cache: "no-store" }),
        result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setPreview({ ...result, data: dataSchema.parse(result.data) });
      setConsent(false);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="panel spaced">
      <h2>
        {tr(
          "Import your original SAVIO records",
          "ייבוא הרשומות המקוריות של SAVIO",
        )}
      </h2>
      <p className="muted small spaced">
        {tr(
          "Preview records from the uploaded project’s Supabase tables. Originals remain untouched. Import explicitly replaces this account’s current workspace.",
          "תצוגה מקדימה של הרשומות מטבלאות Supabase של הפרויקט המקורי. המקור לא משתנה. ייבוא מחליף במפורש את סביבת העבודה הנוכחית של החשבון.",
        )}
      </p>
      <button className="secondary spaced" disabled={busy} onClick={load}>
        <Database size={16} />
        {busy
          ? tr("Loading…", "טוען…")
          : tr("Preview source import", "תצוגה מקדימה לייבוא")}
      </button>
      {message && (
        <p role="alert" className="notice">
          {message}
        </p>
      )}
      {preview && (
        <Modal
          title={tr("Review your import", "בדיקת הייבוא")}
          onClose={() => setPreview(null)}
        >
          {message && (
            <p role="alert" className="notice">
              {message}
            </p>
          )}
          <div className="import-counts">
            {Object.entries(preview.sourceCounts).map(([table, count]) => (
              <div className="flex-between small" key={table}>
                <span>{table}</span>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
          {preview.warnings.map((w) => (
            <p className="notice small" key={w}>
              {w}
            </p>
          ))}
          <p className="small muted">
            {tr(
              "Export your current workspace before replacing it. Original source tables are not deleted. After migration, use this app for new changes.",
              "ייצאו את סביבת העבודה לפני החלפתה. טבלאות המקור לא נמחקות. לאחר המעבר, בצעו שינויים חדשים באפליקציה זו.",
            )}
          </p>
          <button
            className="secondary spaced"
            onClick={() => {
              const url = URL.createObjectURL(
                new Blob([JSON.stringify(data, null, 2)], {
                  type: "application/json",
                }),
              );
              const a = document.createElement("a");
              a.href = url;
              a.download = "savio-before-import.json";
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <Download size={15} />
            {tr("Export current workspace", "ייצוא סביבת העבודה הנוכחית")}
          </button>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            {tr(
              "I reviewed the warnings and want to replace my current workspace.",
              "בדקתי את האזהרות וברצוני להחליף את סביבת העבודה הנוכחית.",
            )}
          </label>
          <button
            className="primary"
            disabled={!consent || busy}
            onClick={async () => {
              setBusy(true);
              if (await onSave(preview.data)) {
                setPreview(null);
                setMessage(
                  tr("Import saved successfully.", "הייבוא נשמר בהצלחה."),
                );
              } else
                setMessage(
                  tr(
                    "Import was not saved. Review the save error and retry.",
                    "הייבוא לא נשמר. בדקו את שגיאת השמירה ונסו שוב.",
                  ),
                );
              setBusy(false);
            }}
          >
            {tr("Import reviewed records", "ייבוא הרשומות שנבדקו")}
          </button>
        </Modal>
      )}
    </article>
  );
}
