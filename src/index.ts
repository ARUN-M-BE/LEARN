import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { z } from "zod";
import { optional } from "zod/v4";

interface Project {
	id: string;
	name: string;
	description: string;
	createAt: string;
	updateAt: string;
}
interface Todo {
	id: string;
	ProjectId: string;
	name: string;
	description: string;
	status: "pending" | "in-progress" | "completed";
	progress:"low" | "medium" | "high";
	createAt: string;
	updateAt: string;
}
export class MyMCP extends McpAgent {
	server = new McpServer({
		name: "PROJECT PLAN MCP",
		version: "1.0.0",
	});

	async init() {
		this.server.tool('createProject', 'Create a new project', z.object({
			name: z.string().min(1).max(100).describe('Name of the project'),
			description: z.string().optional().describe('Description of the project'),
		}), async ({name, description}) => {
			const newProject: Project = {
				id: crypto.randomUUID(),
				name: name,
				description: description || '',
				createAt: new Date().toISOString(),
				updateAt: new Date().toISOString(),
			}; 
			return {
				content:[
					{
						type: 'text',
						text: `Project "${newProject.name}" created successfully with ID: ${newProject.id}`,
					}
				]
			};
		}
					}
				]
			};
		});

		this.server.tool('listTodos', 'List all todos for a project', z.object({
			projectId: z.string().min(1),
		}), async (input) => {
			// Implement your logic to list todos for a project
			const todos: Todo[] = [
				// Fetch todos from your database based on input.projectId
			];
			return todos;
		});
	}
}

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);

		if (url.pathname === "/sse" || url.pathname === "/sse/message") {
			return MyMCP.serveSSE("/sse").fetch(request, env, ctx);
		}

		if (url.pathname === "/mcp") {
			return MyMCP.serve("/mcp").fetch(request, env, ctx);
		}

		return new Response("Not found", { status: 404 });
	},
};
