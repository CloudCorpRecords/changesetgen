/**
 * changesetgen core: changeset / changelog entry generation
 * from a pull request's commits.
 *
 *   generateChangeset(args) -> { markdown, bump, ... }
 *
 * Behaviour:
 * - Commits are grouped by their conventional-commit type;
 *   a commit with no type belongs to the "other" group. Each
 *   group prints under a fixed label (feat -> "Features",
 *   fix -> "Fixes", and so on); a type with no fixed label
 *   is labelled by uppercasing its first character.
 * - Groups print in a canonical order (feat, fix, perf,
 *   refactor, docs, test, build, ci, style, chore, revert,
 *   other) with unlisted types last, alphabetically. When
 *   the caller supplies convention.group_order, the groups
 *   named there print first in that order and the rest
 *   follow the canonical order as above.
 * - Inside a group, commits keep their input order. An
 *   entry line is "- <description>", or
 *   "- **<scope>:** <description>" when the commit carries
 *   a scope; a breaking commit's line ends " [breaking]".
 * - The markdown is the heading (the heading prefix,
 *   default "## Changes", plus the package name when one
 *   is given), a blank line, then one "### <Label>" section
 *   per group. When files are included (the default) and
 *   at least one file was supplied, a final
 *   "### Files changed" section lists them in input order.
 *   Sections are joined by single blank lines and the
 *   markdown has no trailing newline.
 * - The bump is "major" when any commit is breaking, else
 *   "minor" when any commit is a feat, else "patch".
 *
 * Validation is strict and path-naming: any malformed input
 * throws an Error naming the offending path (for example
 * "commits[2].description is required") and no partial
 * result is produced.
 */
import type {
  Bump,
  ChangesetCommit,
  ChangesetConvention,
  ChangesetResult,
  GenerateChangesetArgs,
  GroupSummary,
} from "./types.js";

export const VERSION = "0.1.0";

const DEFAULT_HEADING_PREFIX = "## Changes";

const GROUP_LABELS: Record<string, string> = {
  feat: "Features",
  fix: "Fixes",
  perf: "Performance",
  refactor: "Refactoring",
  docs: "Documentation",
  test: "Tests",
  build: "Build",
  ci: "CI",
  style: "Style",
  chore: "Chores",
  revert: "Reverts",
  other: "Other changes",
};

