import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function requireOperatorContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberships } = await supabase
    .from("operator_members")
    .select("operator_id")
    .eq("profile_id", user.id);

  const operatorId = memberships?.[0]?.operator_id ?? null;
  if (!operatorId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.role === "admin") {
      return { supabase, userId: user.id, operatorId: null as string | null, isAdmin: true };
    }
    redirect("/login");
  }

  return {
    supabase,
    userId: user.id,
    operatorId: operatorId as string,
    isAdmin: false,
  };
}
