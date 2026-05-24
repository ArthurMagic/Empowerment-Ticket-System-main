# EMPOWERMENT – Theater Ticket Reservation

Kostenloses Ticket-Reservierungssystem für das Jugendtheaterstück EMPOWERMENT (Barbie · KEN · Power), aufgeführt am 30.06.2026 im Haus der Jugend Charlottenburg, Berlin.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/empowerment run dev` — run the frontend (port 19626)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Optional env: `RESEND_API_KEY` — for sending confirmation emails
- Optional env: `ADMIN_KEY` — admin password for check-in/admin dashboard (default: `empowerment-admin-2026`)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, TailwindCSS, shadcn/ui, wouter, react-hook-form
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Email: Resend (transactional email with HTML ticket + QR code)
- QR Code: qrcode npm package
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — API contract (source of truth)
- `lib/db/src/schema/reservations.ts` — DB schema for ticket reservations
- `artifacts/api-server/src/routes/reservations.ts` — all reservation/check-in/admin routes
- `artifacts/api-server/src/lib/email.ts` — Resend email sender + HTML template
- `artifacts/empowerment/src/pages/` — all frontend pages

## Architecture decisions

- Token-based validation: each reservation gets a random 32-char hex token used in QR codes
- Admin key protects check-in and admin dashboard endpoints (env var or default)
- Email is optional (no crash if RESEND_API_KEY not set) — reservation still works
- DSGVO: consent checkbox required; only name/email/ticketCount/specialNeeds stored
- One email per person (unique constraint on email column to prevent duplicates)

## Product

- Landing page: event details + ticket reservation form (name, email, ticket count, special needs, DSGVO consent)
- Success page: confirmation + QR code for venue entry
- Validation page (/validate/:token): mobile-optimized for staff at entrance, shows ticket info, allows check-in with admin key
- Admin dashboard (/admin): lists all reservations with stats, requires admin key

## User preferences

- App language: German
- DSGVO compliance required
- No emojis in UI
- Design: dark theatrical background + electric pink/magenta accents

## Gotchas

- Always run `pnpm run typecheck:libs` after changing `lib/db/src/schema/` before typechecking `api-server`
- After each OpenAPI spec change, re-run codegen before using updated types
- The `crypto` npm package (deprecated) installed as transitive dep — ignore the warning
- Admin key defaults to `empowerment-admin-2026` — change via ADMIN_KEY env var in production

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
