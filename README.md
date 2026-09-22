# SocialBoost — TransTRACK Social Media Scheduler

Internal tool for TransTRACK's marketing team to draft, approve, schedule,
and publish social content for **transtrack.co** and **transtrack.academy**
across Instagram and Facebook (LinkedIn to follow once API access is
approved). Built from the PRD at [`docs/PRD.md`](docs/PRD.md).

## Stack

- **Next.js 16 (App Router)** — frontend + backend, deployed to Vercel
- **PostgreSQL (Neon) + Prisma** — every brand-scoped table carries
  `brandId` from day one so new brands (LinkedIn, future Racik Digital
  clients) don't need a schema migration. The schema targets plain
  `postgresql`, so any Postgres host works — Neon is just the free option
  this project is deployed against
- **NextAuth v5 (Credentials provider, JWT sessions)** — simple email/password
  login for an internal team; roles are per-brand (`Membership.role`)
- **Vercel Blob** — post media storage
- **Vercel Cron** (`vercel.json` → `/api/cron/publish`) — polls for due
  scheduled posts and publishes them via the Meta Graph API
- **AES-256-GCM** (`src/lib/crypto.ts`) — encrypts every stored social
  access token before it touches the database

## Roles (single-level approval)

| Role      | Can do                                                         |
|-----------|------------------------------------------------------------------|
| Admin     | Everything: connect accounts, manage team, create, approve       |
| Creator   | Create/edit drafts, submit for approval                          |
| Approver  | Approve or reject submitted drafts (one level, no re-approval)   |
| Viewer    | Read-only: calendar, post list, statuses                         |

Roles are assigned per brand via **Settings → Team**, so one person can be,
say, Approver on transtrack.co and Viewer on transtrack.academy.

## Post lifecycle

```
DRAFT → PENDING_APPROVAL → SCHEDULED → PUBLISHING → PUBLISHED
                        ↘ REJECTED                 ↘ FAILED
```

`/api/cron/publish` picks up `SCHEDULED` posts whose `scheduledAt` has
passed, publishes each target platform sequentially (to respect Meta's
rate limits), and records success/failure **per platform** on
`PostTarget` as well as an overall post status. Failures notify the
creator and every Admin on the brand; nothing fails silently.

## Local setup

```bash
npm install
cp .env.example .env   # fill in the values below
npx prisma migrate dev # creates schema in your local/dev Postgres
npm run db:seed        # creates 2 brands + 1 user per role
npm run dev
```

Seeded logins (password from `SEED_PASSWORD` in `.env`, default
`ChangeMe123!`):

- `admin@transtrack.co` — Admin
- `creator@transtrack.co` — Creator
- `approver@transtrack.co` — Approver
- `viewer@transtrack.co` — Viewer

### Environment variables

See `.env.example`. In short:

- `DATABASE_URL` — Postgres connection string. Production uses
  [Neon](https://neon.tech) (added via Vercel's Storage tab, free tier),
  but any Postgres host works — the schema is plain Prisma/Postgres, no
  vendor lock-in
- `AUTH_SECRET` — NextAuth session signing secret
- `TOKEN_ENCRYPTION_KEY` — AES-256-GCM key for stored platform tokens
  (`openssl rand -base64 32`)
- `CRON_SECRET` — shared secret Vercel Cron sends as a Bearer token; set the
  same value in the Vercel project's environment variables
- `BLOB_READ_WRITE_TOKEN` — Vercel Blob store token

## Connecting Instagram & Facebook (Development Mode)

The MVP targets Meta's **Development Mode** (no full App Review): only
accounts added as Admins/Testers on the Meta app can be published to. Steps:

1. Create a Meta App at [developers.facebook.com](https://developers.facebook.com/).
2. Add the **Instagram Graph API** and **Facebook Login for Business**
   products; add the TransTRACK Meta Business Suite admin as an app
   Admin/Tester.
3. In [Graph API Explorer](https://developers.facebook.com/tools/explorer/),
   generate a long-lived Page access token with
   `pages_show_list, pages_read_engagement, pages_manage_posts,
   instagram_basic, instagram_content_publish` permissions.
4. Grab the **Page ID** (Facebook) and **Instagram Business Account ID**
   linked to that Page.
5. In SocialBoost, go to **Settings → Connected accounts** (Admin role) and
   save the platform, display name, account/Page ID, and access token — it's
   encrypted before it's stored.

Instagram publishing requires a **public** media URL (Vercel Blob URLs work)
and only supports single image/video posts in this MVP — matching the PRD's
scope (no carousels/stories in the 3-day MVP).

## Deploying to Vercel

1. Push this repo, import it into Vercel.
2. Add a **Neon** Postgres database: Project → **Storage** tab → **Create
   Database** → Neon → connect it to Production + Preview. This
   auto-injects a working `DATABASE_URL` — no manual connection string
   needed. (Any other Postgres host works too; just set `DATABASE_URL`
   yourself if you skip this.)
3. Add the remaining variables from `.env.example` in Project Settings →
   Environment Variables (fresh `TOKEN_ENCRYPTION_KEY`/`AUTH_SECRET`/
   `CRON_SECRET`, and don't reuse the dev `SEED_PASSWORD`).
4. Add a Blob store (Storage tab) — this fills `BLOB_READ_WRITE_TOKEN`
   automatically.
5. Deploy, then run `npx prisma migrate deploy` (e.g. via `vercel env pull`
   + a one-off local run, or a Vercel deploy hook) against the production
   database, and `npm run db:seed` once to create the first Admin.
6. **Cron frequency**: this project runs on the **Hobby** plan today, which
   only allows daily cron invocations, so `vercel.json` schedules
   `/api/cron/publish` once a day (23:00 UTC / 06:00 WIB). That means a
   scheduled post publishes on its next daily run, not at its exact
   `scheduledAt` time — acceptable for the MVP, but not the "on-time
   publish" experience the PRD describes. Upgrading to **Pro** and changing
   the schedule back to `*/5 * * * *` (or similar) gets near-real-time
   publishing; see "Open questions" below.

## Known limitations (MVP scope, per PRD §5)

- Single image/video per post (no carousels), no content library / asset
  reuse yet (planned Phase 3)
- No engagement analytics yet (status: published/failed only — Phase 2)
- LinkedIn is modeled in the schema (`Platform.LINKEDIN`) but has no
  publish integration yet — pending Marketing Developer Platform approval
- New team members are added directly in Settings with an admin-set initial
  password; there's no self-service signup or password reset flow yet

## Open questions from the PRD (§13) — need a decision from Terry / TransTRACK

1. **Who is the single Approver** for transtrack.co and transtrack.academy?
2. **Who holds the Meta Business Suite admin account** used to set up the
   Instagram/Facebook app and generate access tokens?
3. **Submit the LinkedIn Marketing Developer Platform application today** so
   Phase 2 isn't blocked on a >3-day approval process?
4. **Vercel plan** — currently **Hobby** (free, daily-only cron). Worth
   upgrading to **Pro** once the team wants scheduled posts to publish near
   their exact time rather than on the next once-daily cron run.
