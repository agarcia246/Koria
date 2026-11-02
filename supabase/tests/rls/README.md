# RLS regression suite

`node:test` against a local Supabase stack after migrations and the demo seed. No extra npm packages.

```sh
supabase start && supabase db reset --local && node --test 'supabase/tests/rls/**/*.test.mjs'
```

`node --test supabase/tests/rls/` does not discover `*.test.mjs` on Node 25 (it tries to load the directory as a module). The glob is what CI runs. It also works on Node 22.

The suite signs in through GoTrue with the demo password `koria-demo` (seeded customer Alex Rivera, Northline admin Maya Ortiz, Atelier admin Luca Moretti). It creates a platform admin, a non-admin Northline member, and a throwaway customer through the Auth admin API, then calls PostgREST at `http://127.0.0.1:54321`.

Overrides: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

The non-gated aircraft update inserts an inactive tail (`is_active: false`) and edits `cabin_notes` on that row. Seeded operators have no agreement, and `aircraft_protect_activation` (0035) rejects any update that leaves `is_active` true, including a no-op on an already-active tail.
