import { supabaseConfigured } from "@/lib/config";
import { NextResponse } from "next/server";
import { serverClient, sameOrigin } from "@/lib/server";
export async function DELETE(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  if (!supabaseConfigured())
    return NextResponse.json(
      { error: "Cloud authentication is not configured" },
      { status: 503 },
    );
  try {
    const client = await serverClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    const { error } = await client.rpc("delete_my_account");
    if (error)
      return NextResponse.json(
        {
          error:
            error.code === "P0001"
              ? "Please wait before retrying."
              : "Deletion failed. Check the schema upgrade and retry.",
        },
        { status: error.code === "P0001" ? 429 : 503 },
      );
    await client.auth.signOut();
    return NextResponse.json({ deleted: true });
  } catch {
    return NextResponse.json(
      { error: "Account deletion is temporarily unavailable" },
      { status: 502 },
    );
  }
}
