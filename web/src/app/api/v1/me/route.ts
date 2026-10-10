import { error, isAuthContext, json, requireBearerAuth } from "@/lib/api/auth";

export async function GET(request: Request) {
  const auth = await requireBearerAuth(request);
  if (!isAuthContext(auth)) return auth;

  return json({
    id: auth.profile.id,
    name: auth.profile.display_name,
    email: auth.profile.email,
    role: auth.profile.role,
    access_status: auth.profile.access_status,
  });
}
