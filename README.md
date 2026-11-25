# Tereeza Link — Neon edition

Next.js 16 / React 19 / TypeScript / Tailwind 4 URL shortener for **https://link.trenttech.online**, using PostgreSQL on Neon. No Supabase dependency, public accounts, or self-managed server required. Next.js runs on Vercel; Neon stores links and analytics.

## Features

Public URL creation, case-insensitive custom aliases, expiration, noncached 302 redirects, copy/share, QR PNG download, private token-based analytics, admin password sessions and reversible moderation, abuse reports, atomic PostgreSQL rate limits, optional Google Web Risk screening, metadata/sitemap, installable PWA with offline fallback, and visitor-local 07:00–19:00 light theme with persistent Auto/Light/Dark override. Charcoal #151515, amber #FFAA00, green #00E676 branding. The header logo, favicon, Apple touch icon and PWA install icons use the supplied official Tereeza artwork.

## Neon project

This directory is linked locally to the requested organization `org-cold-heart-71293576`, project `plain-feather-91617337`, branch `production`. `.neon` is gitignored. `neon.ts` declares Postgres-only configuration; no Neon Auth, Functions, Object Storage, Data API or AI service is needed for this app. API handlers and admin sessions remain in Next.js. `neon deploy` provisions/reconciles backend services; it does **not** publish the Next.js website.

The Neon CLI is available through the fallback `npx neon@latest`; global installation was unavailable in the build environment. This workspace uses a separate CLI settings directory to avoid writing outside the workspace. For this workspace session, append:

```sh
--config-dir /home/shemue-l/Documents/Codex/2026-11-24/referenced-chatgpt-conversation-this-is-an/work/neon-cli
```

On your own terminal, the normal default profile is fine. From this project root:

```sh
npm ci
npx neon@latest login
npx neon@latest init -y --org-id org-cold-heart-71293576 --project-id plain-feather-91617337 --branch production --services postgres
npx neon@latest config plan
npx neon@latest deploy
```

Finish browser sign-in yourself. If agent-tool installation fails, it does not prove database configuration failed: inspect CLI output. The relevant skills can be installed separately:

```sh
npx skills@latest add neondatabase/agent-skills --skill neon --skill neon-postgres --agent codex -y
```

The initial app setup encountered this CLI child-command failure and used that fallback successfully.

Deploy pulls `DATABASE_URL` (pooled app connection) and `DATABASE_URL_UNPOOLED` (direct migration connection) into `.env.local`, or `.env` if one already exists. Do not print or commit their values. Existing app settings must be preserved. Never add `NEXT_PUBLIC_` to database credentials.

## Schema and database access

```sh
npm run db:migrate
```

Migrations live in `db/migrations`. The runner uses the direct connection, a transaction, advisory lock, migration ledger and SHA-256 checksums. Running it again skips already-applied files; editing an applied migration fails rather than silently changing production. Add a new numbered migration for future changes.

The app uses a dedicated `tereeza` schema to avoid collisions with unrelated public tables. Tables have RLS enabled and no public grants; the private server connection uses the owning database role. No browser-facing database endpoint is enabled. Authorization lives in the Next.js handlers. If using a separate restricted runtime role later, add explicit grants and appropriate RLS policies for it.

`lib/database.ts` uses parameterized `pg` queries, a lazy pool with max 5 clients, and `attachDatabasePool` on Vercel for Fluid compute suspension handling. It does not connect during build. Neon URLs explicitly verify TLS certificates, and network-family attempts allow 2 seconds for higher-latency connections. No Supabase SDK, PostgREST proxy, or Docker is needed in production.

Before deploying future migrations to a populated production database, test them on a Neon child branch first, then run the same tracked migration against production.

## App settings

Neon provides the database URLs only. Add these private application settings to `.env.local` locally and Vercel environment variables for hosting:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon pooled runtime connection, supplied by Neon |
| `DATABASE_URL_UNPOOLED` | Neon direct migration connection, supplied by Neon |
| `SITE_URL` | `http://localhost:3000` locally; `https://link.trenttech.online` in production, no trailing slash |
| `ADMIN_PASSWORD` | Unique strong admin password |
| `SESSION_SECRET` | Separate random 32-byte hex secret for eight-hour signed admin sessions |
| `IP_HASH_SECRET` | Separate random 32-byte hex secret for IP and management-token hashing |
| `WEB_RISK_API_KEY` | Optional server-side Google Web Risk key |
| `REQUIRE_THREAT_CHECK` | `true` requires successful threat screening at creation |
| `BLOCKED_HOSTS` | Optional comma-separated blocked domains; includes subdomains |

