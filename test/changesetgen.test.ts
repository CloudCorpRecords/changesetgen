import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateChangeset } from "../src/changesetgen.js";

/**
 * All tests are pure local computation over inline commit
 * lists: no filesystem, no network. Each behaviour in the
 * spec is pinned by its own case, including every
 * validation path.
 */

const c = (
  description: string,
  extra: Record<string, unknown> = {},
): Record<string, unknown> => ({ description, ...extra });

describe("generateChangeset — group labels", () => {
  it("maps every canonical type to its fixed label", () => {
    const types = [
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
    ];
    const out = generateChangeset({
      commits: types.map((t) => c(`${t} change`, { type: t })),
    });
    assert.deepEqual(
      out.groups.map((g) => [g.type, g.label]),
      [
        ["feat", "Features"],
        ["fix", "Fixes"],
        ["perf", "Performance"],
        ["refactor", "Refactoring"],
        ["docs", "Documentation"],
        ["test", "Tests"],
        ["build", "Build"],
        ["ci", "CI"],
        ["style", "Style"],
        ["chore", "Chores"],
        ["revert", "Reverts"],
      ],
    );
  });

  it("groups a commit with no type under other / Other changes", () => {
    const out = generateChangeset({ commits: [c("mystery change")] });
    assert.deepEqual(out.groups, [
      { type: "other", label: "Other changes", count: 1 },
    ]);
    assert.ok(out.markdown.includes("### Other changes"));
  });

  it("labels an unlisted type by uppercasing its first character", () => {
    const out = generateChangeset({
      commits: [
        c("patch a CVE", { type: "security" }),
        c("bump a dependency", { type: "deps" }),
      ],
    });
    assert.deepEqual(out.groups, [
      { type: "deps", label: "Deps", count: 1 },
      { type: "security", label: "Security", count: 1 },
    ]);
  });
});

describe("generateChangeset — group order", () => {
  it("follows the canonical order regardless of input order", () => {
    const out = generateChangeset({
      commits: [
        c("tidy", { type: "chore" }),
        c("document", { type: "docs" }),
        c("repair", { type: "fix" }),
        c("introduce", { type: "feat" }),
        c("untyped"),
      ],
    });
    assert.deepEqual(
      out.groups.map((g) => g.type),
      ["feat", "fix", "docs", "chore", "other"],
    );
  });

  it("places unlisted types after the canonical groups, alphabetically", () => {
    const out = generateChangeset({
      commits: [
        c("z change", { type: "zebra" }),
        c("a change", { type: "alpha" }),
        c("f change", { type: "feat" }),
      ],
    });
    assert.deepEqual(
      out.groups.map((g) => g.type),
      ["feat", "alpha", "zebra"],
    );
  });

  it("honours group_order first, then the canonical order for the rest", () => {
    const out = generateChangeset({
      commits: [
        c("introduce", { type: "feat" }),
        c("repair", { type: "fix" }),
        c("document", { type: "docs" }),
      ],
      convention: { group_order: ["fix", "feat"] },
    });
    assert.deepEqual(
      out.groups.map((g) => g.type),
      ["fix", "feat", "docs"],
    );
    assert.ok(
      out.markdown.indexOf("### Fixes") < out.markdown.indexOf("### Features"),
    );
  });

  it("lets group_order pull an unlisted type to the front", () => {
    const out = generateChangeset({
      commits: [
        c("introduce", { type: "feat" }),
        c("patch a CVE", { type: "security" }),
      ],
      convention: { group_order: ["security"] },
    });
    assert.deepEqual(
      out.groups.map((g) => g.type),
      ["security", "feat"],
    );
  });

  it("ignores group_order entries with no matching commits", () => {
    const out = generateChangeset({
      commits: [c("repair", { type: "fix" })],
      convention: { group_order: ["feat", "perf"] },
    });
    assert.deepEqual(
      out.groups.map((g) => g.type),
      ["fix"],
    );
  });

  it("keeps commits in input order within a group", () => {
    const out = generateChangeset({
      commits: [
        c("second feature", { type: "feat" }),
        c("a fix", { type: "fix" }),
        c("first feature", { type: "feat" }),
      ],
    });
    const features = out.markdown.split("### Features\n")[1].split("\n\n")[0];
    assert.equal(features, "- second feature\n- first feature");
  });
});

