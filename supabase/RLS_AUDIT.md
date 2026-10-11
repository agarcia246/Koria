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
| aircraft_models | read | read | write | |
| aircraft | read active | read/write own fleet | via member or admin policies | |
| aircraft_photos | read | read/write own fleet | via member policies | |
| aircraft_pricing_rules | read | read/write own fleet | via member policies | |
| aircraft_availability | read | read/write own fleet | via member policies | |
| searches | own | none | own policy includes admin | Search text stays private to the customer. |
| empty_legs | read published | write own | via member policies | |
| trip_requests | own | read/update when the aircraft, a quote, or a fan-out row is theirs | included in customer policy | `operator_can_access_trip` includes `trip_request_operators`. |
| trip_request_operators | none | read and update own rows | all | Customers have no policy. Inserts are service-role only via `create_trip_with_fanout`. |
| quotes | own trip | own operator | included | |
| bookings | own trip | own quote | update | |
| passenger_profiles | own | none | all | Passenger identity is not shared with the carrier through this table. |
| preferences | own | none | all | |
| platform_fee_rules | read | read | write | |
| passport_stamps | own | none | all | |
| payments | read via own booking | read via own quote | all | Customers cannot insert. Recording a wire stays an admin action. |
| payouts | none | read own operator | all | A payout is operator compensation, not a customer record. |
| trip_documents | own trip | read/write trips they can access | included in the customer policy | |
| trip_members | read roster on own trip; update own row | read roster on accessible trips | all on own policy | |
| route_watches | own | none | all | A watch is private demand. Operators do not see who is watching a route. |
| notifications | own profile | own profile | all | An operator reads notifications addressed to their profile, not another member's. |
| job_runs | none | none | read | Inserts only from scheduled jobs (`run_noop_job`, `run_expire_quotes_job`, `run_rollover_trips_job`). Security definer, executed by pg_cron. |

## Service-role-only

No `public` table is service-role-only.

`job_runs` is the closest case: authenticated users cannot insert, and only an admin can select. The cron job writes through a security-definer function, which is the same path the service role would use. That keeps the schedule's history out of customer and operator clients without hiding it from an admin.

`auth` and `storage` objects are outside this list. `storage.objects` for `aircraft-photos` is public-read with operator or admin write, from `0001_init.sql`.
