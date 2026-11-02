import { describe, expect } from "vitest";
import { resolvePlatformFee } from "@/lib/fees";
import { dbTest } from "@/test/db";
import { createMoneyBooking, createOperator } from "@/test/fixtures";

const operatorAmount = 10_000;

describe("resolvePlatformFee", () => {
  dbTest("booking rule beats operator default, operator rule, and the global rule", async (client) => {
    const fx = await createMoneyBooking(client, { withInvoice: false });
    await client.from("operators").update({ default_fee_bps: 800 }).eq("id", fx.operatorId);
    const operatorRule = await client.from("platform_fee_rules").insert({
      scope: "operator",
      operator_id: fx.operatorId,
      bps: 1_200,
      effective_from: "2020-01-01T00:00:00.000Z",
    });
    const bookingRule = await client.from("platform_fee_rules").insert({
      scope: "booking",
      booking_id: fx.bookingId,
      bps: 500,
      effective_from: "2020-01-01T00:00:00.000Z",
    });
    if (operatorRule.error || bookingRule.error) {
      throw new Error(operatorRule.error?.message ?? bookingRule.error?.message);
    }

    const fee = await resolvePlatformFee(client, { operatorAmount, operatorId: fx.operatorId, bookingId: fx.bookingId });
    expect(fee).toEqual({ platformFeeAmount: 500, source: "booking", bps: 500, fixedAmount: null });
  });

  dbTest("prefers fixed_amount over bps on the winning rule", async (client) => {
    const fx = await createMoneyBooking(client, { withInvoice: false });
    const inserted = await client.from("platform_fee_rules").insert({
      scope: "booking",
      booking_id: fx.bookingId,
      bps: 500,
      fixed_amount: 250,
      effective_from: "2020-01-01T00:00:00.000Z",
    });
    if (inserted.error) throw new Error(inserted.error.message);
    const fee = await resolvePlatformFee(client, { operatorAmount, operatorId: fx.operatorId, bookingId: fx.bookingId });
    expect(fee).toMatchObject({ platformFeeAmount: 250, source: "booking", bps: 500, fixedAmount: 250 });
  });

  dbTest("operator default_fee_bps beats an operator rule and the global rule", async (client) => {
    const operator = await createOperator(client, { defaultFeeBps: 800 });
    const inserted = await client.from("platform_fee_rules").insert({
      scope: "operator",
      operator_id: operator.id,
      bps: 2_000,
      effective_from: "2020-01-01T00:00:00.000Z",
    });
    if (inserted.error) throw new Error(inserted.error.message);
    const fee = await resolvePlatformFee(client, { operatorAmount, operatorId: operator.id });
    expect(fee).toEqual({ platformFeeAmount: 800, source: "operator_default", bps: 800, fixedAmount: null });
  });

  dbTest("an operator rule beats the seeded global 1000 bps rule", async (client) => {
    const operator = await createOperator(client);
    const inserted = await client.from("platform_fee_rules").insert({
      scope: "operator",
      operator_id: operator.id,
      bps: 2_000,
      effective_from: "2020-01-01T00:00:00.000Z",
    });
    if (inserted.error) throw new Error(inserted.error.message);
    const fee = await resolvePlatformFee(client, { operatorAmount, operatorId: operator.id });
    expect(fee).toEqual({ platformFeeAmount: 2_000, source: "operator_rule", bps: 2_000, fixedAmount: null });
  });

  dbTest("uses the seeded global rule when the operator has nothing of its own", async (client) => {
    const operator = await createOperator(client);
    const fee = await resolvePlatformFee(client, { operatorAmount, operatorId: operator.id });
    expect(fee).toEqual({ platformFeeAmount: 1_000, source: "global", bps: 1_000, fixedAmount: null });
  });

  dbTest("an expired operator rule does not hide the global rule", async (client) => {
    const operator = await createOperator(client);
    const inserted = await client.from("platform_fee_rules").insert({
      scope: "operator",
      operator_id: operator.id,
      bps: 9_000,
      effective_from: "2020-01-01T00:00:00.000Z",
      effective_to: "2020-02-01T00:00:00.000Z",
    });
    if (inserted.error) throw new Error(inserted.error.message);
    const fee = await resolvePlatformFee(client, { operatorAmount, operatorId: operator.id });
    expect(fee).toEqual({ platformFeeAmount: 1_000, source: "global", bps: 1_000, fixedAmount: null });
  });

  dbTest("returns 0 when no rule is in effect", async (client) => {
    const operator = await createOperator(client);
    const fee = await resolvePlatformFee(client, {
      operatorAmount,
      operatorId: operator.id,
      at: new Date("1999-01-01T00:00:00.000Z"),
    });
    // Current behaviour: no warning. source stays "global" and bps is null.
    // FeeResolution has no warning field, so a missing rule is a silent 0.
    expect(fee).toEqual({ platformFeeAmount: 0, source: "global", bps: null, fixedAmount: null });
  });
});
