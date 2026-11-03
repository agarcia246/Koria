# KORIA web portal

Operator and admin portal for the KORIA private-aviation charter marketplace. Customers request trips in the iOS app; this Next.js app is where operators quote and where invoices, payouts, and admin oversight run.

## Run locally

```bash
cp .env.local.example .env.local
npm install
npm run dev
```

Open http://localhost:3000. Leave `RESEND_API_KEY` and `EMAIL_FROM` unset locally; mail is skipped. Bank details and the public site origin are not required outside production.

## Production environment

Set these on the host. Do not commit the values.

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key.
- `SUPABASE_SERVICE_ROLE_KEY` — server-only service role key.
- `NEXT_PUBLIC_SITE_URL=https://app.flykoria.com` — public origin used in operator emails and invite links.
- `RESEND_API_KEY` — Resend API key for transactional mail.
- `EMAIL_FROM` — from address, `KORIA <notifications@notify.flykoria.com>`.
- `KORIA_BANK_DETAILS_JSON` — JSON object of wire instructions printed on the invoice.
- `SENTRY_DSN` — Sentry DSN. Server-side; reporting stays off when unset.

The server refuses to start when `NODE_ENV=production` and any of `RESEND_API_KEY`, `EMAIL_FROM`, `KORIA_BANK_DETAILS_JSON`, `NEXT_PUBLIC_SITE_URL`, or `SUPABASE_SERVICE_ROLE_KEY` is missing, or when `KORIA_BANK_DETAILS_JSON` is not a JSON object. The check runs at process start on the Node.js runtime, not during `next build` and not on the edge runtime. Set `KORIA_ALLOW_NO_EMAIL=1` on a staging host to skip only the `RESEND_API_KEY` and `EMAIL_FROM` requirement.
