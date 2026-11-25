# Job finder

Job finder automates a job search. Connect an inbox and job-board sources; it collects listings, scores them against a match policy, and keeps a shortlist. The same system turns markdown CVs into the A4 PDF you send.

The first connector is Gmail. n8n on this Mac watches Gmail for every `emailAddress` in `data/sources/job-boards.json` and runs `pnpm poll-email`. The CLI parses listings, scores them with `data/match-policy.json`, and writes matches to `data/recommended-jobs.json`. The candidate bio is `data/cv/raw/daniel-sierra.json`. Markdown CVs live in `data/cv/docs/`. Sources with no email channel are listed and not searched yet. Active search for those sources is not built.

The public site is a Next.js app in `web/`. Paste markdown, preview the existing A4 document, download the PDF. No password. The public host is Fly.io, one 1 GB machine that stops when idle.

## Stack

- TypeScript (strict, ESM) on Node.js 22+
- pnpm (workspace: repo root + `web/`)
- `tsx` to run the CLI and tests
- Next.js (App Router) in `web/` for CV proof
- `googleapis` / `google-auth-library` for Gmail (`gmail.readonly`)
- `zod` to validate JSON data files
- `cheerio` to parse job-alert HTML
- `marked` and Playwright Chromium for the CV HTML document and A4 PDF
- n8n on the Mac (host process, not Docker) as the Gmail trigger

## Build and test commands

- `pnpm install` — dependencies
- `pnpm typecheck` — `tsc --noEmit` for the CLI, then the Next app
- `pnpm test` — `node:test` via `tsx`
- `pnpm dev` — CV proof on this Mac at `http://127.0.0.1:4317`
- `pnpm poll-email` — fetch new alerts, score, update `data/recommended-jobs.json` (safe to run by hand)
- `pnpm generate-cv` — generate A4 PDFs in `data/cv/pdfs/` from every markdown file in `data/cv/docs/`
- `pnpm generate-cv -- data/cv/docs/<file>.md` — generate one CV PDF
- `pnpm print-gmail-query` — print the Gmail search used by the CLI and n8n
- `pnpm --filter cv-proof build` — production Next.js build
- `npx n8n` — start n8n locally; UI at `http://localhost:5678`

First-time PDF generation: run `pnpm exec playwright install chromium`. Generated PDFs are gitignored; keep the markdown files as the source of truth.

First-time Gmail for the CLI: create a Google Cloud OAuth desktop client with redirect URI `http://127.0.0.1:53682/oauth2callback`, copy `.env.example` to `.env`, then run `poll-email` once to complete the local OAuth flow. Tokens go in `data/.secrets/` (gitignored).

n8n: import `n8n/gmail-poll-email.json` (see `n8n/README.md`). Gmail Trigger → Execute Command `pnpm poll-email`. Connect Gmail in n8n’s credential UI (same OAuth client is fine). n8n still polls Gmail about once a minute. The Mac and n8n must be running; if either is off, run `poll-email` yourself.

Fly.io: `fly.toml` and the Dockerfile are the deploy config. One shared 1 GB machine, HTTPS, auto-stop when idle. The first visit after a quiet stretch waits for the machine to start. Deploy with `fly deploy` when the Fly CLI is logged in.

## Code style guidelines

- TypeScript strict; no `any` unless a vendor type forces it, and then only at the boundary
- ESM only; use `.js` extensions in relative imports if NodeNext requires them
- Keep scoring deterministic and driven by `data/match-policy.json`, not hardcoded taste
- The CLI is the engine (parse, score, store). n8n only starts a run; do not put scoring logic in n8n
- Do not scrape LinkedIn, Glassdoor, or Welcome to the Jungle; email is the Phase 1 channel
- Prefer small modules (gmail, parsers, scoring, store, cv) over a single script
- CV proof lives in `web/` and reuses `src/cv/` for HTML and PDF. Do not reimplement the CV as React components
- Preview and PDF share one document builder. Do not store or log pasted CV text. Chromium does not fetch remote URLs while printing
- Do not add auto-apply, an LLM judge, Zapier, or n8n Cloud unless explicitly requested

## Testing instructions

- Unit-test parsers with saved fixtures (anonymized HTML/text), not live Gmail
- Unit-test the scorer against `match-policy.json` cases: recommend, reject junior, downrank EM-only, location miss
- Store tests: dedupe by URL; never overwrite `saved` / `dismissed` / `applied`
- CLI must be idempotent: a second `poll-email` (or a double n8n fire) must not duplicate recommendations
- Do not run `poll-email` or n8n in CI (needs a real mailbox)
- Unit-test CV document assembly and the preview/PDF request handlers with a stub renderer; do not launch Chromium or Next in those tests

## Security considerations

- Never commit `.env`, OAuth client secrets, tokens, n8n credential exports, or raw mailbox exports
- Gmail scope is `gmail.readonly`; persist processed message ids locally instead of labeling mail
- Do not log full email bodies, access tokens, or pasted CV markdown
- Treat `data/recommended-jobs.json` as personal data; do not publish it
- Keep n8n data in the local user folder (`~/.n8n`); do not commit it
- The CV site is public. Cap request bodies at 200 KB, reject empty markdown, and do not persist pasted text on Fly without auth. Local `pnpm dev` may Save into `data/cv/docs/`. On Fly, Save requires `CV_SAVE_SECRET` as `Authorization: Bearer …` (writes are still ephemeral on the machine image).
