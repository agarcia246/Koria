import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type Client = SupabaseClient<Database>;

export type FeeResolution = {
  platformFeeAmount: number;
  source: "booking" | "operator_default" | "operator_rule" | "global";
  bps: number | null;
  fixedAmount: number | null;
};

/**
 * Resolve KORIA platform fee from platform_fee_rules.
 * Order: booking override → operator.default_fee_bps → operator-scoped rule → global rule.
 * Never hard-code a fee percentage in application logic.
 */
export async function resolvePlatformFee(
  client: Client,
  args: {
    operatorAmount: number;
    operatorId: string;
    bookingId?: string | null;
    at?: Date;
  },
): Promise<FeeResolution> {
  const at = args.at ?? new Date();
  const atIso = at.toISOString();

  if (args.bookingId) {
    const { data: bookingRule } = await client
      .from("platform_fee_rules")
      .select("*")
      .eq("scope", "booking")
      .eq("booking_id", args.bookingId)
      .lte("effective_from", atIso)
      .or(`effective_to.is.null,effective_to.gte.${atIso}`)
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (bookingRule) {
      return applyRule(args.operatorAmount, bookingRule.bps, bookingRule.fixed_amount, "booking");
    }
  }

  const { data: operator } = await client
    .from("operators")
    .select("default_fee_bps")
    .eq("id", args.operatorId)
    .maybeSingle();

  if (operator?.default_fee_bps != null) {
    return applyRule(args.operatorAmount, operator.default_fee_bps, null, "operator_default");
  }

  const { data: operatorRule } = await client
    .from("platform_fee_rules")
    .select("*")
    .eq("scope", "operator")
    .eq("operator_id", args.operatorId)
    .lte("effective_from", atIso)
    .or(`effective_to.is.null,effective_to.gte.${atIso}`)
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (operatorRule) {
    return applyRule(
      args.operatorAmount,
      operatorRule.bps,
      operatorRule.fixed_amount,
      "operator_rule",
    );
  }

  const { data: globalRule } = await client
    .from("platform_fee_rules")
    .select("*")
    .eq("scope", "global")
    .lte("effective_from", atIso)
    .or(`effective_to.is.null,effective_to.gte.${atIso}`)
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (globalRule) {
    return applyRule(args.operatorAmount, globalRule.bps, globalRule.fixed_amount, "global");
  }

  return {
    platformFeeAmount: 0,
    source: "global",
    bps: null,
    fixedAmount: null,
  };
}

function applyRule(
  operatorAmount: number,
  bps: number | null,
  fixedAmount: number | null,
  source: FeeResolution["source"],
): FeeResolution {
  let platformFeeAmount = 0;
  if (fixedAmount != null) {
    platformFeeAmount = Number(fixedAmount);
  } else if (bps != null) {
    platformFeeAmount = (operatorAmount * bps) / 10000;
  }
  return {
    platformFeeAmount: Math.round(platformFeeAmount * 100) / 100,
    source,
    bps,
    fixedAmount,
  };
}
