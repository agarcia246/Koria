import { beforeEach, describe, expect, it, vi } from "vitest";

const scheduled: Array<() => unknown> = [];

vi.mock("next/server", () => ({
  after: (callback: () => unknown) => {
    scheduled.push(callback);
  },
}));

vi.mock("@/lib/notifications/notify", () => ({
  notify: vi.fn(),
}));

import { enqueueNotification } from "@/lib/notifications/enqueue";
import { notify } from "@/lib/notifications/notify";

describe("enqueueNotification", () => {
  beforeEach(() => {
    scheduled.length = 0;
    vi.mocked(notify).mockReset();
  });

  it("hands after() the notify promise so the host waits for the email", async () => {
    let finish!: () => void;
    const sending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    vi.mocked(notify).mockReturnValue(sending);

    enqueueNotification("invoice_issued", { tripId: "trip-1", invoiceId: "inv-1" });

    expect(scheduled).toHaveLength(1);
    const returned = scheduled[0]();
    expect(returned).toBe(sending);
    expect(notify).toHaveBeenCalledWith("invoice_issued", { tripId: "trip-1", invoiceId: "inv-1" });
    finish();
    await returned;
  });
});
