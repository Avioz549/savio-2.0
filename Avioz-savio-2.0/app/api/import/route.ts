import { supabaseConfigured } from "@/lib/config";
import { NextResponse } from "next/server";
import { serverClient } from "@/lib/server";
import { convertLegacy, legacyTables, type LegacyTables } from "@/lib/legacy";
export async function GET() {
  if (!supabaseConfigured())
    return NextResponse.json(
      { error: "Cloud storage is not configured" },
      { status: 503 },
    );
  try {
    const client = await serverClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    const results = await Promise.all(
      legacyTables.map(async (table) => {
        const data: Record<string, unknown>[] = [];
        let count: number | null = null;
        while (count === null || data.length < count) {
          const result = await client
            .from(table)
            .select("*", { count: "exact" })
            .eq("user_id", user.id)
            .order(table === "profiles" ? "user_id" : "id")
            .range(data.length, data.length + 999);
          if (result.error) return { table, data: null, error: result.error };
          if (result.count === null) throw new Error("Missing source count");
          if (count !== null && count !== result.count)
            throw new Error("Source changed during import");
          count = result.count;
          if (count > 10000)
            return { table, data: Array(10001).fill({}), error: null };
          if (!result.data.length && data.length < count)
            throw new Error("Incomplete source");
          data.push(...result.data);
        }
        return { table, data, error: null };
      }),
    );
    if (results.some((r) => r.error))
      return NextResponse.json(
        {
          error:
            "Could not read all source tables. Import was cancelled; no data was changed. Apply the uploaded schema if importing an existing installation.",
        },
        { status: 503 },
      );
    if (results.some((r) => r.data!.length > 10000))
      return NextResponse.json(
        {
          error:
            "The source exceeds the safe import limit. Export and migrate it with an administrator.",
        },
        { status: 413 },
      );
    const tables = Object.fromEntries(
      results.map((r) => [r.table, r.data]),
    ) as LegacyTables;
    const converted = convertLegacy(
      tables,
      new Date().toISOString().slice(0, 10),
    );
    return NextResponse.json(
      {
        ...converted,
        sourceCounts: Object.fromEntries(
          results.map((r) => [r.table, r.data!.length]),
        ),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "Source records failed validation. Correct the original data before importing; no data was changed.",
      },
      { status: 422 },
    );
  }
}
