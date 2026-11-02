import { describe, expect, it } from "vitest";
import { DELETE_BLOCKED_OPERATOR, DELETE_BLOCKED_TRIP, deletionBlock } from "@/lib/account";

type Trip = { status: string };

function countingClient(state: { members: number; trips: Trip[] }, error?: string) {
  return {
    from(table: string) {
      let statuses: string[] | null = null;
      const chain = {
        select: () => chain,
        eq: () => chain,
        in: (_column: string, values: string[]) => {
          statuses = values;
          return chain;
        },
        then: (resolve: (value: { count: number; error: { message: string } | null; data: null }) => void) => {
          if (error && table === "operator_members") {
            resolve({ count: 0, error: { message: error }, data: null });
            return;
          }
          if (table === "operator_members") {
            resolve({ count: state.members, error: null, data: null });
            return;
          }
          const count = state.trips.filter((trip) => (statuses ?? []).includes(trip.status)).length;
          resolve({ count, error: null, data: null });
        },
      };
      return chain;
    },
  } as unknown as Parameters<typeof deletionBlock>[0];
}

describe("deletionBlock", () => {
  it("blocks an operator member", async () => {
    const client = countingClient({ members: 1, trips: [{ status: "completed" }] });
    expect(await deletionBlock(client, "user-1")).toEqual({ ok: false, error: DELETE_BLOCKED_OPERATOR });
  });

  it.each(["awaiting_payment", "confirmed", "upcoming"])("blocks a %s trip", async (status) => {
    const client = countingClient({ members: 0, trips: [{ status }] });
    expect(await deletionBlock(client, "user-1")).toEqual({ ok: false, error: DELETE_BLOCKED_TRIP });
  });

  it("allows a customer whose trips are only completed or cancelled", async () => {
    const client = countingClient({
      members: 0,
      trips: [{ status: "completed" }, { status: "cancelled" }],
    });
    expect(await deletionBlock(client, "user-1")).toEqual({ ok: true });
  });

  it("still blocks when a closed trip sits next to an open one", async () => {
    const client = countingClient({
      members: 0,
      trips: [{ status: "completed" }, { status: "awaiting_payment" }],
    });
    expect(await deletionBlock(client, "user-1")).toEqual({ ok: false, error: DELETE_BLOCKED_TRIP });
  });

  it("returns the database error instead of allowing deletion", async () => {
    const client = countingClient({ members: 0, trips: [] }, "down");
    expect(await deletionBlock(client, "user-1")).toEqual({ ok: false, message: "down" });
  });
});
