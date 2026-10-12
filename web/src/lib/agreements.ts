import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * One server-side source for the operator agreement.
 * Counsel replaces `text` and bumps `version`. Acceptance is stored on the
 * operator. Existing active aircraft are not deactivated when the version changes.
 */
export const CURRENT_OPERATOR_AGREEMENT = {
  version: "2026-10-pending-counsel",
  text: "PENDING COUNSEL. The operator agrees that KORIA is an air charter broker and not the operator of the aircraft. The operator retains operational control of every flight it accepts through KORIA.",
} as const;

export const AGREEMENT_REQUIRED_MESSAGE =
  "An operator admin must accept the current operator agreement before an aircraft can be set active.";

export function agreementIsCurrent(version: string | null | undefined): boolean {
  return version === CURRENT_OPERATOR_AGREEMENT.version;
}

export async function operatorHasCurrentAgreement(
  supabase: SupabaseClient<Database>,
  operatorId: string,
): Promise<{ ok: true; current: boolean } | { ok: false; message: string }> {
  const { data, error } = await supabase
    .from("operators")
    .select("agreement_version")
    .eq("id", operatorId)
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  return { ok: true, current: agreementIsCurrent(data?.agreement_version) };
}
