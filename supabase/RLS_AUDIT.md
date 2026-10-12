# RLS audit

Every table in `public` has row level security enabled. The iOS API uses the service role after it checks the caller, so these policies are the backstop for the operator and admin portals (user JWT) and for any direct client query.

Roles below mean a policy exists for that role. "None" is intentional and is not service-role-only.

| Table | Customer | Operator member | Admin | Notes |
| --- | --- | --- | --- | --- |
| profiles | own row | own row | all | |
| access_requests | own | none | update | Operators do not review access. |
| airports | read | read | write | |
| operators | read | update own | write | |
| operator_members | none | read own membership | write | Customers do not see staff lists. |
| operator_api_keys | none | admin member of that operator (`is_operator_admin`) | included | `0015`. Stores SHA-256 `key_hash` only. Select, insert, and update (revoke). No delete policy. The inbound API uses the service role after the hash lookup and still filters every write by that `operator_id`. Rate limiting is out of scope. |
| aircraft_models | read | read | write | |
| aircraft | read active | read/write own fleet | via member or admin policies | |
| aircraft_photos | read | read/write own fleet | via member policies | |
| aircraft_pricing_rules | read | read/write own fleet | via member policies | |
| aircraft_availability | read | read/write own fleet | via member policies | `0014` adds `source` (`manual`, `import`, `api`, default `manual`) and `import_batch_id`. Re-upload deletes only `source = import` for that aircraft. |
| searches | own | none | own policy includes admin | Search text stays private to the customer. |
| empty_legs | read published | write own | via member policies | |
| trip_requests | own | read/update when the aircraft, a quote, or a fan-out row is theirs | included in customer policy | `operator_can_access_trip` includes `trip_request_operators`. |
| trip_request_operators | none | read and update own rows | all | Customers have no policy. Inserts are service-role only via `create_trip_with_fanout`. |
| quotes | own trip | own operator | included | |
| bookings | own trip | own quote | update | `deposit_percent` defaults from config (50) and can be overridden per booking. `deposit_received_at` is set when paid payments cover that percent. The trip stays `awaiting_payment` until the full customer total is paid. |
| passenger_profiles | own | none | all | Passenger identity is not shared with the carrier through this table. |
| preferences | own | none | all | |
| platform_fee_rules | read | read | write | |
| tax_rules | read | read | write | Reference rates for charter FET, the domestic segment fee, the international facilities tax, and the Alaska/Hawaii departure tax. `0016_tax_rules.sql`. Quotes and bookings store `tax_rule_snapshot`; existing rows stay null. |
| passport_stamps | own | none | all | |
| payments | read via own booking | read via own quote | all | Customers cannot insert. Recording a wire stays an admin action. `paid_at` is the date the admin entered. |
| invoices | read via own booking | none | all | `0017_invoices.sql`. One invoice per booking. Operators do not see wire instructions. |
| payouts | none | read own operator | all | A payout is operator compensation, not a customer record. `run_rollover_trips_job` inserts an unpaid row when a trip completes, for `operator_amount - payout_adjustment`. Admin marks it sent with a date and reference. |
| refund_policies | read | read | write | Hours before departure to a refund percent of `customer_total`. `0021_refund_policies.sql`. Reference rows are in `seed.sql`. Cancellation inserts a negative `payments` row with status `refund_due` and does not move money. |
| trip_documents | own trip | read/write trips they can access | included in the customer policy | |
| trip_members | read roster on own trip; update own row | read roster on accessible trips | all on own policy | |
| route_watches | own | none | all | A watch is private demand. Operators do not see who is watching a route. |
| notifications | own profile | own profile | all | An operator reads notifications addressed to their profile, not another member's. `notifications_own` in `0001_init.sql` is `FOR ALL` with `profile_id = auth.uid()` (admin via `is_admin()`). `0004_rls_future_tables.sql` leaves that policy in place. `0011_notification_event.sql` adds nullable `event` and `trip_request_id` and does not change the policy. `GET` and `POST /api/v1/me/notifications` use the caller JWT and also filter `profile_id`, so `/me` does not list another profile's rows. |
| job_runs | none | none | read | Inserts only from scheduled jobs (`run_noop_job`, `run_expire_quotes_job`, `run_rollover_trips_job`). Security definer, executed by pg_cron. |

## Service-role-only

No `public` table is service-role-only.

`job_runs` is the closest case: authenticated users cannot insert, and only an admin can select. The cron job writes through a security-definer function, which is the same path the service role would use. That keeps the schedule's history out of customer and operator clients without hiding it from an admin.

`auth` and `storage` objects are outside this list. `storage.objects` for `aircraft-photos` is public-read with operator or admin write, from `0001_init.sql`. `storage.objects` for `trip-documents` is private. Operator members on the trip, the customer, and admins can read. Operator members and admins can write. Paths are `{trip_id}/{file}`. `storage.objects` for `invoices` is private. The customer on the booking and admins can read. Admins can write. Paths are `{invoice_id}.pdf`. The API uploads with the service role.
