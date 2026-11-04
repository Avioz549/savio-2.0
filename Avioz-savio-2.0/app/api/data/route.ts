import { supabaseConfigured } from "@/lib/config";
import { NextResponse } from "next/server";
import { z } from "zod";
import { serverClient, sameOrigin } from "@/lib/server";
import { dataSchema, emptyData } from "@/lib/finance";
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
    const { data: row, error } = await client
      .from("finance_data")
      .select("data,revision")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error)
      return NextResponse.json(
        { error: "Apply the SAVIO schema upgrade before using cloud storage." },
        { status: 503 },
      );
    return NextResponse.json(
      {
        data: row ? dataSchema.parse(row.data) : emptyData(),
        revision: row?.revision ?? 0,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Could not load financial records. No records were changed." },
      { status: 502 },
    );
  }
}
export async function PUT(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
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
    const raw = await request.text();
    if (raw.length > 2000000)
      return NextResponse.json(
        { error: "Data limit exceeded" },
        { status: 413 },
      );
    let input;
    try {
      input = z
        .object({ data: dataSchema, revision: z.number().int().min(0) })
        .parse(JSON.parse(raw));
    } catch {
      return NextResponse.json(
        { error: "Financial records failed validation" },
        { status: 400 },
      );
    }
    const { data: revision, error } = await client.rpc(
      "save_finance_snapshot",
      { snapshot: input.data, expected_revision: input.revision },
    );
    if (error) {
      if (error.code === "40001")
        return NextResponse.json(
          {
            error:
              "Your records changed on another device. Reload before editing to avoid overwriting newer data.",
          },
          { status: 409 },
        );
      return NextResponse.json(
        { error: "Unable to save records. Check the database schema upgrade." },
        { status: 503 },
      );
    }
    return NextResponse.json({ saved: true, revision });
  } catch {
    return NextResponse.json(
      {
        error: "Could not save records. Retry after checking your connection.",
      },
      { status: 502 },
    );
  }
}
