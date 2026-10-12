-- Customer acceptance of the current terms and privacy version.
-- The app compares terms_version to CURRENT_TERMS_VERSION. A new version
-- requires acceptance again. Existing rows stay null until the customer accepts.

alter table public.profiles
  add column terms_accepted_at timestamptz,
  add column terms_version text;

comment on column public.profiles.terms_accepted_at is
  'When the customer accepted terms_version.';

comment on column public.profiles.terms_version is
  'Version string of the terms and privacy policy the customer accepted.';
