## Project Overview

check-changed: CLI tool that runs checks (lint, typecheck, format, test) against git-changed files.
Single-package repo, no monorepo.

## Tech Stack

- Runtime: Node.js 24+
- Language: TypeScript (strictest tsconfig)
- Build: tsdown
- Lint: oxlint (type-aware) + oxfmt
- Test: vitest
- Dependencies: commander, inquirer, valibot

## Commands

- `pnpm cli` — Run CLI without building (tsx)
- `pnpm test` — Run tests
- `pnpm typecheck` — Type-check
- `pnpm lint` — Lint + format check
- `pnpm fix` — Auto-fix lint + format
- `pnpm build` — Build to dist/

## Key Conventions

- Arrow functions only (`const fn = () => {}`)
- No `as` type assertions, no `is` type guards
- `as const satisfies` for constant objects
- No `console.log` — use `log`/`logError` from `src/logger.ts` (oxlint no-console rule)
- Discriminated unions for ADTs (see `CheckResult`, `ChangedSource` in `src/types.ts`)
- Pre-commit hook via lefthook: runs oxlint + oxfmt on staged files

## Architecture

- `src/bin.ts` — CLI entrypoint (commander)
- `src/types.ts` — Type definitions (ADTs)
- `src/config.ts` — Config loading + valibot schema
- `src/git.ts` — Git diff → file list
- `src/matcher.ts` — Glob matching via `path.matchesGlob`
- `src/runner.ts` — Command building, execution, reporting (text + JSON)
- `src/presets.ts` — Built-in check presets
- `src/setup.ts` — Interactive setup (inquirer)