describe("generateChangeset — entry lines and markdown", () => {
  it("formats an unscoped entry as a plain dash line", () => {
    const out = generateChangeset({
      commits: [c("add export button", { type: "feat" })],
    });
    assert.equal(out.markdown, "## Changes\n\n### Features\n- add export button");
  });

  it("formats a scoped entry with the scope bolded and colon inside the bold", () => {
    const out = generateChangeset({
      commits: [c("add export button", { type: "feat", scope: "ui" })],
    });
    assert.equal(
      out.markdown,
      "## Changes\n\n### Features\n- **ui:** add export button",
    );
  });

  it("appends the [breaking] suffix to breaking entries, scoped or not", () => {
    const out = generateChangeset({
      commits: [
        c("drop the v1 API", { type: "feat", scope: "api", breaking: true }),
        c("rename the config file", { type: "fix", breaking: true }),
        c("ordinary fix", { type: "fix", breaking: false }),
      ],
    });
    assert.ok(out.markdown.includes("- **api:** drop the v1 API [breaking]"));
    assert.ok(out.markdown.includes("- rename the config file [breaking]"));
    assert.ok(out.markdown.includes("- ordinary fix\n") || out.markdown.endsWith("- ordinary fix"));
    assert.ok(!out.markdown.includes("ordinary fix [breaking]"));
  });

  it("assembles the full markdown: heading, blank lines, groups, no trailing newline", () => {
    const out = generateChangeset({
      commits: [
        c("add export button", { type: "feat", scope: "ui" }),
        c("stop crash on empty file", { type: "fix" }),
        c("tweak internals"),
      ],
    });
    assert.equal(
      out.markdown,
      "## Changes\n\n### Features\n- **ui:** add export button\n\n### Fixes\n- stop crash on empty file\n\n### Other changes\n- tweak internals",
    );
    assert.ok(!out.markdown.endsWith("\n"));
  });

  it("appends a Files changed section listing files in input order", () => {
    const out = generateChangeset({
      commits: [c("add thing", { type: "feat" })],
      files_changed: ["src/a.ts", "README.md", "src/b.ts"],
    });
    assert.equal(
      out.markdown,
      "## Changes\n\n### Features\n- add thing\n\n### Files changed\n- src/a.ts\n- README.md\n- src/b.ts",
    );
  });

  it("omits the Files changed section when include_files is false", () => {
    const out = generateChangeset({
      commits: [c("add thing", { type: "feat" })],
      files_changed: ["src/a.ts"],
      convention: { include_files: false },
    });
    assert.equal(out.markdown, "## Changes\n\n### Features\n- add thing");
  });

  it("omits the Files changed section when files_changed is empty or absent", () => {
    const empty = generateChangeset({
      commits: [c("add thing", { type: "feat" })],
      files_changed: [],
    });
    assert.ok(!empty.markdown.includes("Files changed"));
    const absent = generateChangeset({
      commits: [c("add thing", { type: "feat" })],
      convention: { include_files: true },
    });
    assert.ok(!absent.markdown.includes("Files changed"));
  });

  it("appends the package name to the heading", () => {
    const out = generateChangeset({
      commits: [c("fix it", { type: "fix" })],
      package_name: "my-pkg",
    });
    assert.equal(out.markdown, "## Changes my-pkg\n\n### Fixes\n- fix it");
  });

  it("uses a custom heading_prefix, with and without a package name", () => {
    const plain = generateChangeset({
      commits: [c("fix it", { type: "fix" })],
      convention: { heading_prefix: "## Release notes" },
    });
    assert.ok(plain.markdown.startsWith("## Release notes\n\n"));
    const named = generateChangeset({
      commits: [c("fix it", { type: "fix" })],
      package_name: "my-pkg",
      convention: { heading_prefix: "# Changelog" },
    });
    assert.ok(named.markdown.startsWith("# Changelog my-pkg\n\n"));
  });

  it("never prints the commit hash", () => {
    const out = generateChangeset({
      commits: [c("add thing", { type: "feat", hash: "abc123def" })],
    });
    assert.ok(!out.markdown.includes("abc123def"));
  });
});

