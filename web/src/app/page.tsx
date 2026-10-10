import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CompleteSignIn } from "@/app/complete-sign-in";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const params = await searchParams;
  if (params.code) {
    return <CompleteSignIn />;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role === "admin") redirect("/admin");
  if (profile?.role === "operator") redirect("/operator");
  redirect("/login?error=customer_no_portal");
}
