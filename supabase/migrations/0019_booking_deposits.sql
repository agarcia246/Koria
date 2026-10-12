-- A deposit is a flag on the booking, not a trip status.
-- The trip stays awaiting_payment until paid payments cover customer_total.

alter table public.bookings
  add column deposit_percent numeric not null default 50,
  add column deposit_received_at timestamptz;

comment on column public.bookings.deposit_percent is
  'Percent of customer_total that counts as the deposit. New bookings copy web/src/lib/payments/deposit.ts DEFAULT_DEPOSIT_PERCENT. Admin can override the row.';

comment on column public.bookings.deposit_received_at is
  'Set when paid payments cover deposit_percent of customer_total. Cleared if a later override raises the percent above what has been paid. The trip status does not change.';
