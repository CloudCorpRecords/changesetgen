# changesetgen

Every pull request eventually needs a changeset: the short
markdown entry that tells the next release what changed and
how big the version bump should be. changesetgen writes
that entry from the PR's commits for you, in the repo's own
convention:

- **Grouped by type** — commits are bucketed by their
  conventional-commit type and printed under fixed section
  labels (Features, Fixes, Performance, Refactoring,
  Documentation, Tests, Build, CI, Style, Chores, Reverts,
  Other changes). A type with no fixed label is printed with
  its first character uppercased, and a commit with no type
  lands in Other changes.
- **Ordered your way** — groups follow a canonical order by
  default; pass `convention.group_order` to pull the groups
  you care about to the front, and the rest still follow in
  canonical order with unlisted types last, alphabetically.
  Inside a group, commits keep the order you supplied them.
- **Entry lines that carry the details** — a scoped commit
  prints as `- **scope:** description`, and a breaking
  commit's line ends with ` [breaking]`, so the risky
  changes are visible at a glance.
- **Files changed** — when you supply the PR's file list,
  a closing Files changed section lists it in input order;
  turn it off with `convention.include_files: false`.
- **Bump suggestion** — `major` when anything is breaking,
  else `minor` when any commit is a feat, else `patch`,
  alongside the commit count, the breaking count, and a
  per-group summary in output order.

The heading defaults to `## Changes`, takes your package
name when you pass one, and can be replaced entirely with
`convention.heading_prefix`. Commit hashes are accepted for
reference but never printed. The computation is pure and
local: no network, no configuration, no files read beyond
the arguments you pass in. Invalid input — an empty commit
list, a commit without a description, a mistyped field —
is rejected with an error naming the offending path, and
no partial entry is produced.

## CLI

```bash
npx @reneturcios/changesetgen generate --input args.json
npx @reneturcios/changesetgen --version
```

`args.json` contains the full arguments object:

```json
{
  "commits": [
    { "type": "feat", "scope": "ui", "description": "add export button" },
    { "type": "fix", "description": "stop crash on empty file", "hash": "abc123" },
    { "type": "feat", "scope": "api", "description": "drop the v1 endpoints", "breaking": true }
  ],
  "files_changed": ["src/export.ts", "src/api.ts"],
  "package_name": "my-pkg",
  "convention": { "group_order": ["feat", "fix"] }
}
```

Only `commits` is required, and only `description` is
required per commit. The generated changeset is printed
as JSON: `{markdown, bump, commit_count, breaking_count,
groups}`.

Exit codes: `0` on success, `1` on a runtime error
(including an unreadable or invalid input file, or invalid
input), `2` on a usage error.

## MCP server

```bash
npx -y @reneturcios/changesetgen mcp
```

MCP client config:

```json
{
  "mcpServers": {
    "changesetgen": {
      "command": "npx",
      "args": ["-y", "@reneturcios/changesetgen", "mcp"]
    }
  }
}
```

### Tools

- `generate_changeset` — Generate a changeset and
  changelog entry from a PR's commits.
  - `commits` (array, required, at least one) — commits as
    `{description, hash?, type?, scope?, breaking?}`
    objects; `description` is required and non-empty
  - `files_changed` (array of strings, optional) — files
    the PR touched, listed in the Files changed section
  - `package_name` (string, optional) — appended to the
    heading
  - `convention` (object, optional) — `{heading_prefix?,
    group_order?, include_files?}` overrides for the
    heading text, the group order, and whether the files
    section appears

  Returns `{markdown, bump, commit_count, breaking_count,
  groups}`.

## Docker

```bash
docker run -i ghcr.io/cloudcorprecords/changesetgen
docker run --rm -v "$PWD:/w" ghcr.io/cloudcorprecords/changesetgen generate --input /w/args.json
```

## Development

```bash
npm install
npm run build   # tsc -> dist/
npm test        # tsx --test test/*.test.ts (pure local, no network)
npm run dev     # run the CLI from source
```

## License

MIT — Copyright (c) 2026 Rene Turcios
