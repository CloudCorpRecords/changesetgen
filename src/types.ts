/**
 * changesetgen types.
 *
 * changesetgen turns the commits of a pull request into a
 * changeset / changelog entry written in the repo's own
 * convention. The caller supplies the commits (and, where
 * known, the files the PR touched and the package the entry
 * is for), and changesetgen reports, as pure local
 * computation:
 *
 *   - a markdown entry: a heading, then one section per
 *     commit-type group with one line per commit, and an
 *     optional trailing Files changed section
 *   - a semver bump suggestion derived from the commits
 *   - the commit and breaking-change counts, and a per-group
 *     summary in the order the groups appear
 *
 * Nothing is fetched, executed, or guessed: the entry is
 * assembled only from the commits supplied.
 */

/** One commit in the PR, as supplied by the caller. */
export interface ChangesetCommit {
  /** Commit description; required and non-empty. */
  description: string;
  /** Commit hash; carried for reference, never printed. */
  hash?: string;
  /** Conventional-commit type, e.g. "feat" or "fix"; missing groups under "other". */
  type?: string;
  /** Commit scope, printed bold at the start of the entry line. */
  scope?: string;
  /** Whether this commit is a breaking change. */
  breaking?: boolean;
}

/** Repo-convention overrides for the generated entry. */
export interface ChangesetConvention {
  /** Heading prefix; defaults to "## Changes". */
  heading_prefix?: string;
  /** Group types in the order they should appear; unlisted groups follow in canonical order. */
  group_order?: string[];
  /** Whether to append the Files changed section; defaults to true. */
  include_files?: boolean;
}

/** The full arguments object for a changeset generation. */
export interface GenerateChangesetArgs {
  /** Commits in the PR; at least one. */
  commits: ChangesetCommit[];
  /** Files changed in the PR, listed in input order when included. */
  files_changed?: string[];
  /** Package name appended to the heading. */
  package_name?: string;
  /** Repo-convention overrides. */
  convention?: ChangesetConvention;
}

/** One group in the output summary, in output order. */
export interface GroupSummary {
  /** The group type, e.g. "feat"; "other" for commits without a type. */
  type: string;
  /** The section label printed in the markdown, e.g. "Features". */
  label: string;
  /** Commits in this group. */
  count: number;
}

/** Semver bump suggestion: major > minor > patch. */
export type Bump = "major" | "minor" | "patch";

/** The generated changeset. */
export interface ChangesetResult {
  /** The assembled markdown entry; no trailing newline. */
  markdown: string;
  bump: Bump;
  commit_count: number;
  breaking_count: number;
  /** Groups in the order they appear in the markdown. */
  groups: GroupSummary[];
}
