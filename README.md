# GateIQ

GateIQ checks what was **filed** for a consignment (the shipping bill on ICEGATE) against what was **declared** by the consignor, and later against what arrives at the terminal gate.

This phase covers:

- **Email + password sign-in.** Users and password hashes are stored in our own Postgres. Emails are trusted as typed (no verification link or OTP), so they show as *self-declared*.
- **A permanent username** chosen at sign-up, then **one of 11 account types**, then a role-specific profile. Each identity field shows a verification badge: *owned*, *exists*, *format valid*, *self-declared* or *invalid*.
- **Case creation by the consignor:** route, goods lines, and special cargo (hazmat with MSDS, pharma temperature range, perishable certificates). Each case gets a Case ID like `GIQ-26-7K3M9Q2X`, with a check character that catches typos.
- **Inviting people to a case by username.** Each account type can invite only the next ones down the line: consignor → consignee, CHA, transporter; CHA → transporter; transporter → driver. Officials are never invited. Invites show on the invitee's dashboard; once accepted they can view the case. The owner or the inviter can remove someone, which also removes everyone that person invited. A case has at most one consignee, whose company name is compared with the shipping bill.
- **Recording the shipping bill** as the *Filed baseline*. The raw entry is kept append-only and hashed, normalised (units to tonnes, dates, names, HS codes), versioned, and compared line by line with the declared case.

ULIP (direct ICEGATE / e-way bill lookups) is not connected yet. Every filing goes through the `FilingSource` interface (`src/server/filings/`), so a `UlipFilingSource` can be added later without touching the rest of the pipeline.

## Stack

Next.js 16 (App Router, TypeScript) · Tailwind CSS v4 · Better Auth (email + password) · Drizzle ORM · Supabase Postgres + Storage (Mumbai) · Vercel (`bom1`) · Vitest.

The visual design follows the tokens in `DESIGN.md`.

## Setup

1. **Supabase:** create a project in the Mumbai region (`ap-south-1`).
   - Copy the **connection pooler** URI into `SUPABASE_DB`. The direct host `db.<ref>.supabase.co` is IPv6-only and fails on most IPv4 networks.
   - In Storage, create a **private** bucket named `case-documents`.
   - Copy the project URL into `SUPABASE_URL` and the secret key into `SUPABASE_SECRET_KEY`.
2. **Environment:** copy `.env.example` to `.env.local` and fill it in. Generate `BETTER_AUTH_SECRET` with `openssl rand -base64 32`. `.env.example` is the committed template with placeholders; `.env.local` holds your real values and is git-ignored.
3. **Database and reference data:**

```bash
npm install
```

```bash
npm run db:migrate
```

```bash
npm run masters:import
```

The last command loads UQC units, ISO countries and ISO currencies. To load customs location codes and ITC-HS codes from the official lists, see `data/masters/README.md`.

4. **Run:**

```bash
npm run dev
```

## Database connection

The app, migrations and import scripts all use the one `SUPABASE_DB` connection string (`src/db/client.ts`). The settings follow the Dexel setup:

- SSL is required.
- Prepared statements are off, because Supabase's pooler runs in transaction mode.
- Connect timeout is 10 s, and idle connections close after 300 s.
- A `SELECT` that fails on a dropped connection is retried once after 500 ms. Writes and transactions are never retried, since a write can fail after Postgres has already committed it.

## Scripts

| Script | What it does |
|---|---|
| `npm test` | Unit tests: validators, Case ID, normaliser, diff, CSV parser |
| `npm run typecheck` | TypeScript check |
| `npm run db:generate` | Generate a migration after changing `src/db/schema.ts` |
| `npm run db:migrate` | Apply migrations |
| `npm run masters:import -- <uqc\|iso\|ports\|hs> [csv]` | Load reference masters |

## Deploying to Vercel

Import the repo and set the same environment variables as in `.env.local`. Set `BETTER_AUTH_URL` to the production URL. Functions run in `bom1` (Mumbai), next to the database, as configured in `vercel.json`.
