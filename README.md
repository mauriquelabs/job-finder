# Job finder

Job finder automates a job search. Connect an inbox and job-board sources; it collects listings, scores them against your match policy, and keeps a shortlist. It also turns markdown CVs into the A4 PDF you send.

The first connector is Gmail. Alert mail from the boards in `data/sources/job-boards.json` is parsed, scored against `data/match-policy.json`, and written to `data/recommended-jobs.json`. A run is `pnpm poll-email`, by hand or from n8n on this Mac. The public site proofs a CV: paste or edit markdown, preview the A4 page, save into `data/cv/docs/` (local always; Fly needs `CV_SAVE_SECRET`), and download the PDF. Boards with no email channel are listed and not searched yet.

## Requirements

- Node.js 22+
- [pnpm](https://pnpm.io) 10
- A Google Cloud OAuth desktop client with the Gmail API enabled, for the inbox poll
- Playwright Chromium, for PDF generation

## Setup

```bash
pnpm install
pnpm exec playwright install chromium
cp .env.example .env
```

In Google Cloud, create an OAuth desktop client and set the authorized redirect URI to:

```text
http://127.0.0.1:53682/oauth2callback
```

Put the client id and secret in `.env`. The first `pnpm poll-email` opens a browser, asks for read-only Gmail access, and stores the token under `data/.secrets/` (gitignored). Later runs reuse that token.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm poll-email` | Fetch new alerts, score them, update `data/recommended-jobs.json` |
| `pnpm print-gmail-query` | Print the Gmail search the CLI and n8n use |
| `pnpm generate-cv` | Write an A4 PDF for every markdown file in `data/cv/docs/` |
| `pnpm generate-cv -- data/cv/docs/<file>.md` | Write one PDF |
| `pnpm dev` | CV proof on this Mac at `http://127.0.0.1:4317` |
| `pnpm test` | Unit tests (`node:test` via `tsx`) |
| `pnpm typecheck` | Typecheck the CLI, then the Next app |
| `pnpm --filter cv-proof build` | Production build of the CV site |

Generated PDFs land in `data/cv/pdfs/` and are gitignored. Keep the markdown files as the source of truth.

`poll-email` is safe to run twice. A second run does not duplicate recommendations or reprocess messages it has already seen. Status fields you set by hand (`saved`, `dismissed`, `applied`) are left alone.

## How scoring works

`data/match-policy.json` is the taste file: preferred titles and seniority, skills, locations, industries, and titles to reject or downrank. The scorer reads that file. Change the policy, not the code, when the shortlist should shift.

A listing is written to `data/recommended-jobs.json` only when its score meets `recommendThreshold`. Junior and intern titles are rejected. US-only locations are penalized unless the listing is also EU remote.

Treat `data/recommended-jobs.json` as personal data. Do not publish it.

## Inbox trigger

n8n runs on this Mac (not in Docker) and only starts the CLI. Import `n8n/gmail-poll-email.json`, point the command at this repo, and activate the workflow. Setup steps are in [n8n/README.md](n8n/README.md).

```bash
npx n8n
```

The UI is at `http://localhost:5678`. The Mac and n8n both have to be running. If either is off, run `pnpm poll-email` yourself.

Gmail access is `gmail.readonly`. Processed message ids are stored locally. The CLI does not label or modify mail.

## CV proof

`web/` is a Next.js app. Paste markdown, preview the A4 document, load one of the files in `data/cv/docs/`, save edits (overwrite) or Save as new with a role label (`Daniel_Sierra_<Role>_CV.md`), and download the PDF. Preview and PDF use the same document builder in `src/cv/`. Request bodies are capped at 200 KB. Local `pnpm dev` can write the docs folder; on Fly, Save requires `CV_SAVE_SECRET` as `Authorization: Bearer …` (Fly disk is still ephemeral across deploys).

Local:

```bash
pnpm dev
```

Production is one Fly.io machine (`fly.toml`, `Dockerfile`): 1 GB shared CPU, HTTPS, stopped when idle. The first visit after a quiet stretch waits for the machine to start. Deploy when the Fly CLI is logged in:

```bash
fly deploy
```

Pushes to `main` also deploy after tests pass (`.github/workflows/fly-deploy.yml`), using the `FLY_API_TOKEN` secret.

## Layout

```text
src/            CLI: Gmail, parsers, scoring, store, CV document and PDF
web/            CV proof (Next.js). Reuses src/cv
data/           Policy, job boards, CV markdown, recommendations
n8n/            Gmail trigger workflow
tests/          Parser fixtures and unit tests
```

## Tests

```bash
pnpm test
pnpm typecheck
```

Parsers are tested against saved HTML fixtures, not a live mailbox. Do not run `poll-email` or n8n in CI.
