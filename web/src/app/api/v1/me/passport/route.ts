import { error, isAuthContext, json, requireBearerAuth } from "@/lib/api/auth";

export async function GET(request: Request) {
  const auth = await requireBearerAuth(request);
  if (!isAuthContext(auth)) return auth;

  const [{ data: prefs }, { data: passengers }, { data: stamps }] = await Promise.all([
    auth.supabase
      .from("preferences")
      .select("*")
      .eq("customer_id", auth.userId)
      .maybeSingle(),
    auth.supabase
      .from("passenger_profiles")
      .select("*")
      .eq("customer_id", auth.userId)
      .order("created_at"),
    auth.supabase
      .from("passport_stamps")
      .select("*")
      .eq("customer_id", auth.userId)
      .order("created_at"),
  ]);

  return json({
    display_name: auth.profile.display_name,
    email: auth.profile.email,
    photo_url: auth.profile.photo_url,
    home_airport_id: prefs?.home_airport_id ?? null,
    typical_passengers: prefs?.typical_passengers ?? null,
    pets: prefs?.pets ?? false,
    wifi_preferred: prefs?.wifi_preferred ?? false,
    ski_golf: prefs?.ski_golf ?? false,
    aircraft_preferences: prefs?.aircraft_preferences ?? null,
    stamps: (stamps ?? []).map((s) => ({
      id: s.id,
      title: s.title,
      detail: s.detail,
      is_earned: s.is_earned,
    })),
    passengers: (passengers ?? []).map((p) => ({
      id: p.id,
      full_name: p.full_name,
      date_of_birth: p.date_of_birth,
      weight_lb: p.weight_lb,
    })),
  });
}

export async function PATCH(request: Request) {
  const auth = await requireBearerAuth(request);
  if (!isAuthContext(auth)) return auth;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return error("Invalid JSON");
  }

  if (typeof body.display_name === "string" || typeof body.photo_url === "string") {
    await auth.supabase
      .from("profiles")
      .update({
        display_name:
          typeof body.display_name === "string" ? body.display_name : auth.profile.display_name,
        photo_url:
          typeof body.photo_url === "string" ? body.photo_url : auth.profile.photo_url,
      })
      .eq("id", auth.userId);
  }

  const prefPayload = {
    customer_id: auth.userId,
    home_airport_id:
      typeof body.home_airport_id === "string" || body.home_airport_id === null
        ? (body.home_airport_id as string | null)
        : undefined,
    typical_passengers:
      typeof body.typical_passengers === "number" ? body.typical_passengers : undefined,
    pets: typeof body.pets === "boolean" ? body.pets : undefined,
    wifi_preferred: typeof body.wifi_preferred === "boolean" ? body.wifi_preferred : undefined,
    ski_golf: typeof body.ski_golf === "boolean" ? body.ski_golf : undefined,
    aircraft_preferences:
      typeof body.aircraft_preferences === "string" || body.aircraft_preferences === null
        ? (body.aircraft_preferences as string | null)
        : undefined,
  };

  const { data: existingPrefs } = await auth.supabase
    .from("preferences")
    .select("id")
    .eq("customer_id", auth.userId)
    .maybeSingle();

  if (existingPrefs) {
    await auth.supabase.from("preferences").update(prefPayload).eq("id", existingPrefs.id);
  } else {
    await auth.supabase.from("preferences").insert({
      customer_id: auth.userId,
      home_airport_id: (prefPayload.home_airport_id as string | null) ?? null,
      typical_passengers: prefPayload.typical_passengers ?? null,
      pets: prefPayload.pets ?? false,
      wifi_preferred: prefPayload.wifi_preferred ?? false,
      ski_golf: prefPayload.ski_golf ?? false,
      aircraft_preferences: prefPayload.aircraft_preferences ?? null,
    });
  }

  if (Array.isArray(body.passengers)) {
    await auth.supabase.from("passenger_profiles").delete().eq("customer_id", auth.userId);
    const rows = body.passengers
      .filter((p): p is Record<string, unknown> => !!p && typeof p === "object")
      .map((p) => ({
        customer_id: auth.userId,
        full_name: String(p.full_name ?? ""),
        date_of_birth: p.date_of_birth ? String(p.date_of_birth) : null,
        weight_lb: typeof p.weight_lb === "number" ? p.weight_lb : null,
      }))
      .filter((p) => p.full_name);
    if (rows.length) {
      await auth.supabase.from("passenger_profiles").insert(rows);
    }
  }

  return GET(request);
}
