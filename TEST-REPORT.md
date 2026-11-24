# Verification — November 24, 2026

- `npm run build`: passed after migration to direct PostgreSQL access.
- `npm run typecheck`: passed.
- `npm test`: all 7 groups passed, including URL/alias/expiration validation and TLS connection URL handling.
- Local PostgreSQL smoke tests: passed during conversion.
- Neon child branch `tereeza-verify-20261124`: migration applied and full E2E suite passed.
- Neon production branch: migration applied, full E2E suite passed, and migration rerun reported already applied.
- E2E starts the built production Next.js app on localhost:3100 and verifies client-side TLS encryption/certificate verification, creation, alias collisions, invalid URLs/JSON, wrong-origin rejection, authorization, noncached redirects, analytics/referrer privacy, daily deduplication, bot/HEAD exclusion, expiration, admin moderation, abuse reports, HTTP limits, atomic concurrent SQL limits, logout and PWA assets.
- Test records are uniquely named and removed after each run. No user records are reset. No database credentials are printed.
- Neon skills: both up to date. Neon MCP: project-level OAuth config installed, to load on project reload; this chat used the authenticated CLI.

Actual command output: `VERIFICATION-OUTPUT.txt`. Complete change/failure record: `NEON-SETUP-REPORT.md`.

Reproduce with `npm run db:migrate`, `npm run build`, and `npm run test:e2e` using the privately stored Neon variables. The test app stops automatically after the suite.

Public Vercel hosting, DNS/TLS for the custom domain, real Google Web Risk screening, retention scheduler, native sharing, QR phone scanning and installed PWA behavior still need final launch checks.