Generate secrets separately with `openssl rand -hex 32`. Private local app secrets were generated without printing them. Read them locally when setting Vercel variables; do not paste them into chat. Rotating `IP_HASH_SECRET` invalidates analytics management tokens. To revoke all admin sessions after a password change, rotate `SESSION_SECRET` too.

```sh
npm run dev
# Open http://localhost:3000
npm test
npm run typecheck
npm run build
npm start
```

Use `npm run dev` for HTTP admin login: production cookies are Secure and require HTTPS. The end-to-end test uses its own temporary secrets and a direct HTTP test client.

## Verify the Neon connection end to end

After `neon deploy` and migrations:

```sh
npm run build
npm run test:e2e
```

The test requires `DATABASE_URL`, starts the built production Next.js app on local port 3100, checks authenticated database connectivity and TLS for a remote database, and exercises link creation, redirects, private analytics, admin moderation, reports and limits. It uses random test aliases and secrets and deletes only records from that test run. Threat screening is disabled in the test child process to keep database verification independent of optional external services. It never prints connection strings or secrets. Set `E2E_PORT` if 3100 is busy.

If authentication or Neon access is unavailable, a successful build or local PostgreSQL test is **not** evidence of a live Neon connection. Live setup and production Neon E2E verification are now complete; see `NEON-SETUP-REPORT.md` for command evidence.

## Retention

Run `npm run db:cleanup` once per day through a trusted scheduler with `DATABASE_URL` available. It removes old rate limits (>2 days), daily deduplication IDs (>2 UTC days), and analytics/report detail (>90 days), retaining links and lifetime click totals. No cleanup scheduler is provisioned by the Postgres-only Neon config. Configure one before promoting the privacy retention policy; without it records accumulate. Do not assume Supabase Cron exists on Neon. Configure Neon recovery/history/backups for your plan and recovery needs.

## Deploy the website on Vercel

1. Put this project in a private Git repository, including `package-lock.json` and `neon.ts`. Exclude `.env*` secrets, `.neon`, `.next`, and `node_modules`.
2. Vercel → Add New → Project → import the repository. Framework: Next.js. Root directory: the directory containing this `package.json`. If the repository contains this whole workspace, choose `outputs/tereeza-link`.
3. Select Node.js 22.x or a supported newer release. Install `npm ci`, build `npm run build`, default Next.js output directory. Enable Fluid compute for the pool lifecycle integration.
4. Add `DATABASE_URL` and the app variables listed above to Production settings. The runtime does not need `DATABASE_URL_UNPOOLED`; keep that in your migration environment. Set `SITE_URL=https://link.trenttech.online`.
5. Deploy after the schema is migrated. For Preview deployments use a separate Neon branch/database and an exact matching Preview `SITE_URL`, not production data.
6. Settings → Domains → add `link.trenttech.online`. Copy the exact CNAME target Vercel displays.
7. Follow the Namecheap steps below. Wait for valid DNS configuration and HTTPS certificate issuance.
8. Redeploy whenever build-time settings such as `SITE_URL` change; generated SEO metadata depends on them.

Official Vercel guide: https://vercel.com/docs/domains/working-with-domains/add-a-domain

## Namecheap: only the `link` subdomain

1. Sign in to Namecheap → **Domain List → trenttech.online → Manage**.
2. Check **Nameservers**. If using Namecheap BasicDNS/PremiumDNS/FreeDNS, go to **Advanced DNS → Host Records**. If using Cloudflare or hosting nameservers, edit DNS at that authoritative provider instead; Namecheap records would have no effect.
3. Find records whose Host is exactly **link**. Remove conflicting A, AAAA, CNAME, or URL Redirect records for **link** only. Preserve records for `@`, `www`, mail, `tereezaspeed`, and other subdomains.
4. **Add New Record → CNAME Record**. Set **Host: `link`**, **Value: the exact hostname Vercel displayed**, **TTL: Automatic**. Use no `https://`, path, or slash. Save.
5. If Vercel asks for TXT ownership verification, add exactly its displayed TXT Host and Value. Follow the dashboard's verification instructions.
6. Return to Vercel → Domains and refresh verification. DNS propagation varies. Test `https://link.trenttech.online` over HTTPS after verification.

