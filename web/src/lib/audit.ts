import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database.types";
import { logError } from "@/lib/log";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type Client = SupabaseClient<Database>;

type Scalar = string | number | boolean | null;

export type AuditDiff = Record<string, { before: Scalar; after: Scalar }>;

type AuditInput = {
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  diff?: AuditDiff | null;
  requestId?: string | null;
  /**
   * Operator API key calls set this and skip the portal cookie.
   * A browser session must not be recorded as the actor for a key.
   */
  actorRole?: string | null;
  actorProfileId?: string | null;
};

const SENSITIVE_KEY =
  /api[_-]?key|key_hash|key_prefix|magic[_-]?link|invite[_-]?link|invite_code|token|password|secret|bank|iban|routing|account[_-]?number/i;

function isScalar(value: unknown): value is Scalar {
  return value === null || value === undefined || ["string", "number", "boolean"].includes(typeof value);
}

/** Changed scalars only. Sensitive keys and objects are dropped. */
export function scalarDiff(before: object | null, after: object): AuditDiff {
  const previous = before as Record<string, unknown> | null;
  const nextRow = after as Record<string, unknown>;
  const diff: AuditDiff = {};
  for (const key of Object.keys(nextRow)) {
    if (SENSITIVE_KEY.test(key)) continue;
    const next = nextRow[key];
    if (!isScalar(next)) continue;
    const afterScalar = next ?? null;
    const prev = previous ? previous[key] : null;
    const beforeScalar = previous ? (isScalar(prev) ? (prev ?? null) : null) : null;
    if (previous && Object.is(beforeScalar, afterScalar)) continue;
    diff[key] = { before: beforeScalar, after: afterScalar };
  }
  return diff;
}

function sanitizeDiff(diff: AuditDiff | null | undefined): AuditDiff | null {
  if (!diff) return null;
  const clean: AuditDiff = {};
  for (const [key, value] of Object.entries(diff)) {
    if (SENSITIVE_KEY.test(key)) continue;
    if (!value || typeof value !== "object") continue;
    if (!isScalar(value.before) || !isScalar(value.after)) continue;
    clean[key] = { before: value.before ?? null, after: value.after ?? null };
  }
  return Object.keys(clean).length ? clean : null;
}

async function userIdFrom(client: { auth: { getUser: () => Promise<{ data: { user: { id: string } | null } }> } }) {
  try {
    const { data } = await client.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

async function resolveActor(client: Client, input: AuditInput): Promise<{ profileId: string | null; role: string | null }> {
  if (input.actorRole !== undefined || input.actorProfileId !== undefined) {
    return { profileId: input.actorProfileId ?? null, role: input.actorRole ?? null };
  }

  let profileId = await userIdFrom(client);
  if (!profileId) {
    try {
      profileId = await userIdFrom(await createClient());
    } catch {
      profileId = null;
    }
  }
  if (!profileId) return { profileId: null, role: null };

  const service = createServiceClient();
  const { data } = await service.from("profiles").select("role").eq("id", profileId).maybeSingle();
  return { profileId, role: data?.role ?? null };
}

/**
 * Inserts one audit row with the service role. Never throws.
 * A portal session on `client` (or the cookie session, for service-role callers)
 * supplies the actor. Operator API callers pass actorRole instead.
 */
export async function recordAudit(client: Client, input: AuditInput): Promise<void> {
  try {
    const actor = await resolveActor(client, input);
    const service = createServiceClient();
    const { error } = await service.from("audit_events").insert({
      actor_profile_id: actor.profileId,
      actor_role: actor.role,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId,
      summary: input.summary,
      diff: sanitizeDiff(input.diff) as Json,
      request_id: input.requestId ?? null,
    });
    if (error) {
      logError("audit_write_failed", {
        table: "audit_events",
        message: error.message,
        ...(input.requestId ? { request_id: input.requestId } : {}),
      });
    }
  } catch (err) {
    logError("audit_write_failed", {
      table: "audit_events",
      message: err instanceof Error ? err.message : "audit write failed",
      ...(input.requestId ? { request_id: input.requestId } : {}),
    });
  }
}
