import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { z } from "zod";

interface Project {
	id: string;
	name: string;
	description: string;
	createAt: string;
	updateAt: string;
}

interface Todo {
	id: string;
	projectId: string;
	name: string;
	description: string;
	status: "pending" | "in-progress" | "completed";
	progress: "low" | "medium" | "high";
	createAt: string;
	updateAt: string;
}

export class MyMCP extends McpAgent {

	server = new McpServer({
		name: "PROJECT PLAN MCP",
		version: "1.0.0",
	});

	private get kv(): KVNamespace {
		return (this.env as Env).PROJECT_1;
	}

	// PROJECT LIST
	private async getProjectList(): Promise<string[]> {
		const listData = await this.kv.get("projectList");
		return listData ? JSON.parse(listData) : [];
	}

	// TODO LIST (ID ARRAY)
	private async getTodoList(projectId: string): Promise<string[]> {
		const listData = await this.kv.get(`project:${projectId}:todoList`);
		return listData ? JSON.parse(listData) : [];
	}

	// GET TODOS BY PROJECT
	private async getTodosByProjectId(projectId: string): Promise<Todo[]> {
		const todoIds = await this.getTodoList(projectId);
		const todos: Todo[] = [];

		for (const id of todoIds) {
			const todoData = await this.kv.get(`todo:${id}`);
			if (todoData) todos.push(JSON.parse(todoData));
		}
		return todos;
	}

	async init() {

		// CREATE PROJECT
		this.server.tool(
			"createProject",
			"Create a new project",
			z.object({
				name: z.string().min(1).max(100),
				description: z.string().optional(),
			}),
			async ({ name, description }) => {
				const project: Project = {
					id: crypto.randomUUID(),
					name,
					description: description || "",
					createAt: new Date().toISOString(),
					updateAt: new Date().toISOString(),
				};

				await this.kv.put(project.id, JSON.stringify(project));

				const projectList = await this.getProjectList();
				projectList.push(project.id);
				await this.kv.put("projectList", JSON.stringify(projectList));

				return {
					content: [{ type: "text", text: JSON.stringify(project, null, 2) }],
				};
			}
		);

		// GET PROJECT BY ID
		this.server.tool(
			"get_Projects",
			"get project by Id",
			z.object({ project_id: z.string() }),
			async ({ project_id }) => {
				const projectData = await this.kv.get(project_id);
				if (!projectData) throw new Error("Project not found");

				const project: Project = JSON.parse(projectData);
				const todos = await this.getTodosByProjectId(project_id);

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({ project, todos }, null, 2),
						},
					],
				};
			}
		);

		// DELETE PROJECT
		this.server.tool(
			"delete_Projects",
			"Delete project by its all todo",
			z.object({ project_id: z.string() }),
			async ({ project_id }) => {
				const projectData = await this.kv.get(project_id);
				if (!projectData) throw new Error("Project not found");

				const todos = await this.getTodosByProjectId(project_id);

				for (const todo of todos) {
					await this.kv.delete(`todo:${todo.id}`);
				}

				await this.kv.delete(`project:${project_id}:todoList`);
				await this.kv.delete(project_id);

				const projectList = await this.getProjectList();
				const updated = projectList.filter((id) => id !== project_id);

				await this.kv.put("projectList", JSON.stringify(updated));

				return {
					content: [
						{
							type: "text",
							text: `Project ${project_id} deleted successfully.`,
						},
					],
				};
			}
		);

		// LIST TODOS
		this.server.tool(
			"listTodos",
			"List all todos for a project",
			z.object({ projectId: z.string() }),
			async ({ projectId }) => {
				const todos = await this.getTodosByProjectId(projectId);
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(todos, null, 2),
						},
					],
				};
			}
		);

		// CREATE TODO
		this.server.tool(
			"create_Todo",
			"create a new Todo Project",
			z.object({
				projectId: z.string().min(1),
				name: z.string().min(1).max(100),
				description: z.string().optional(),
				status: z.enum(["pending", "in-progress", "completed"]),
				progress: z.enum(["low", "medium", "high"]),
			}),
			async ({ projectId, name, description, status, progress }) => {
				const newTodo: Todo = {
					id: crypto.randomUUID(),
					projectId,
					name,
					description: description || "",
					status,
					progress,
					createAt: new Date().toISOString(),
					updateAt: new Date().toISOString(),
				};

				await this.kv.put(`todo:${newTodo.id}`, JSON.stringify(newTodo));

				const todoList = await this.getTodoList(projectId);
				todoList.push(newTodo.id);

				await this.kv.put(
					`project:${projectId}:todoList`,
					JSON.stringify(todoList)
				);

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(newTodo, null, 2),
						},
					],
				};
			}
		);

		// UPDATE TODO
		this.server.tool(
			"update_Todo",
			"update Todo by Id",
			z.object({
				todo_id: z.string(),
				name: z.string().optional(),
				description: z.string().optional(),
				status: z.enum(["pending", "in-progress", "completed"]).optional(),
				progress: z.enum(["low", "medium", "high"]).optional(),
			}),
			async ({ todo_id, name, description, status, progress }) => {
				const todoData = await this.kv.get(`todo:${todo_id}`);
				if (!todoData) throw new Error("Todo not found");

				const todo: Todo = JSON.parse(todoData);

				if (name) todo.name = name;
				if (description) todo.description = description;
				if (status) todo.status = status;
				if (progress) todo.progress = progress;

				todo.updateAt = new Date().toISOString();

				await this.kv.put(`todo:${todo_id}`, JSON.stringify(todo));

				return {
					content: [{ type: "text", text: JSON.stringify(todo, null, 2) }],
				};
			}
		);

		// DELETE TODO
		this.server.tool(
			"delete_Todo",
			"Delete Todo by Id",
			z.object({ todo_id: z.string() }),
			async ({ todo_id }) => {
				const todoData = await this.kv.get(`todo:${todo_id}`);
				if (!todoData) throw new Error("Todo not found");

				const todo: Todo = JSON.parse(todoData);

				await this.kv.delete(`todo:${todo_id}`);

				const list = await this.getTodoList(todo.projectId);
				const updated = list.filter((id) => id !== todo_id);

				await this.kv.put(
					`project:${todo.projectId}:todoList`,
					JSON.stringify(updated)
				);

				return {
					content: [
						{ type: "text", text: `Todo ${todo_id} deleted successfully.` },
					],
				};
			}
		);

		// GET TODO BY ID
		this.server.tool(
			"get_Todo",
			"get Todo by Id",
			z.object({ todo_id: z.string() }),
			async ({ todo_id }) => {
				const todoData = await this.kv.get(`todo:${todo_id}`);
				if (!todoData) throw new Error("Todo not found");

				const todo: Todo = JSON.parse(todoData);

				return {
					content: [{ type: "text", text: JSON.stringify(todo, null, 2) }],
				};
			}
		);

		// LIST ALL TODOS WITH FILTER
		this.server.tool(
			"list_all_todos",
			"list all todos by project Id",
			z.object({
				project_id: z.string(),
				status: z.enum(["pending", "in-progress", "completed", "all"]).optional(),
			}),
			async ({ project_id, status }) => {
				const projectData = await this.kv.get(project_id);
				if (!projectData) throw new Error("Project not found");

				const todos = await this.getTodosByProjectId(project_id);

				let filtered = todos;
				if (status && status !== "all") {
					filtered = todos.filter((t) => t.status === status);
				}

				return {
					content: [
						{ type: "text", text: JSON.stringify(filtered, null, 2) },
					],
				};
			}
		);
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