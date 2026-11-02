/**
 * changesetgen MCP server. Tools: generate_changeset.
 *
 * Why the low-level Server instead of McpServer: the high-level
 * helper converts zod schemas to JSON Schema and injects keys
 * not in this tool's defined spec ("$schema" and
 * "additionalProperties"), which breaks exact tool-list/schema
 * parity with the spec. This file serves tools/list with the
 * spec's exact input schema as an explicit literal, and every
 * tools/call is validated by the core, which names the
 * offending path on invalid input.
 *
 * The generation is pure local computation: no upstream API,
 * no authentication, no configuration.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { formatPayload, generateChangeset, VERSION } from "./changesetgen.js";

const TOOLS = [
  {
    name: "generate_changeset",
    description:
      "Generate a changeset and changelog entry from a PR's commits, grouped by conventional-commit type in the repo's own convention, with a semver bump suggestion.",
    inputSchema: {
      type: "object" as const,
      properties: {
        commits: {
          type: "array",
          description: "Commits in the PR (at least one)",
          minItems: 1,
          items: {
            type: "object",
            properties: {
              description: {
                type: "string",
                description: "Commit description",
              },
              hash: {
                type: "string",
                description:
                  "Commit hash (optional; carried for reference, not printed)",
              },
              type: {
                type: "string",
                description:
                  "Conventional-commit type, e.g. feat or fix (optional; missing groups under other)",
              },
              scope: {
                type: "string",
                description: "Commit scope (optional)",
              },
              breaking: {
                type: "boolean",
                description: "Whether the commit is breaking (optional)",
              },
            },
            required: ["description"],
          },
        },
        files_changed: {
          type: "array",
          description: "Files changed in the PR (optional)",
          items: { type: "string" },
        },
        package_name: {
          type: "string",
          description: "Package name appended to the heading (optional)",
        },
        convention: {
          type: "object",
          description: "Repo convention overrides (optional)",
          properties: {
            heading_prefix: {
              type: "string",
              description: 'Heading prefix (optional, default "## Changes")',
            },
            group_order: {
              type: "array",
              description:
                "Group types in the order they should appear (optional)",
              items: { type: "string" },
            },
            include_files: {
              type: "boolean",
              description:
                "Whether to include the Files changed section (optional, default true)",
            },
          },
        },
      },
      required: ["commits"],
    },
  },
];

function textResult(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
      },
    ],
  };
}

function errorResult(err: unknown) {
  return {
    content: [
      { type: "text" as const, text: err instanceof Error ? err.message : String(err) },
    ],
    isError: true,
  };
}

const server = new Server(
  { name: "changesetgen", version: VERSION },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let out: unknown;
    if (name === "generate_changeset") {
      out = generateChangeset(args ?? {});
    } else {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
    return textResult(formatPayload(out));
  } catch (err) {
    if (err instanceof McpError) throw err;
    return errorResult(err);
  }
});

async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
}

void main();
