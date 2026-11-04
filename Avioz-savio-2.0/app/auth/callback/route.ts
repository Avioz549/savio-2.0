import { NextResponse } from "next/server";
import { serverClient } from "@/lib/server";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (code) {
    const client = await serverClient();
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error)
      return NextResponse.redirect(
        new URL(
          url.searchParams.get("type") === "recovery"
            ? "/auth/reset?recovery=1"
            : "/",
          url.origin,
        ),
      );
  }
  return NextResponse.redirect(new URL("/?auth_error=1", url.origin));
}
