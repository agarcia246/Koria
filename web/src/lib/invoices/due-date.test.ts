import { describe, expect, it } from "vitest";
import { invoiceDueDate } from "@/lib/invoices/create";

describe("invoiceDueDate", () => {
  const issued = new Date("2026-06-01T10:00:00.000Z");

  it("is two UTC days after issue when departure is later", () => {
    expect(invoiceDueDate("2026-06-20T15:00:00.000Z", issued)).toBe("2026-06-03");
  });

  it("is the departure day when that day is sooner than two days out", () => {
    expect(invoiceDueDate("2026-06-02T15:00:00.000Z", issued)).toBe("2026-06-02");
  });

  it("is the issue day when departure has already passed", () => {
    expect(invoiceDueDate("2026-05-20T15:00:00.000Z", issued)).toBe("2026-06-01");
  });

  it("is the issue day when departure is that same UTC day", () => {
    expect(invoiceDueDate("2026-06-01T23:00:00.000Z", issued)).toBe("2026-06-01");
  });
});