const CANONICAL_ORDER = [
  "feat",
  "fix",
  "perf",
  "refactor",
  "docs",
  "test",
  "build",
  "ci",
  "style",
  "chore",
  "revert",
  "other",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function labelFor(type: string): string {
  const known = GROUP_LABELS[type];
  if (known !== undefined) return known;
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function groupTypeOf(commit: ChangesetCommit): string {
  return commit.type === undefined || commit.type === ""
    ? "other"
    : commit.type;
}

function validateCommit(raw: unknown, index: number): ChangesetCommit {
  const path = `commits[${index}]`;
  if (!isRecord(raw)) throw new Error(`${path} must be an object`);
  if (raw.description === undefined) {
    throw new Error(`${path}.description is required`);
  }
  if (typeof raw.description !== "string" || raw.description.length === 0) {
    throw new Error(`${path}.description must be a non-empty string`);
  }
  if (raw.hash !== undefined && typeof raw.hash !== "string") {
    throw new Error(`${path}.hash must be a string`);
  }
  if (raw.type !== undefined && typeof raw.type !== "string") {
    throw new Error(`${path}.type must be a string`);
  }
  if (raw.scope !== undefined && typeof raw.scope !== "string") {
    throw new Error(`${path}.scope must be a string`);
  }
  if (raw.breaking !== undefined && typeof raw.breaking !== "boolean") {
    throw new Error(`${path}.breaking must be a boolean`);
  }
  const commit: ChangesetCommit = { description: raw.description };
  if (raw.hash !== undefined) commit.hash = raw.hash;
  if (raw.type !== undefined) commit.type = raw.type;
  if (raw.scope !== undefined) commit.scope = raw.scope;
  if (raw.breaking !== undefined) commit.breaking = raw.breaking;
  return commit;
}

function validateConvention(raw: unknown): ChangesetConvention | undefined {
  if (raw === undefined) return undefined;
  if (!isRecord(raw)) throw new Error("convention must be an object");
  if (
    raw.heading_prefix !== undefined &&
    typeof raw.heading_prefix !== "string"
  ) {
    throw new Error("convention.heading_prefix must be a string");
  }
  if (raw.group_order !== undefined) {
    if (!Array.isArray(raw.group_order)) {
      throw new Error("convention.group_order must be an array");
    }
    raw.group_order.forEach((entry, i) => {
      if (typeof entry !== "string") {
        throw new Error(`convention.group_order[${i}] must be a string`);
      }
    });
  }
  if (raw.include_files !== undefined && typeof raw.include_files !== "boolean") {
    throw new Error("convention.include_files must be a boolean");
  }
  const convention: ChangesetConvention = {};
  if (raw.heading_prefix !== undefined) {
    convention.heading_prefix = raw.heading_prefix;
  }
  if (raw.group_order !== undefined) {
    convention.group_order = [...(raw.group_order as string[])];
  }
  if (raw.include_files !== undefined) {
    convention.include_files = raw.include_files;
  }
  return convention;
}

function validateArgs(raw: unknown): GenerateChangesetArgs {
  if (!isRecord(raw)) throw new Error("arguments must be an object");
  if (raw.commits === undefined) throw new Error("commits is required");
  if (!Array.isArray(raw.commits) || raw.commits.length === 0) {
    throw new Error("commits must be a non-empty array");
  }
  const commits = raw.commits.map((c, i) => validateCommit(c, i));

  let filesChanged: string[] | undefined;
  if (raw.files_changed !== undefined) {
    if (!Array.isArray(raw.files_changed)) {
      throw new Error("files_changed must be an array");
    }
    raw.files_changed.forEach((entry, i) => {
      if (typeof entry !== "string") {
        throw new Error(`files_changed[${i}] must be a string`);
      }
    });
    filesChanged = [...(raw.files_changed as string[])];
  }

  if (raw.package_name !== undefined && typeof raw.package_name !== "string") {
    throw new Error("package_name must be a string");
  }

  const args: GenerateChangesetArgs = { commits };
  if (filesChanged !== undefined) args.files_changed = filesChanged;
  if (raw.package_name !== undefined) args.package_name = raw.package_name;
  const convention = validateConvention(raw.convention);
  if (convention !== undefined) args.convention = convention;
  return args;
}

function orderGroups(
  present: Set<string>,
  groupOrder: string[] | undefined,
): string[] {
  const ordered: string[] = [];
  const push = (type: string) => {
    if (present.has(type) && !ordered.includes(type)) ordered.push(type);
  };
  if (groupOrder !== undefined) {
    for (const type of groupOrder) push(type);
  }
  for (const type of CANONICAL_ORDER) push(type);
  const unlisted = [...present]
    .filter((type) => !CANONICAL_ORDER.includes(type) && !ordered.includes(type))
    .sort();
  for (const type of unlisted) push(type);
  return ordered;
}

function entryLine(commit: ChangesetCommit): string {
  const base =
    commit.scope !== undefined && commit.scope !== ""
      ? `- **${commit.scope}:** ${commit.description}`
      : `- ${commit.description}`;
  return commit.breaking === true ? `${base} [breaking]` : base;
}

/** Generate a changeset entry from the supplied PR commits. */
export function generateChangeset(rawArgs: unknown): ChangesetResult {
  const args = validateArgs(rawArgs);
  const convention = args.convention ?? {};
  const headingPrefix = convention.heading_prefix ?? DEFAULT_HEADING_PREFIX;
  const includeFiles = convention.include_files ?? true;

  // Bucket commits by group type, preserving input order inside a group.
  const buckets = new Map<string, ChangesetCommit[]>();
  for (const commit of args.commits) {
    const type = groupTypeOf(commit);
    const bucket = buckets.get(type);
    if (bucket) bucket.push(commit);
    else buckets.set(type, [commit]);
  }

  const orderedTypes = orderGroups(new Set(buckets.keys()), convention.group_order);

  const groups: GroupSummary[] = orderedTypes.map((type) => ({
    type,
    label: labelFor(type),
    count: buckets.get(type)?.length ?? 0,
  }));

  const heading =
    args.package_name !== undefined
      ? `${headingPrefix} ${args.package_name}`
      : headingPrefix;

  const sections: string[] = [heading];
  for (const type of orderedTypes) {
    const lines = (buckets.get(type) ?? []).map(entryLine);
    sections.push(`### ${labelFor(type)}\n${lines.join("\n")}`);
  }
  if (
    includeFiles &&
    args.files_changed !== undefined &&
    args.files_changed.length > 0
  ) {
    const fileLines = args.files_changed.map((file) => `- ${file}`);
    sections.push(`### Files changed\n${fileLines.join("\n")}`);
  }
  const markdown = sections.join("\n\n");

  const breakingCount = args.commits.filter((c) => c.breaking === true).length;
  const bump: Bump =
    breakingCount > 0
      ? "major"
      : args.commits.some((c) => groupTypeOf(c) === "feat")
        ? "minor"
        : "patch";

  return {
    markdown,
    bump,
    commit_count: args.commits.length,
    breaking_count: breakingCount,
    groups,
  };
}

/** Render a payload as the JSON text block MCP clients show. */
export function formatPayload(payload: unknown): string {
  return typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
}