describe("generateChangeset — bump and summary", () => {
  it("suggests major when any commit is breaking, even without a feat", () => {
    const out = generateChangeset({
      commits: [c("change the defaults", { type: "fix", breaking: true })],
    });
    assert.equal(out.bump, "major");
    assert.equal(out.breaking_count, 1);
  });

  it("suggests minor when a feat is present and nothing is breaking", () => {
    const out = generateChangeset({
      commits: [c("repair", { type: "fix" }), c("introduce", { type: "feat" })],
    });
    assert.equal(out.bump, "minor");
    assert.equal(out.breaking_count, 0);
  });

  it("suggests patch when there is no feat and nothing breaking", () => {
    const out = generateChangeset({
      commits: [
        c("repair", { type: "fix" }),
        c("document", { type: "docs" }),
        c("untyped"),
      ],
    });
    assert.equal(out.bump, "patch");
  });

  it("reports commit_count, breaking_count, and the groups summary in output order", () => {
    const out = generateChangeset({
      commits: [
        c("one", { type: "feat", breaking: true }),
        c("two", { type: "feat" }),
        c("three", { type: "fix", breaking: true }),
      ],
    });
    assert.equal(out.commit_count, 3);
    assert.equal(out.breaking_count, 2);
    assert.equal(out.bump, "major");
    assert.deepEqual(out.groups, [
      { type: "feat", label: "Features", count: 2 },
      { type: "fix", label: "Fixes", count: 1 },
    ]);
  });
});

describe("generateChangeset — validation", () => {
  it("rejects missing or empty commits", () => {
    assert.throws(() => generateChangeset({}), /commits is required/);
    assert.throws(
      () => generateChangeset({ commits: [] }),
      /commits must be a non-empty array/,
    );
    assert.throws(
      () => generateChangeset({ commits: "nope" }),
      /commits must be a non-empty array/,
    );
    assert.throws(() => generateChangeset(null), /arguments must be an object/);
  });

  it("rejects a commit that is not an object, naming the path", () => {
    assert.throws(
      () => generateChangeset({ commits: ["nope"] }),
      /commits\[0\] must be an object/,
    );
  });

  it("rejects a commit missing its description, naming the indexed path", () => {
    assert.throws(
      () =>
        generateChangeset({
          commits: [c("one"), c("two"), { type: "fix" }],
        }),
      /commits\[2\]\.description is required/,
    );
  });

  it("rejects an empty or non-string description", () => {
    assert.throws(
      () => generateChangeset({ commits: [c("")] }),
      /commits\[0\]\.description must be a non-empty string/,
    );
    assert.throws(
      () => generateChangeset({ commits: [{ description: 42 }] }),
      /commits\[0\]\.description must be a non-empty string/,
    );
  });

  it("rejects non-string type, scope, and hash, naming the path", () => {
    assert.throws(
      () => generateChangeset({ commits: [c("x", { type: 7 })] }),
      /commits\[0\]\.type must be a string/,
    );
    assert.throws(
      () => generateChangeset({ commits: [c("x", { scope: true })] }),
      /commits\[0\]\.scope must be a string/,
    );
    assert.throws(
      () => generateChangeset({ commits: [c("x", { hash: 123 })] }),
      /commits\[0\]\.hash must be a string/,
    );
  });

  it("rejects a non-boolean breaking flag", () => {
    assert.throws(
      () => generateChangeset({ commits: [c("x", { breaking: "yes" })] }),
      /commits\[0\]\.breaking must be a boolean/,
    );
  });

  it("rejects a non-array files_changed and a non-string file entry", () => {
    assert.throws(
      () => generateChangeset({ commits: [c("x")], files_changed: "a.ts" }),
      /files_changed must be an array/,
    );
    assert.throws(
      () =>
        generateChangeset({
          commits: [c("x")],
          files_changed: ["a.ts", 9],
        }),
      /files_changed\[1\] must be a string/,
    );
  });

  it("rejects a non-string package_name", () => {
    assert.throws(
      () => generateChangeset({ commits: [c("x")], package_name: 5 }),
      /package_name must be a string/,
    );
  });

  it("rejects wrongly typed convention fields, naming the path", () => {
    assert.throws(
      () => generateChangeset({ commits: [c("x")], convention: "strict" }),
      /convention must be an object/,
    );
    assert.throws(
      () =>
        generateChangeset({
          commits: [c("x")],
          convention: { heading_prefix: 3 },
        }),
      /convention\.heading_prefix must be a string/,
    );
    assert.throws(
      () =>
        generateChangeset({
          commits: [c("x")],
          convention: { group_order: "feat" },
        }),
      /convention\.group_order must be an array/,
    );
    assert.throws(
      () =>
        generateChangeset({
          commits: [c("x")],
          convention: { group_order: ["feat", 2] },
        }),
      /convention\.group_order\[1\] must be a string/,
    );
    assert.throws(
      () =>
        generateChangeset({
          commits: [c("x")],
          convention: { include_files: "no" },
        }),
      /convention\.include_files must be a boolean/,
    );
  });
});
