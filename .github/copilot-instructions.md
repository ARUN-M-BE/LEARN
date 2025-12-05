# AI Coding Agent Instructions

## Project Overview
**Remote MCP Server** - A TypeScript-based Model Context Protocol (MCP) server running on Cloudflare Workers. It provides tools for managing projects and todos, exposing capabilities via Server-Sent Events (SSE) and MCP protocols.

## Architecture & Key Components

### Core Structure
- **`src/index.ts`**: Single entry point containing `MyMCP` class that extends `McpAgent`
- **`MyMCP` class**: Extends `McpAgent` from `agents` package; manages tool registration via `this.server.tool()`
- **Data Storage**: Uses Cloudflare KV namespace (`PROJECT_1`) for persistent storage via `this.env.PROJECT_1`
- **Routing**: Two protocol endpoints—`/sse` for SSE connections and `/mcp` for direct MCP protocol

### Data Models
**Project**: `{id, name, description, createAt, updateAt}` - top-level container  
**Todo**: `{id, projectId, name, description, status: pending|in-progress|completed, progress: low|medium|high, createAt, updateAt}`

### Storage Patterns
- Projects stored as `{projectId}` and indexed in `projectList` array key
- Todos stored as `todo:{todoId}` with project index at `project:{projectId}:todoList`
- All data serialized as JSON strings in KV

## Critical Workflows

### Development & Deployment
- **Local dev**: `npm run dev` (starts `wrangler dev` on localhost:8787)
- **Deploy**: `npm run deploy` (publishes to Cloudflare Workers)
- **Type generation**: `npm run cf-typegen` (generates `worker-configuration.d.ts` with KV/Durable Object bindings)
- **Linting**: `npm run lint:fix` (Biome with custom rules excluding `noNonNullAssertion`)
- **Type checking**: `npm run type-check` (strict TypeScript validation)

### MCP Tool Pattern
Tools defined in `init()` method using `this.server.tool(name, description, zodSchema, handler)`:
1. Validation via Zod schema (example: `z.object({ projectId: z.string(), name: z.string().min(1).max(100) })`)
2. Handler returns `{ content: [{ type: "text", text: ... }] }` (MCP-compliant response format)
3. Errors thrown automatically converted to error responses

## Project-Specific Patterns & Conventions

### Tool Naming Inconsistency
Tools mix camelCase (`createProject`, `get_Projects`, `create_Todo`) - **maintain existing style when adding tools** (no standardization applied).

### KV Access
Always use `this.kv` getter that retrieves `this.env.PROJECT_1`. Never access KV directly from `env`:
```typescript
private get kv(): KVNamespace {
  return (this.env as Env).PROJECT_1;
}
```

### CRUD Helpers for Lists
Projects and todos use index arrays (e.g., `projectList`, `project:{id}:todoList`). When modifying:
1. Fetch existing list: `await this.kv.get(listKey)`
2. Parse and modify array
3. Rewrite entire list: `await this.kv.put(listKey, JSON.stringify(updated))`

### Type Casting
Use `(this.env as Env)` to cast environment to generated Cloudflare `Env` type.

## Integration Points

### Cloudflare Platform
- **Workers**: Runtime for TypeScript code
- **KV Namespace**: Persistent key-value store (configured in `wrangler.jsonc` with remote ID)
- **Durable Objects**: Migration configured for `MyMCP` class (though currently inactive in routing)
- **Type Generation**: Run `npm run cf-typegen` after adding KV/Durable Object bindings to update `worker-configuration.d.ts`

### External Dependencies
- **`@modelcontextprotocol/sdk`**: Provides `McpServer` base
- **`agents` package**: Provides `McpAgent` base class (extends MCP functionality)
- **`zod`**: Runtime schema validation for tool parameters

### Deployment Targets
- **Production**: Cloudflare Workers (URL format: `remote-mcp-server-authless.{account}.workers.dev`)
- **Clients**: Claude Desktop (via `mcp-remote` proxy), Cloudflare AI Playground

## Configuration Files

### TypeScript (`tsconfig.json`)
- Target: ES2021, ES2022 modules
- Strict mode enabled
- Includes auto-generated `worker-configuration.d.ts` in type definitions
- `skipLibCheck: true` (speed optimization for Cloudflare types)

### Formatting & Linting (`biome.json`)
- Formatter: 4-space indents, 100-char line width
- Linter: Recommended rules with exception `noNonNullAssertion: off`
- Excludes `worker-configuration.d.ts` from checks

### Wrangler (`wrangler.jsonc`)
- Compatibility date: 2025-03-10 with `nodejs_compat` flag
- KV binding: `PROJECT_1` (remote namespace, ID: `03e5cd5859a54f7fa6bb2668faf39ea6`)
- Durable Object binding: `MCP_OBJECT` (not actively routed)

## Important Constraints & Gotchas

1. **KV Eventual Consistency**: Changes may not be immediately visible in subsequent reads
2. **Response Format**: MCP tools require `{ content: [{ type: "text", text: ... }] }` structure
3. **No Transaction Support**: Manual ID array management required for consistency
4. **Dependency Versions**: `agents: ^0.2.29` (check docs for API changes in new versions)
5. **Error Handling**: Thrown errors in tool handlers auto-converted by MCP framework

## Adding New Tools

1. Define Zod validation schema inside `this.server.tool()` call
2. Implement handler to read/write KV using `this.kv.get()`, `this.kv.put()`, `this.kv.delete()`
3. Return MCP-compliant `{ content: [...] }` response
4. Use UUID for IDs: `crypto.randomUUID()`
5. Update index arrays when adding/removing items (no cascading deletes built-in)
