import type { createServiceClient } from "@/lib/supabase/admin";
import type { PricingMode } from "@/lib/database.types";

type Service = ReturnType<typeof createServiceClient>;

export async function ownAircraftByTail(supabase: Service, operatorId: string, tailNumber: string) {
  const tail = tailNumber.trim().toUpperCase();
  const { data, error } = await supabase
    .from("aircraft")
    .select("id, tail_number, operator_id")
    .eq("operator_id", operatorId)
    .eq("tail_number", tail)
    .maybeSingle();
  if (error) return { error: error.message as string, aircraft: null };
  return { error: null, aircraft: data };
}

export async function airportIdByIcao(supabase: Service, icao: string | null | undefined) {
  const code = (icao ?? "").trim().toUpperCase();
  if (!code) return null;
  const { data } = await supabase.from("airports").select("id").eq("icao", code).maybeSingle();
  return data?.id ?? null;
}

export function pricingMode(value: unknown, fallback: PricingMode): PricingMode {
  if (value === "live" || value === "estimated" || value === "quote_required") return value;
  return fallback;
}
