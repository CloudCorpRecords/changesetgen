# Changelog

## 0.1.0 (2026-10-27)

- Initial release: `generate_changeset` MCP tool and
  `generate` CLI command producing a changeset / changelog
  entry from a PR's commits.
- Commits grouped by conventional-commit type with fixed
  labels and a canonical group order (overridable via
  `convention.group_order`), scoped and breaking entry
  lines, an optional Files changed section, and a
  major/minor/patch bump suggestion — with path-naming
  validation errors and no partial results.
