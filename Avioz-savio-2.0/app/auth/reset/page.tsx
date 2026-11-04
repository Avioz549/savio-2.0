import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; recovery?: string }>;
}) {
  const params = await searchParams;
  if (params.code)
    redirect(
      "/auth/callback?type=recovery&code=" + encodeURIComponent(params.code),
    );
  return <AuthForm mode="reset" recovery={params.recovery === "1"} />;
}
