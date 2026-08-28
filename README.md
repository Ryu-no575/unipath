This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Admin & Real Data Operations

UniPath has two roles: `user` (default) and `admin`, stored in `public.user_roles` (never on `profiles`, and never writable from the client — see `supabase/migrations/20260829000000_admin_roles_v1.sql`). Every `/admin/*` page and every admin Server Action independently re-verifies `role === "admin"` server-side via `app/lib/supabase/roles.ts`'s `requireAdmin()`, using the service-role client — never a client-supplied value.

To make your own account the first admin, run the "Make an account admin" SQL below in the Supabase SQL Editor after applying the migration.

### Commands

- `npm run sync:universities` (alias `npm run import:universities`) — imports real institutions from [ROR](https://ror.org) into `public.universities`, deduplicated by `ror_id`. Filters to likely Higher Education Institutions (see `app/lib/importers/ror/index.ts`) across a broad default country list; pass `--countries=US,GB,JP`, `--target=500`, or `--names="ETH Zurich"` to narrow it. Never hardcodes a university list — every row comes from ROR's own data.
- `npm run validate:sources` — re-checks official-source URLs that are due for a health check (reachability, redirects, robots.txt), via `/api/admin/validate-sources`. Requires the app running (`npm run dev` or `APP_URL=<deployment>`).
- `npm run data:status` — prints the same live counts as the Admin Dashboard's Data Health section (universities, programs, verified admissions, source health, coverage by country/field) directly from Supabase.

### Admin Dashboard

`/[locale]/admin` and its sub-pages (`/admin/universities`, `/admin/programs`, `/admin/sources`, `/admin/changes`, `/admin/community`) cover:

- **Universities** — the ROR-imported catalog, with Data Status (`imported` / `verified` / `needs_review`, computed from source verification signals — see `app/lib/data/dataStatus.ts`), source health, and country/status filters.
- **Programs** — the program review queue (candidate → official source → extracted → review → verified), with per-field verification badges (Admissions/Deadline/Tuition/Language requirement/Portfolio/Entrance exam) and a Verify action.
- **Sources** — every tracked official page, its automated health check, and an admin Reject/Undo-reject decision (a rejected source is excluded from "Verified" everywhere in the app, regardless of its automated status).
- **Changes** — `change_events` detected from official sources, with Approve (writes the new value into the live catalog, or into `admission_requirements` for non-column fields) / Reject.
- **Community** — pending `community_reports` (Resolve/Dismiss) and "Requested Universities" (reused from `user_custom_universities` — the same "this university isn't in the catalog yet" flow a user already gets when adding an application).

Every admin mutation (Verify, Reject, Approve, Resolve, ...) is written to `public.admin_audit_logs` (`admin_user_id`, `action`, `entity_type`, `entity_id`, `metadata`).

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
