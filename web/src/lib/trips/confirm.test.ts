import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/lib/database.types";
import { enqueueNotification } from "@/lib/notifications/enqueue";
import { confirmTripAfterPayment } from "@/lib/trips/confirm";

vi.mock("@/lib/notifications/enqueue", () => ({
  enqueueNotification: vi.fn(),
}));

function fakeClient(tripStatus: string) {
  const updates: { table: string; values: Record<string, unknown> }[] = [];
  const client = {
    from(table: string) {
      let operation = "select";
      let values: Record<string, unknown> = {};
      const chain = {
        select: () => chain,
        eq: () => chain,
        update(next: Record<string, unknown>) {
          operation = "update";
          values = next;
          return chain;
        },
        maybeSingle: async () => {
          if (table === "bookings") {
            return { data: { id: "b1", trip_request_id: "t1", quote_id: "q1" }, error: null };
          }
          if (table === "trip_requests") return { data: { id: "t1", status: tripStatus }, error: null };
          if (table === "quotes") return { data: { operator_id: "op1" }, error: null };
          return { data: null, error: null };
        },
        then: (resolve: (value: { error: null }) => void) => {
          if (operation === "update") updates.push({ table, values });
          resolve({ error: null });
        },
      };
      return chain;
    },
  } as unknown as SupabaseClient<Database>;
  return { client, updates };
}

describe("confirmTripAfterPayment", () => {
  beforeEach(() => {
    vi.mocked(enqueueNotification).mockClear();
  });

  it("confirms the booking and trip and enqueues booking_confirmed", async () => {
    const { client, updates } = fakeClient("awaiting_payment");
    const result = await confirmTripAfterPayment(client, "b1");
    expect(result).toEqual({ ok: true, tripId: "t1" });
    expect(updates).toEqual([
      { table: "bookings", values: { status: "confirmed" } },
      { table: "trip_requests", values: { status: "confirmed" } },
    ]);
    expect(enqueueNotification).toHaveBeenCalledWith("booking_confirmed", { tripId: "t1", operatorId: "op1" });
  });

  it("does not enqueue when the trip cannot move to confirmed", async () => {
    const { client, updates } = fakeClient("requested");
    await expect(confirmTripAfterPayment(client, "b1")).rejects.toThrow(/Invalid trip transition/);
    expect(updates).toEqual([]);
    expect(enqueueNotification).not.toHaveBeenCalled();
  });
});
