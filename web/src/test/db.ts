import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { it } from "vitest";
import type { Database } from "@/lib/database.types";

/**
 * Shared gate for `*.db.test.ts` files. Other issues should import `dbTest`
 * from here rather than opening their own client.
 *
 * Convention:
 * - `*.test.ts` — pure unit tests. `npm test` (`vitest run`). No database.
 * - `*.db.test.ts` — local Supabase. `npm run test:db`.
 *
 * A test skips (it does not fail) when the URL or service-role key is unset,
 * or when the API does not answer. The web app reads:
 * - `NEXT_PUBLIC_SUPABASE_URL`
 * - `SUPABASE_SERVICE_ROLE_KEY`
 * `supabase status -o env` prints `API_URL` and `SERVICE_ROLE_KEY`. Those
 * aliases are accepted so a status dump can be exported directly.
 *
 * Map them for a real run:
 *   NEXT_PUBLIC_SUPABASE_URL=$API_URL
 *   SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY
 * The anon key is not required for these service-role tests.
 */
export const DB_URL_ENV_NAMES = ["NEXT_PUBLIC_SUPABASE_URL", "API_URL"] as const;
export const DB_SERVICE_ROLE_ENV_NAMES = ["SUPABASE_SERVICE_ROLE_KEY", "SERVICE_ROLE_KEY"] as const;

function firstSet(names: readonly string[]): string | null {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return null;
}

let reachability: Promise<boolean> | null = null;

async function probe(url: string): Promise<"ok" | "down" | "starting"> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 2000);
  try {
    const res = await fetch(new URL("/auth/v1/health", url), { signal: ctrl.signal });
    // Right after `supabase db reset` the gateway answers before GoTrue has
    // restarted (502 "invalid response from upstream"). Treat that as starting.
    return res.ok ? "ok" : "starting";
  } catch {
    return "down";
  } finally {
    clearTimeout(timer);
  }
}

async function apiReachable(url: string): Promise<boolean> {
  if (!reachability) {
    reachability = (async () => {
      for (let attempt = 0; attempt < 15; attempt++) {
        const state = await probe(url);
        if (state === "ok") return true;
        if (state === "down") return false;
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      return false;
    })();
  }
  return reachability;
}

export function dbConfig(): { url: string; serviceRoleKey: string } | null {
  const url = firstSet(DB_URL_ENV_NAMES);
  const serviceRoleKey = firstSet(DB_SERVICE_ROLE_ENV_NAMES);
  if (!url || !serviceRoleKey) return null;
  return { url, serviceRoleKey };
}

/** Service-role client, or null when the stack should be skipped. */
export async function openServiceClient(): Promise<SupabaseClient<Database> | null> {
  const cfg = dbConfig();
  if (!cfg) return null;
  if (!(await apiReachable(cfg.url))) return null;
  return createClient<Database>(cfg.url, cfg.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * One integration test. Skips cleanly when `openServiceClient()` returns null.
 * The callback runs only with a live service-role client.
 */
export function dbTest(name: string, fn: (client: SupabaseClient<Database>) => Promise<void>): void {
  it(name, async (ctx) => {
    const client = await openServiceClient();
    if (!client) {
      ctx.skip();
      return;
    }
    await fn(client);
  });
}
