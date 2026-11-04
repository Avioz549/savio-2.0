"use client";
import { useEffect } from "react";
import { monthTransactions, type Transaction } from "./finance";
// Foreground reminders only. No financial amounts or descriptions enter notifications.
export function useReminders(
  transactions: Transaction[],
  reminders: { date: string; done: boolean }[],
  accountId: string,
  ready: boolean,
) {
  useEffect(() => {
    if (!ready) return;
    const check = () => {
      if (!("Notification" in window) || Notification.permission !== "granted")
        return;
      const today = new Date().toLocaleDateString("en-CA");
      const due = monthTransactions(transactions, today.slice(0, 7)).filter(
        (t) => t.kind === "expense" && t.date === today,
      );
      const reminderCount = reminders.filter(
        (r) => !r.done && r.date === today,
      ).length;
      if (!due.length && !reminderCount) return;
      const key = `savio-reminder:${accountId}:${today}`;
      try {
        if (localStorage.getItem(key)) return;
        new Notification("SAVIO · Payment reminder", {
          body: `You have ${due.length} recorded payment(s) and ${reminderCount} reminder(s) today. Review your financial calendar.`,
          tag: "savio-due-payments",
          icon: "/icon.svg",
        });
        localStorage.setItem(key, "sent");
      } catch {
        /* Notification support and storage availability vary by browser. */
      }
    };
    check();
    const timer = setInterval(check, 60000);
    return () => clearInterval(timer);
  }, [transactions, reminders, accountId, ready]);
}
