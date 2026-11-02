# changesetgen — Build Report

MCP Rebuild 1000, Batch 13. Original program build from the
packages-100 plan (cluster A #6), built from the spec in
`~/workspace/mcp-rebuild-100/specs-batch13/changesetgen.md`
(read first). There is no external original; the tool
surface is the program's defined spec. Local build only —
nothing pushed or published.

Identity: repo `changesetgen`, npm
`@reneturcios/changesetgen`, MCP name
`io.github.CloudCorpRecords/changesetgen`, version `0.1.0`,
bin `changesetgen` → `dist/cli.js`.

## Files created (19/19 per TEMPLATE.md checklist)

- `package.json`, `server.json` (description "Changeset
  and changelog entries from PR commits, grouped by type
  in the repo's own convention.", 94 chars ≤100; npm entry
  carries `version: 0.1.0`; OCI entry
  `ghcr.io/cloudcorprecords/changesetgen:0.1.0` carries
  **no** `version` field), `Dockerfile` (node:20-alpine
  two-stage, label
  `io.modelcontextprotocol.server.name="io.github.CloudCorpRecords/changesetgen"`),
  `tsconfig.json`, `.gitignore`, `LICENSE` (MIT, Copyright
  (c) 2026 Rene Turcios), `README.md` (fresh text),
  `CHANGELOG.md` (single 0.1.0 entry, 2026-10-27),
  `package-lock.json` (Route 3, see below)
- `src/index.ts`, `src/cli.ts` (`generate --input
  <args.json>` where the file holds the full arguments
  object, `mcp`, `--version`; exit 2 usage / 1 runtime
  error, argument validation before any file read),
  `src/mcp.ts`, `src/types.ts`, `src/changesetgen.ts`
  (core, `VERSION = "0.1.0"`)
- `test/changesetgen.test.ts`
- `.github/workflows/{ci,publish,publish-container,registry-publish}.yml`
  (publish-container `IMAGE =
  ghcr.io/cloudcorprecords/changesetgen`, smoke-test
  server-name assertion `changesetgen`)

## Tools implemented (1)

- `generate_changeset` — arguments: `commits` (array,
  required, minItems 1) of `{description (string, required,
  non-empty), hash (string, optional; carried, not
  printed), type (string, optional), scope (string,
  optional), breaking (boolean, optional)}`, plus
  `files_changed` (array of strings, optional),
  `package_name` (string, optional), and `convention`
  (object, optional) of `{heading_prefix (string, optional,
  default "## Changes"), group_order (array of strings,
  optional), include_files (boolean, optional, default
  true)}`.

  Returns `{markdown, bump, commit_count, breaking_count,
  groups}`: commits are grouped by type (missing type →
  `other`) under the fixed label map (feat Features, fix
  Fixes, perf Performance, refactor Refactoring, docs
  Documentation, test Tests, build Build, ci CI, style
  Style, chore Chores, revert Reverts, other Other
  changes; an unlisted type's label uppercases its first
  character). Groups print in the canonical order
  [feat, fix, perf, refactor, docs, test, build, ci,
  style, chore, revert, other] with unlisted types last,
  alphabetically; `group_order` pulls its named groups to
  the front in its order and the rest follow canonically.
  Entry lines keep input order inside a group:
  `- **<scope>:** <description>` with a scope, else
  `- <description>`, plus a ` [breaking]` suffix on
  breaking commits. The markdown is the heading
  (prefix + package name when given), a blank line, one
  `### <Label>` section per group, and — when files are
  included and `files_changed` is non-empty — a final
  `### Files changed` section in input order; sections
  are joined by single blank lines with no trailing
  newline. `bump` is `major` when any commit is breaking,
  else `minor` when any commit is a feat, else `patch`.
  `groups` lists `{type, label, count}` in output order.

  The fixture literal
  (`harness/fixtures/changesetgen-tools-original.json`)
  and the `src/mcp.ts` literal are identical, with no
  `$schema` and no `additionalProperties`.

## Implementation notes

- `src/mcp.ts` uses the SDK's low-level `Server` with an
  explicit inputSchema literal exactly matching the
  fixture, per the standing fleet rule (no McpServer/zod
  schema conversion). Every `tools/call` is validated by
  the core itself, so the MCP and CLI paths share one
  validation implementation.
- Validation is path-naming and total: missing/empty
  `commits`, a commit missing or with an empty
  `description`, a non-string `type`/`scope`/`hash`, a
  non-boolean `breaking`, a non-string `files_changed`
  entry, a non-string `package_name`, or a wrongly typed
  convention field throws an Error naming the offending
  path (e.g. `commits[2].description is required`) and
  produces no partial result (MCP: `isError`; CLI:
  exit 1).
- Local choices where the spec is silent (see also
  "Gaps"): an empty-string `type` groups under `other`
  like a missing type; an empty-string `scope` prints as
  an unscoped entry; duplicate `group_order` entries and
  entries naming groups with no commits are ignored.

## Verification (foreground, this session)

- `npx tsc` exit 0 (`dist/cli.js` built)
- `npm test` (`tsx --test test/*.test.ts`): **32 tests,
  32 pass, 0 fail** — the full label map, missing type →
  other, unlisted-type labels, canonical group order,
  unlisted types last alphabetically, `group_order`
  override (including pulling an unlisted type forward
  and ignoring absent groups), input order within a
  group, scoped/unscoped entry lines, the `[breaking]`
  suffix on scoped and unscoped lines (and its absence
  when `breaking: false`), exact markdown assembly,
  the Files changed section in input order,
  `include_files: false` and empty/absent `files_changed`
  omitting it, package-name and custom heading prefixes,
  the hash never printed, bump major/minor/patch,
  commit/breaking counts and the groups summary, and
  every validation path (missing/empty commits, non-object
  commit, missing/empty/non-string description naming the
  indexed path, non-string type/scope/hash, non-boolean
  breaking, non-array/non-string `files_changed`,
  non-string `package_name`, and each wrongly typed
  convention field)
- `dist/cli.js --version` → `0.1.0`; unknown command
  exits 2 with usage; `generate` with no `--input` exits
  2; `generate --input <missing file>` exits 1 naming the
  file; `generate --input <valid file>` exits 0 and
  prints the changeset JSON (hand-verified exactly:
  markdown `## Changes my-pkg` heading, Features group
  with `- **ui:** add export button` and
  `- **api:** drop the v1 endpoints [breaking]`, Fixes
  group, Files changed section, bump `major`,
  commit_count 3, breaking_count 1, the commit hash not
  printed); `generate --input <invalid file>` exits 1
  with `commits[2].description is required`
- Parity: `harness/parity.py` vs
  `harness/fixtures/changesetgen-tools-original.json` →
  **PASS, parity 100.0, identical_tools 1/1**

## Lockfile status

`package-lock.json` generated clean via Route 3 (temp copy
without `node_modules`/`dist`/`package-lock.json`, offline
`npm install --package-lock-only --ignore-scripts
--offline`), verified: parses, name
`@reneturcios/changesetgen`, **128 package entries**. Local
`node_modules` was installed via `npm install
--ignore-scripts --offline` for build/test; gitignored.

## Gaps / honest notes

- **Empty-string type/scope:** the spec defines a missing
  `type` as grouping under `other` and a present `scope`
  as printing bolded, but says nothing about empty
  strings. Both are treated as absent (an empty type
  groups under `other`; an empty scope prints a plain
  entry line) rather than producing an empty group or a
  `- **:**` line; the choices are recorded here and the
  behaviour is plain in the core.
- **group_order duplicates/absent names:** the spec says
  groups named in `group_order` appear first in that
  order; duplicates are collapsed to their first mention
  and names with no commits produce no section, which is
  the only reading under which `groups` stays a summary
  of the groups actually printed.
- Container build not exercised locally; the
  publish-container workflow smoke-tests the image at
  publish time.
- Nothing pushed or published; this is a local build only.
