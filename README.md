# check-changed

A lightweight adapter for running verification tools (typecheck, lint, format, test) against git-changed files.

In AI-native workflows, agents produce large volumes of code changes. Compound guardrails — type checking, linting, testing — let agents receive automated feedback and self-correct in a tight loop. check-changed makes this simple: run `pnpm check-changed run` and it executes your configured checks, scoped to only the files that changed.

Designed for AI agent integration. Ships with built-in support for [Claude Code hooks](https://docs.anthropic.com/en/docs/claude-code/hooks) and [Copilot CLI hooks](https://docs.github.com/en/copilot/reference/cli-command-reference#agentstop--subagentstop-decision-control) — plug it in and it works.

## Install

```sh
pnpm add -D check-changed
```

## Quick Start

Run the interactive setup to generate a `.check-changedrc.json` config file:

```sh
pnpm check-changed setup
```

The setup wizard walks you through three steps:

1. **Default changed sources** — Which changed files to check (default: `untracked,unstaged,staged,branch:main`). Set the branch to match your workflow, e.g. `branch:main` or `branch:develop`.
2. **Default target groups** — Which check groups to run (default: `all`). You can narrow this down with a comma-separated list like `lint,typecheck`.
3. **Preset selection** — Detects installed dependencies from your `package.json` and pre-selects matching presets (prettier, oxfmt, eslint, oxlint, biome, tsc, tsgo, vitest, jest). Pick the ones you need.

## Usage

```sh
# Run all checks with config defaults
pnpm check-changed run

# Specify changed sources and target groups
pnpm check-changed run --changed untracked,unstaged,staged,branch:dev --target typecheck,lint
```

### As a guardrail for AI agents

Add a completion check to your `CLAUDE.md` (or equivalent context file) so the AI runs checks after making changes:

````markdown
## Completion Criteria

Before completing the task, run the following and fix any errors:

```sh
pnpm check-changed run
```
````

You can also use [Claude Code hooks](https://docs.anthropic.com/en/docs/claude-code/hooks) to automatically enforce checks. Add a `Stop` hook to `.claude/settings.json` — when any check fails, Claude is blocked from stopping and continues to fix the issues:

```json
{
  "hooks": {
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "pnpm check-changed run --format claude-code-hooks"
          }
        ]
      }
    ]
  }
}
```

For [Copilot CLI](https://docs.github.com/en/copilot/reference/cli-command-reference#agentstop--subagentstop-decision-control), add an `agentStop` hook to `.github/hooks/check-changed.json`:

```json
{
  "version": 1,
  "hooks": {
    "agentStop": [
      {
        "type": "command",
        "bash": "pnpm check-changed run --format copilot-cli-hooks"
      }
    ]
  }
}
```

Both hook formats output nothing on success (allowing the agent to stop normally) and output a `{ "decision": "block", "reason": "..." }` JSON response on failure, which tells the agent to keep going and fix the errors.

## Configuration

All configuration lives in `.check-changedrc.json` at your project root:

```json
{
  "$schema": "./node_modules/check-changed/config-schema.json",
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
      "command": "eslint {{CHANGED_FILES}}",
      "group": "lint"
    }
  }
}
```

| Field                                  | Type     | Default      | Description                                                                |
| -------------------------------------- | -------- | ------------ | -------------------------------------------------------------------------- |
| `defaults.changed`                     | `string` | —            | Changed sources (comma-separated). See values below                        |
| `defaults.target`                      | `string` | —            | Check groups to run (comma-separated, or `"all"`)                          |
| `checks.<name>.pattern`                | `string` | —            | Regex matched against changed file paths                                   |
| `checks.<name>.command`                | `string` | —            | Command to run. `{{CHANGED_FILES}}` is replaced with the matched file list |
| `checks.<name>.group`                  | `string` | —            | Group name for `--target` filtering                                        |
| `checks.<name>.changedFiles.separator` | `string` | `" "`        | Separator between file paths                                               |
| `checks.<name>.changedFiles.path`      | `string` | `"relative"` | `"relative"` or `"absolute"`                                               |

If a command omits `{{CHANGED_FILES}}`, it runs as-is whenever any file matches the pattern — useful for whole-project checks like `tsc --noEmit`. Checks with no matching files are skipped.

**Changed source values** for `defaults.changed` and the `--changed` CLI option:

| Value           | Description                           |
| --------------- | ------------------------------------- |
| `untracked`     | New files not yet tracked by git      |
| `unstaged`      | Modified but not staged               |
| `staged`        | Staged for commit                     |
| `branch:<name>` | Changes since branching from `<name>` |
| `sha:<sha>`     | Changes since a specific commit       |

## Patterns

### Workspace / monorepo

Use regex named capture groups to run commands per workspace. Captured values are available as `{{name}}` placeholders in the command:

```json
{
  "typecheck": {
    "pattern": "^packages/(?<pkg>[^/]+)/.*\\.(m|c)?tsx?$",
    "command": "pnpm --filter @myorg/{{pkg}} typecheck",
    "group": "typecheck"
  }
}
```

If `packages/app/src/index.ts` and `packages/lib/src/utils.ts` are both changed, the check runs once per matched workspace (`typecheck[app]`, `typecheck[lib]`).

### Relative paths and custom separators

Some tools expect relative paths or a specific separator:

```json
{
  "oxlint": {
    "pattern": "\\.(m|c)?(j|t)sx?$",
    "command": "oxlint {{CHANGED_FILES}}",
    "group": "lint",
    "changedFiles": { "path": "relative" }
  },
  "prettier": {
    "pattern": "\\.(m|c)?(j|t)sx?$",
    "command": "prettier --write {{CHANGED_FILES}}",
    "group": "format",
    "changedFiles": { "separator": ",", "path": "relative" }
  }
}
```

## License

MIT
