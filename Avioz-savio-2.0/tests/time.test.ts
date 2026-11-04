import { test } from "node:test";
import assert from "node:assert/strict";
import { elapsedLabel } from "../lib/time";
test("shift timer does not wrap after 24 hours", () => {
  assert.equal(
    elapsedLabel("2026-01-01T00:00:00Z", new Date("2026-01-02T02:03:04Z")),
    "26:03:04",
  );
});
test("timer clamps future start times at zero", () => {
  assert.equal(
    elapsedLabel("2027-01-01T00:00:00Z", new Date("2026-01-01T00:00:00Z")),
    "00:00:00",
  );
});

test("payroll month uses the displayed local date near a UTC boundary", async () => {
  const { localMonth } = await import("../lib/time");
  const date = new Date("2026-10-31T23:30:00Z");
  assert.equal(
    localMonth(date.toISOString()),
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
  );
});
