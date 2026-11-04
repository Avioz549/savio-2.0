import { test } from "node:test";
import assert from "node:assert/strict";
import { validSupabaseUrl } from "../lib/config";
test("requires a full HTTPS project URL and allows local Supabase development", () => {
  assert.equal(validSupabaseUrl("savio.com"), false);
  assert.equal(validSupabaseUrl("https://project.supabase.co"), true);
  assert.equal(validSupabaseUrl("http://example.com"), false);
  assert.equal(validSupabaseUrl("http://127.0.0.1:54321"), true);
  assert.equal(validSupabaseUrl(undefined), false);
});