Namecheap guidance: https://www.namecheap.com/support/knowledgebase/article.aspx/10058/10/namecheap-dns-limits/

Do not change the apex domain or the domain's nameservers merely to connect this one subdomain.

## API reference

| Endpoint | Purpose |
| --- | --- |
| `POST /api/links` | JSON `{url, alias?, expiresAt?, website?}` → 201 `{slug, shortUrl, manageToken}`. `website` is a honeypot and should be empty. Expiration is ISO 8601. |
| `GET /:slug`, `HEAD /:slug` | Noncached 302; HEAD never records a visit. 404 unknown, 410 disabled/expired. |
| `GET /api/stats/:slug` | `Authorization: Bearer <manageToken>` or admin session; private statistics |
| `POST /api/admin/session` | JSON `{password}` → HttpOnly, Secure in production, SameSite=Strict eight-hour cookie |
| `DELETE /api/admin/session` | Sign out |
| `GET /api/admin/links?page=0&search=alias` | Admin list of 50 rows, optional exact alias search |
| `PATCH /api/admin/links` | Admin JSON `{slug, disabled:boolean}` |
| `POST /api/report` | JSON `{slug, reason}`; reason 10–1,000 characters |
| `GET /api/admin/reports` | Admin latest 100 reports |

Errors use `{error: string}` and meaningful HTTP status codes. Rate-limited requests return 429 and Retry-After. Admin operations never reveal management-token hashes in API responses.

## Abuse controls and limitations

Creation is limited to 20 attempts/hour/client IP, stats to 120/hour, reports to 5/hour, login to 5 attempts/15 minutes. Counters update atomically in PostgreSQL and fail closed if unavailable. On Vercel, the trusted Vercel client-IP header is used; local/non-Vercel deployments share a single bucket. If moving hosts, update IP handling for that host's trusted proxy and never trust arbitrary incoming forwarded headers.

Only HTTP(S) domains are accepted: no embedded credentials, literal IPs (including encoded IPv4 forms), local suffixes, unusual ports or self-shortener loops. Destination pages are never fetched by this application, preventing server-side URL-fetch SSRF. This does **not** establish that a public domain is safe or that it will not redirect elsewhere, resolve privately, or change after creation. Block domains through `BLOCKED_HOSTS`; existing links to them also stop redirecting. Disable individual links in admin.

For public launch, provision Google Cloud Web Risk, enable its API, restrict the key to that API, set `WEB_RISK_API_KEY` and `REQUIRE_THREAT_CHECK=true`, then redeploy. New links fail closed if screening is unavailable. Screening is at creation time, not continuous. Threat feeds are imperfect. No detection service was configured or live-tested here. Monitor costs and errors. For higher traffic add Vercel Firewall/bot challenges, operational alerting and more advanced moderation; IP limits alone cannot stop distributed abuse.

Click totals count at most one visit per link, hashed visitor IP and UTC day; known bots and HEAD requests are excluded. Shared networks can undercount and unrecognized bots can overcount. Referrer policies often produce `direct`. Analytics is best-effort through Next.js `after()`: storage failures do not block a redirect. Daily breakdowns show at most the most recent 1,000 rows. Lifetime totals and daily retained breakdowns can differ after cleanup.

PWA deliberately caches no short URLs, API data, secrets, admin pages or analytics. It is installable with an offline navigation fallback, not an offline shortener. Production Secure cookies require HTTPS; use `npm run dev` for HTTP admin testing.


## Agent setup

The Neon and Neon Postgres skills are installed locally and up to date. The requested hosted skill matches the installed Neon skill. Project-level `.codex/config.toml` now adds the Neon MCP endpoint scoped to this project with OAuth, without changing global settings. Reload the project to load it; first use may require MCP-specific sign-in. The CLI is already authenticated and performed the database deployment.

## Validation and pending work

See `NEON-SETUP-REPORT.md` and `TEST-REPORT.md`. Passing a local build does not mean the public domain is deployed. Verify final DNS/TLS, installed PWA behavior, optional threat screening and retention scheduling separately.

Neon references: https://neon.com/docs/connect/connection-pooling and the installed `.agents/skills/neon-postgres/SKILL.md`.
