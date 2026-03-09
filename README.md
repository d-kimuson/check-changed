# check-changed

Run checks (lint, typecheck, format, test, etc.) only against changed files in your git repository.

Think of it as [lint-staged](https://github.com/lint-staged/lint-staged) but not limited to staged files — supports untracked, unstaged, staged, branch diffs, and commit SHAs. Designed as a guardrail for AI-assisted development workflows.

## Install

```sh
npm install -g check-changed
```

Or run directly with npx:

```sh
npx check-changed
```

## Quick Start

Generate a config file interactively:

```sh
check-changed setup
```

This presents a list of built-in presets to choose from:

| Preset   | Command                                                    | Group     |
| -------- | ---------------------------------------------------------- | --------- |
| prettier | `prettier --write --no-error-on-unmatched-pattern {FILES}` | format    |
| oxfmt    | `oxfmt {FILES}`                                            | format    |
| eslint   | `eslint {FILES}`                                           | lint      |
| oxlint   | `oxlint {FILES}`                                           | lint      |
| biome    | `biome check --write {FILES}`                              | lint      |
| tsc      | `tsc --noEmit`                                             | typecheck |
| vitest   | `vitest related --run {FILES}`                             | test      |
| jest     | `jest --findRelatedTests --passWithNoTests {FILES}`        | test      |

The result is a `.check-changedrc.json` in your project root.

## Usage

```sh
# Run all checks using defaults from config
check-changed

# Only check staged files
check-changed --changed staged

# Only run lint group
check-changed --target lint

# Combine options
check-changed --changed branch:main --target lint,typecheck

# Preview what would run without executing
check-changed --dry-run

# Machine-readable JSON output
check-changed --format json
```

## Configuration

`.check-changedrc.json`:

```json
{
  "defaults": {
    "changed": "untracked,unstaged,staged,branch:main",
    "target": "all"
  },
  "checks": {
    "typecheck": {
      "pattern": "\\.(m|c)?tsx?$",
      "command": "tsc --noEmit",
      "group": "typecheck"
    },
    "eslint": {
      "pattern": "\\.(m|c)?(j|t)sx?$",
      "command": "eslint {FILES}",
      "group": "lint"
    },
    "vitest": {
      "pattern": "\\.(m|c)?(j|t)sx?$",
      "command": "vitest related --run {FILES}",
      "group": "test"
    }
  }
}
```

### Changed Sources

The `--changed` option (and `defaults.changed`) accepts a comma-separated list of:

| Source          | Git command                                | Description                           |
| --------------- | ------------------------------------------ | ------------------------------------- |
| `untracked`     | `git ls-files --others --exclude-standard` | New files not yet tracked             |
| `unstaged`      | `git diff --name-only`                     | Modified but not staged               |
| `staged`        | `git diff --cached --name-only`            | Staged for commit                     |
| `branch:<name>` | `git diff --name-only <name>...HEAD`       | Changes since branching from `<name>` |
| `sha:<sha>`     | `git diff --name-only <sha>...HEAD`        | Changes since a specific commit       |

### Check Configuration

Each check has the following fields:

| Field              | Required | Description                                                               |
| ------------------ | -------- | ------------------------------------------------------------------------- |
| `pattern`          | Yes      | Regex pattern to match changed files against                              |
| `command`          | Yes      | Command to execute. Use `{FILES}` as a placeholder for matched file paths |
| `group`            | Yes      | Group name for `--target` filtering                                       |
| `config.files-sep` | No       | Separator between file paths (default: `" "`)                             |
| `config.relative`  | No       | Use relative paths instead of absolute (default: `false`)                 |

If a command contains `{FILES}`, it is replaced with the matched file list. If it does not contain `{FILES}`, the command runs as-is when any file matches the pattern (useful for `tsc --noEmit` style whole-project checks).

Checks that match no changed files are skipped.

## CLI Reference

```
Usage: check-changed [options] [command]

Options:
  -V, --version            output the version number
  -h, --help               display help for command

Commands:
  run [options]            Run configured checks against changed files (default)
  setup                    Interactively create or update .check-changedrc.json
  help [command]           display help for command

Run options:
  -c, --changed <sources>  Changed sources (comma-separated)
  -t, --target <groups>    Target groups (comma-separated or "all")
  -d, --dry-run            Show which checks would run without executing
  -f, --format <format>    Output format: text (default) or json
```

## JSON Output

With `--format json`, stdout contains only valid JSON:

```json
{
  "status": "failed",
  "summary": {
    "passed": 2,
    "failed": 1,
    "skipped": 0
  },
  "checks": [
    { "name": "typecheck", "group": "typecheck", "status": "passed", "command": "tsc --noEmit" },
    { "name": "eslint", "group": "lint", "status": "passed", "command": "eslint src/index.ts" },
    {
      "name": "vitest",
      "group": "test",
      "status": "failed",
      "command": "vitest related --run src/index.ts",
      "exitCode": 1,
      "stdout": "...",
      "stderr": "..."
    }
  ]
}
```

Each check has a status of `skip`, `passed`, or `failed`. Failed checks include `exitCode`, `stdout`, and `stderr`. The process exits with code 1 if any check fails.

## License

MIT
