export function validSupabaseUrl(value: string | undefined) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" ||
      ((url.hostname === "localhost" || url.hostname === "127.0.0.1") &&
        url.protocol === "http:")
    );
  } catch {
    return false;
  }
}
export function supabaseConfigured() {
  return (
    validSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  );
}
