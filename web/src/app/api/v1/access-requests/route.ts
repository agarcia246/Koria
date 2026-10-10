import { error, isAuthContext, json, requireBearerAuth } from "@/lib/api/auth";

export async function POST(request: Request) {
  const auth = await requireBearerAuth(request);
  if (!isAuthContext(auth)) return auth;

  let note: string | undefined;
  try {
    const body = await request.json();
    note = body?.note;
  } catch {
    // optional body
  }

  const email = auth.email ?? auth.profile.email;
  if (!email) return error("Email required", 400);

  const { data: existing } = await auth.supabase
    .from("access_requests")
    .select("*")
    .eq("user_id", auth.userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing && existing.status === "requested") {
    await auth.supabase
      .from("access_requests")
      .update({ note: note ?? existing.note })
      .eq("id", existing.id);
  } else if (!existing || existing.status === "declined") {
    await auth.supabase.from("access_requests").insert({
      user_id: auth.userId,
      email,
      note: note ?? null,
      status: "requested",
    });
    await auth.supabase
      .from("profiles")
      .update({ access_status: "requested" })
      .eq("id", auth.userId);
  }

  const { data: profile } = await auth.supabase
    .from("profiles")
    .select("access_status")
    .eq("id", auth.userId)
    .single();

  return json({ access_status: profile?.access_status ?? "requested" });
}
