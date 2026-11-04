"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Globe, ShieldCheck } from "lucide-react";
import { configured, browserClient } from "@/lib/supabase";
import { Field } from "./ui";
export function AuthForm({
  mode,
  recovery = false,
}: {
  mode: "login" | "register" | "reset";
  recovery?: boolean;
}) {
  const [he, setHe] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [failed, setFailed] = useState(false);
  const router = useRouter();
  const tr = (en: string, heb: string) => (he ? heb : en);
  const title =
    mode === "register"
      ? tr("Your future starts here.", "העתיד שלך מתחיל כאן.")
      : mode === "reset"
        ? tr(
            recovery ? "Choose a new password." : "Let’s get you back in.",
            "בואו נחזיר אותך לחשבון.",
          )
        : tr("Welcome back.", "טוב שחזרת.");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setMessage("");
    setBusy(true);
    setFailed(false);
    try {
      if (!configured)
        throw new Error(
          tr(
            "Authentication is not configured. Add your Supabase project settings.",
            "שירות ההתחברות אינו מוגדר. יש להגדיר את פרויקט Supabase.",
          ),
        );
      const client = browserClient();
      const email = String(f.get("email") || ""),
        password = String(f.get("password") || "");
      if (mode === "login") {
        const { error } = await client.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push("/dashboard");
        router.refresh();
      } else if (mode === "register") {
        const { error } = await client.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: location.origin + "/auth/callback" },
        });
        if (error) throw error;
        setMessage(
          tr(
            "Check your email to verify your account, then sign in.",
            "בדקו את האימייל לאימות החשבון ולאחר מכן התחברו.",
          ),
        );
      } else if (recovery) {
        const {
          data: { user },
          error: sessionError,
        } = await client.auth.getUser();
        if (sessionError || !user)
          throw new Error(
            tr(
              "The recovery link expired. Request a new link.",
              "קישור האיפוס פג תוקף. בקשו קישור חדש.",
            ),
          );
        const { error } = await client.auth.updateUser({ password });
        if (error) throw error;
        await client.auth.signOut();
        setMessage(
          tr(
            "Password updated. You can now sign in.",
            "הסיסמה עודכנה. אפשר להתחבר כעת.",
          ),
        );
      } else {
        const { error } = await client.auth.resetPasswordForEmail(email, {
          redirectTo: location.origin + "/auth/callback?type=recovery",
        });
        if (error) throw error;
        setMessage(
          tr(
            "If this account exists, a reset link has been sent.",
            "אם החשבון קיים, נשלח קישור לאיפוס הסיסמה.",
          ),
        );
      }
    } catch (error) {
      setFailed(true);
      setMessage(
        error instanceof Error
          ? error.message
          : tr("Unable to connect. Try again.", "לא ניתן להתחבר. נסו שוב."),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main
      className="auth-page"
      dir={he ? "rtl" : "ltr"}
      lang={he ? "he" : "en"}
    >
      <section className="auth-story">
        <Link className="brand" href="/">
          SAVIO<span>●</span>
        </Link>
        <div>
          <p className="eyebrow">YOUR MONEY. YOUR FUTURE.</p>
          <h1>
            {tr(
              "A clearer view.\nA brighter future.",
              "תמונה ברורה.\nעתיד טוב יותר.",
            )}
          </h1>
          <p>
            {tr(
              "Make space for what matters. Build your financial life, one thoughtful step at a time.",
              "מפנים מקום למה שחשוב. בונים את החיים הכלכליים, צעד חכם אחד בכל פעם.",
            )}
          </p>
        </div>
        <p>הכסף שלך. העתיד שלך.</p>
      </section>
      <section className="auth-main">
        <div className="auth-top">
          <Link href="/" className="text-button">
            <ArrowLeft size={16} />
            {tr("Your workspace", "לסביבת העבודה")}
          </Link>
          <button
            className="icon-button"
            aria-label="Change language"
            onClick={() => setHe(!he)}
          >
            <Globe size={17} />
            {he ? "English" : "עברית"}
          </button>
        </div>
        <div className="auth-card">
          <span className="stat-icon green">
            <ShieldCheck size={22} />
          </span>
          <h2>{title}</h2>
          <p className="muted">
            {tr(
              "Your money. Your future. Your private account.",
              "הכסף שלך. העתיד שלך. החשבון הפרטי שלך.",
            )}
          </p>
          {!configured && (
            <p className="notice">
              {tr(
                "Cloud authentication is unavailable until Supabase is configured. Local finance tools remain available.",
                "התחברות לענן זמינה לאחר הגדרת Supabase. הכלים המקומיים זמינים כבר עכשיו.",
              )}
            </p>
          )}
          <form onSubmit={submit}>
            {!recovery && (
              <Field label={tr("Email", "אימייל")}>
                <input
                  name="email"
                  type="email"
                  maxLength={254}
                  autoComplete="email"
                  required
                />
              </Field>
            )}
            {(mode !== "reset" || recovery) && (
              <Field label={tr("Password", "סיסמה")}>
                <input
                  name="password"
                  type="password"
                  minLength={8}
                  maxLength={128}
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  required
                />
              </Field>
            )}
            {message && (
              <p
                role={failed ? "alert" : "status"}
                className={"notice " + (failed ? "danger" : "")}
              >
                {message}
              </p>
            )}
            <button className="primary full" disabled={busy || !configured}>
              {busy
                ? tr("Please wait…", "רק רגע…")
                : mode === "login"
                  ? tr("Sign in", "התחברות")
                  : mode === "register"
                    ? tr("Create account", "יצירת חשבון")
                    : recovery
                      ? tr("Update password", "עדכון סיסמה")
                      : tr("Send reset link", "שליחת קישור לאיפוס")}
            </button>
          </form>
          <div className="auth-links">
            <Link href={mode === "register" ? "/login" : "/register"}>
              {mode === "register"
                ? tr("Already have an account? Sign in", "כבר יש חשבון? התחברו")
                : tr("Create an account", "יצירת חשבון")}
            </Link>
            <Link href={mode === "reset" ? "/login" : "/auth/reset"}>
              {mode === "reset"
                ? tr("Back to sign in", "חזרה להתחברות")
                : tr("Forgot password?", "שכחתם סיסמה?")}
            </Link>
          </div>
          <p className="small muted">
            {tr(
              "We never ask for your bank login. Your records belong to you.",
              "לעולם לא נבקש את פרטי הכניסה לבנק. הנתונים שלכם שייכים לכם.",
            )}
          </p>
        </div>
      </section>
    </main>
  );
}
