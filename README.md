# GateIQ

GateIQ checks what was **filed** for a consignment (the shipping bill on ICEGATE) against what was **declared** by the consignor, and later against what arrives at the terminal gate.

This phase covers:

- **Username + password sign-in.** Users and password hashes are stored in our own Postgres. The username is the permanent identity and the only sign-in name; the email can be changed from the profile and is trusted as typed (no verification link or OTP), so it shows as *self-declared*. A new password can be set from the profile without the old one (every other session is ended); there is no "forgot password" yet.
- **A permanent username** chosen at sign-up, then **an account type** (consignor, consignee, CHA, transporter, driver or gate officer; the other official types are hidden until the gate phase exists), then a role-specific profile. The account type can't be changed. Anyone can delete their account, which deletes the cases they own and everything they added to other people's cases. Each identity field shows a verification badge: *owned*, *exists*, *format valid*, *self-declared* or *invalid*.
- **Case creation by the consignor (who can also delete the case):** route, goods lines, and special cargo (hazmat with MSDS, pharma temperature range, perishable certificates). Each case gets a Case ID like `GIQ-26-7K3M9Q2X`, with a check character that catches typos.
- **A dashboard that shows each case's flow** (case created, people invited, documents added, checks clean, gate) and the next step for the viewer. A case is expected to carry the shipping bill, invoice, packing list, e-way bill and lorry receipt, plus the certificate its hazmat, pharma or perishable flag calls for.
- **Inviting people to a case by username.** Each account type can invite only the next ones down the line: consignor → consignee, CHA, transporter; CHA → transporter; transporter → driver. Every account type can also invite a **gate officer**, a view-only account that sees every document, file, verified value, flag and the activity log of the cases it is on, and can change nothing. Invites show on the invitee's dashboard; once accepted they can view the case. The owner or the inviter can remove someone, which also removes everyone that person invited. A case has at most one consignee, whose company name is compared with the shipping bill.
- **Recording every document field by field:** shipping bill (with its container block), e-way bill, lorry receipt, Form-13, VGM declaration, e-seal record, invoice and packing list. Each raw entry is kept append-only and hashed, normalised (units to tonnes, dates, names, HS codes, container numbers), and can be corrected; earlier versions stay in the record trail.
- **Reading documents from photos and PDFs.** A QR code (GST e-invoice, e-way bill) is decoded in the browser first; the rest is read by Gemini into the same form, and the adder confirms every field before it is saved.
- **Cross-document checks** (`src/lib/checks/`): every fact (container and seal numbers, vehicle, shipping bill and invoice numbers, IEC, GSTIN, HS codes, packages, weights, consignee) is compared across all documents and the case, per container. Container numbers are checked against their ISO 6346 check digit; VGM less tare is compared with the shipping bill's gross weight; e-way bill expiry and Part B are watched. Each fact is compared with the case's **verified value** first; where none exists yet, documents are compared with each other. A mismatch shows who said what and who can fix it, and anyone on the case can explain an expected one.
- **Verified info (ground truth)** (`src/lib/facts/`): a ladder for every fact on a case: *declared* (someone put it forward), *confirmed* (a different account in a different role agrees), then *source-verified* and *observed* (not live yet). Nobody raises their own claim. A one-tap **Confirm this value** in Checks and in the Verified info section puts a value forward or confirms it; who may set each fact is in `FACT_AUTHORITY`.
- **A case page with six sections** (Overview, Verified info, Documents, Checks, People & invites, Activity) that are all loaded once, so switching between them asks the server for nothing. **Activity** is the case's audit log as a timeline.
- **Optimistic writes.** Removing a document, explaining a check, confirming a value, inviting or removing a person and answering an invite update the screen at once and roll back with a message if the database write fails. Reading a file, creating a case, signing in or up, and deleting an account wait for the server.

ULIP (direct ICEGATE / e-way bill lookups) is not connected yet. Every filing goes through the `FilingSource` interface (`src/server/filings/`), so a `UlipFilingSource` can be added later without touching the rest of the pipeline.

## Stack

Next.js 16 (App Router, TypeScript) · Tailwind CSS v4 · Better Auth (username + password) · Drizzle ORM · Supabase Postgres + Storage (Mumbai) · Vercel (`bom1`) · Vitest.

The visual design follows the tokens in `DESIGN.md`.

## Setup

1. **Supabase:** create a project in the Mumbai region (`ap-south-1`).
   - Copy the **connection pooler** URI into `SUPABASE_DB`. The direct host `db.<ref>.supabase.co` is IPv6-only and fails on most IPv4 networks.
   - In Storage, create a **private** bucket named `case-documents`.
   - Copy the project URL into `SUPABASE_URL` and the secret key into `SUPABASE_SECRET_KEY`.
2. **Environment:** copy `.env.example` to `.env.local` and fill it in. `GEMINI_API_KEY` is optional: without it only QR codes are read and the rest is typed in. Generate `BETTER_AUTH_SECRET` with `openssl rand -base64 32`. `.env.example` is the committed template with placeholders; `.env.local` holds your real values and is git-ignored.
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
- Connect timeout is 10 s, and idle connections close after 20 s (a sleeping serverless function would otherwise wake up holding connections the pooler dropped), and a SELECT that gets no answer in 4 s is retried on a fresh connection.
- A `SELECT` that fails on a dropped connection is retried once after 500 ms. Writes and transactions are never retried, since a write can fail after Postgres has already committed it.

Set `GATEIQ_DB_TIMING=1` to log every query's duration (for finding slow pages in Vercel's function logs).

## Scripts

| Script | What it does |
|---|---|
| `npm test` | Unit tests: validators, Case ID, normalisers, ISO 6346, checks engine, QR parsing, extraction |
| `npm run typecheck` | TypeScript check |
| `npm run db:generate` | Generate a migration after changing `src/db/schema.ts` |
| `npm run db:migrate` | Apply migrations |
| `npm run masters:import -- <uqc\|iso\|ports\|hs> [csv]` | Load reference masters |
| `CONFIRM_WIPE=<project ref> npm run db:wipe -- --yes` | Delete every account, case, document and stored file (keeps the reference masters). Irreversible |

## Deploying to Vercel

Import the repo and set the same environment variables as in `.env.local`. Set `BETTER_AUTH_URL` to the production URL. Functions run in `bom1` (Mumbai), next to the database, as configured in `vercel.json`.
