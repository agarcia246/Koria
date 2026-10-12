-- The date an admin records for a wire. created_at stays the time the row was written.

alter table public.payments
  add column paid_at timestamptz;

comment on column public.payments.paid_at is
  'When the wire was received, as entered by an admin. Null on older rows and on refund liabilities until they are sent.';
