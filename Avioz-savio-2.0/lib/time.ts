export function elapsedLabel(start: string, now: Date) {
  const seconds = Math.max(
    0,
    Math.floor((now.getTime() - Date.parse(start)) / 1000),
  );
  return [
    Math.floor(seconds / 3600),
    Math.floor(seconds / 60) % 60,
    seconds % 60,
  ]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
}

// Payroll month follows the same browser-local timezone used to display shifts.
export function localMonth(iso: string) {
  const date = new Date(iso);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
