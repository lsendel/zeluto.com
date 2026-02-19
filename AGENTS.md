# Repository Guidelines

## Project Structure & Module Organization
Mauntic3 is a pnpm/turbo monorepo. Shared libraries reside in `packages/` (kernel, contracts, UI kit, worker/service libs) while each domain aggregate lives in `packages/domains/*` with matching Drizzle schemas. Runtime workers targeting Cloudflare sit under `workers/*`, and long-running Node/BullMQ services are grouped in `services/*`. Data utilities (`scripts/*.ts`) handle migrations, RLS, and seeds. Every package builds to `dist/` per `turbo.json`, so keep new modules colocated with their owning package.

## Build, Test, and Development Commands
- `pnpm install` – installs workspace dependencies honoring the version catalog.
- `pnpm dev` – orchestrates all package-specific dev tasks (Wrangler, TSX, etc.).
- `pnpm --filter <pkg> dev` – focus on a single worker/service, e.g., `@mauntic/gateway`.
- `pnpm build | test | lint | typecheck` – run Turbo pipelines; tests depend on a fresh build.
- `pnpm --filter <domain> db:generate` and `pnpm tsx scripts/migrate-all.ts` – regenerate Drizzle output and apply migrations/RLS before committing schema changes.

## Coding Style & Naming Conventions
Code is TypeScript targeting ES2022 with strict mode and bundler resolution; JSX is provided by `hono/jsx`. Use kebab-case for directories, PascalCase for exported types/classes, and camelCase elsewhere. Prefer pure business functions plus explicit domain event interfaces (`packages/domain-kernel/src/events`). Keep imports inside the workspace namespace (`@mauntic/...`). Run `pnpm lint` and `pnpm typecheck` before opening a PR.

## Testing Guidelines
Vitest powers all unit tests. Co-locate specs as `*.test.ts` beside the code they cover and mock external systems (Neon, ioredis, BullMQ) to keep suites deterministic. Use `pnpm --filter <pkg> test -- --runInBand` for fixtures that cannot parallelize. Cover every new queue processor, worker route, or domain command with at least one happy-path and one guard-rail assertion.

## Commit & Pull Request Guidelines
Follow the observed convention `type: concise summary (Tasks N-M)` (e.g., `feat: wire service bindings (Tasks 19-20)`) and describe affected packages in the commit body. Pull requests should list scope, linked issue or Task ID, manual verification (e.g., `pnpm build && pnpm test`), and screenshots for UI adjustments in `workers/gateway`. Mention any database or Wrangler commands that reviewers must replay.

## Security & Configuration Notes
Never commit credentials; store Worker secrets via `wrangler secret put` and keep `.env*` local. Use `docker-compose.dev.yml` to spin up Redis/Neon before running queue processors, and re-run `scripts/apply-rls.ts` whenever tables or policies change. Guard every query with the `tenantContext` helpers from `@mauntic/domain-kernel` to preserve isolation.
