import type { TripStatus } from "@/lib/database.types";

const transitions: Record<TripStatus, TripStatus[]> = {
  requested: ["quote_received", "declined", "cancelled"],
  quote_received: ["awaiting_payment", "declined", "cancelled"],
  awaiting_payment: ["confirmed", "cancelled"],
  confirmed: ["upcoming", "cancelled"],
  upcoming: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
  declined: [],
};

export function canTransition(from: TripStatus, to: TripStatus): boolean {
  return transitions[from]?.includes(to) ?? false;
}

export function assertTransition(from: TripStatus, to: TripStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid trip transition: ${from} → ${to}`);
  }
}

export function nextStatusOnQuoteSent(current: TripStatus): TripStatus {
  if (current === "requested") return "quote_received";
  return current;
}

export function nextStatusOnOperatorDecline(current: TripStatus): TripStatus {
  if (current === "requested" || current === "quote_received") return "declined";
  return current;
}

export function nextStatusOnCustomerAccept(current: TripStatus): TripStatus {
  assertTransition(current, "awaiting_payment");
  return "awaiting_payment";
}

export function nextStatusOnAllQuotesDeclined(current: TripStatus): TripStatus {
  if (current === "quote_received") return "declined";
  return current;
}

export function nextStatusOnMarkPaid(current: TripStatus): TripStatus {
  assertTransition(current, "confirmed");
  return "confirmed";
}
