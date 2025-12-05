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
	progress: "low" | "medium" | "high";
	createAt: string;
	updateAt: string;
}
export class MyMCP extends McpAgent {

	// Initialize MCP Server
	server = new McpServer({
		name: "PROJECT PLAN MCP",
		version: "1.0.0",
	});

	// Access KV Namespace
	private get kv(): KVNamespace {
		return (this.env as Env).PROJECT_1;
	}

	// Helper methods to interact with KV storage
	private async getProjectList(): Promise<string> {
		const listData = await this.kv.get('projectList');
		return listData ? JSON.parse(listData) : [];
	}
	// Get Todo List by Project ID
	private async getTodoList(projectId: string): Promise<string> {
		const listData = await this.kv.get(`project:${projectId}:todoList`);
		return listData ? JSON.parse(listData) : [];
	}
	// Get Todos by Project ID
	private async getTodoById(todoId: string): Promise<Todo[]> {
		const todoList = await this.getTodoList(projectId);
		const todos: Todo[] = []
		for (const todoId of todoList) {
			const todoData = await this.kv.get(`todo:${todoId}`);
			if (todoData) {
				todos.push(JSON.parse(todoData));
			}
		}
		return todos;
	}
	async init() {

		// ============ Create Project ==============

		this.server.tool('createProject', 'Create a new project', z.object({
			name: z.string().min(1).max(100).describe('Name of the project'),
			description: z.string().optional().describe('Description of the project'),
		}), async ({ name, description }) => {
			const project: Project = {
				id: crypto.randomUUID(),
				name: name,
				description: description || '',
				createAt: new Date().toISOString(),
				updateAt: new Date().toISOString(),
			};
			// Save project to your database here
			await this.kv.put(project.id, JSON.stringify(project));
			const projectList = await this.getProjectList();
			projectList.push(project.id);
			await this.kv.put('projectList', JSON.stringify(projectList));
			return {
				content: [
					{
						type: 'text',
						text: JSON.stringify(project, null, 2),
					}
				]
			};
		});

		// =========== update Projects ==============

		// this.server.tool('update_Projects', 'update project by Id', {
		// 	project_id: z.string().describe("project  Id"),
		// 	name: z.string().min(1).max(100).optional().describe('Name of the project'),
		// 	description: z.string().optional().describe('Description of the project'),
		// }, async ({ project_id, name, description }) => {

		// 	const projectData = await this.kv.get(project_id);
		// 	if (!projectData) {
		// 		throw new Error('Project not found');
		// 	}
		// 	const project: Project = JSON.parse(projectData);
		// 	if (name) project.name = name;
		// 	if (description) project.description = description;
		// 	project.updateAt = new Date().toISOString();
		// 	await this.kv.put(project_id, JSON.stringify(project));
		// 	return {
		// 		content: [
		// 			{
		// 				type: 'text',
		// 				text: JSON.stringify(project, null, 2),
		// 			}
		// 		]
		// 	};
		// });

		// =========== Get Project by Id ==============

		this.server.tool('get_Projects', 'get project by Id', { project_id: z.string().describe("project  Id") }, async (project_id) => {

			const projectData = await this.kv.get(project_id);
			if (!projectData) {
				throw new Error('Project not found');
			}
			const project: Project = JSON.parse(projectData);
			const todos = await this.getTodoById(project_id);
			return {
				content: [
					{
						type: 'text',
						text: JSON.stringify({ project, todos }, null, 2),
					}
				]
			};
		});

		// ============ Delete Project and its all todo ==============

		this.server.tool('delete_Projects', 'Delete project by its all todo', { project_id: z.string().describe("project  Id") }, async (project_id) => {

			const projectData = await this.kv.get(`${project_id}`);
			if (!projectData) {
				throw new Error('Project not found');
			}

			const todos = await this.getTodoById(`project_id`);
			for (const todo of todos) {
				await this.kv.delete(`todo:${todo.id}`);
			}
			await this.kv.delete(`project:${project_id}:todos`);
			await this.kv.delete(`${project_id}`);
			const projectList = await this.getProjectList();
			const updatedProjectList = projectList.filter((id: string) => id !== project_id);
			await this.kv.put('projectList', JSON.stringify(updatedProjectList));
			const project: Project = JSON.parse(projectData);
			return {
				content: [
					{
						type: 'text',
						text: `Project with ID ${project_id} and its todos have been deleted.`,
					}
				]
			};
		});

		// ============ List Todos for a Project ==============

		this.server.tool('listTodos', 'List all todos for a project', z.object({
			projectId: z.string().min(1),
		}), async (input) => {
			// Implement your logic to list todos for a project
			const todos: Todo[] = [
			];
			return todos;
		});

		// ============ Create Todo ==============

		this.server.tool('create Todo', 'create a new Todo Project', {
			projectId: z.string().min(1).describe('ID of the project'),
			name: z.string().min(1).max(100).describe('Name of the todo'),
			description: z.string().optional().describe('Description of the todo'),
			status: z.enum(['pending', 'in-progress', 'completed']).describe('Status of the todo'),
			progress: z.enum(['low', 'medium', 'high']).describe('Progress level of the todo'),
		}, async ({ projectId, name, description, status, progress }) => {
			const newTodo: Todo = {
				id: crypto.randomUUID(),
				ProjectId: projectId,
				name: name,
				description: description || '',
				status: "pending",
				progress: priority || 'medium',
				createAt: new Date().toISOString(),
				updateAt: new Date().toISOString(),
			};

			await this.kv.put(`todo:${newTodo.id}`, JSON.stringify(newTodo));
			// Save newTodo to your database here
			const todoList = await this.getTodoList(projectId);
			todoList.push(newTodo);
			await this.kv.put(`project:${projectId}:todoList`, JSON.stringify(todoList));
			return {
				content: [
					{
						type: 'text',
						text: JSON.stringify(newTodo, null, 2),
					}
				]
			};
		});

		// ======================== update Todo ========================

		this.server.tool('update_Todo', 'update Todo by Id', {
			todo_id: z.string().describe("Todo  Id"),
			name: z.string().min(1).max(100).optional().describe('Name of the todo'),
			description: z.string().optional().describe('Description of the todo'),
			status: z.enum(['pending', 'in-progress', 'completed']).optional().describe('Status of the todo'),
			progress: z.enum(['low', 'medium', 'high']).optional().describe('Progress level of the todo'),
		}, async ({ todo_id, name, description, status, progress }) => {

			const todoData = await this.kv.get(`todo:${todo_id}`);
			if (!todoData) {
				throw new Error('Todo not found');
			}
			const todo: Todo = JSON.parse(todoData);
			if (name) todo.name = name;
			if (description) todo.description = description;
			if (status) todo.status = status;
			if (progress) todo.progress = progress;
			todo.updateAt = new Date().toISOString();
			await this.kv.put(`todo:${todo_id}`, JSON.stringify(todo));
			return {
				content: [
					{
						type: 'text',
						text: JSON.stringify(todo, null, 2),
					}
				]
			};
		});
		// =========== delete Todo ==============

		this.server.tool('delete_Todo', 'Delete Todo by Id', { todo_id: z.string().describe("Todo  Id") }, async (todo_id) => {
			const todoData = await this.kv.get(`todo:${todo_id}`);
			if (!todoData) {
				throw new Error('Todo not found');
			}
			const todo: Todo = JSON.parse(todoData);
			await this.kv.delete(`todo:${todo_id}`);
			const todoList = await this.getTodoList(todo.ProjectId);
			const updatedTodoList = todoList.filter((id: string) => id !== todo_id);
			await this.kv.put(`project:${todo.ProjectId}:todoList`, JSON.stringify(updatedTodoList));
			return {
				content: [
					{
						type: 'text',
						text: `Todo with ID ${todo_id} has been deleted.`,
					}
				]
			};
		});

		// ================ get todo by Id ==================

		this.server.tool('get_Todo', 'get Todo by Id', { todo_id: z.string().describe("Todo  Id") }, async (todo_id) => {
			const todoData = await this.kv.get(`todo:${todo_id}`);
			if (!todoData) {
				throw new Error('Todo not found');
			}
			const todo: Todo = JSON.parse(todoData);

			return {
				content: [
					{
						type: 'text',
						text: JSON.stringify(todo, null, 2),
					}
				]
			};
		});

		// ============== list all todos by project Id ==============
		
		this.server.tool('list_all_todos', 'list all todos by project Id', { project_id: z.string().describe("project  Id"),status: z.enum(["pending","inprogress", "completed", "all"]).optional().describe("filter by status") }, async (project_id,status) => {
			const projectData = await this.kv.get(`${project_id}`);
			if (!projectData) {
				throw new Error('Project not found');
			}
			const todos = await this.getTodoById(project_id);
			let filteredTodos = todos;
			if(status && status !== "all"){
				filteredTodos = todos.filter(todo => todo.status === status);
			}
			return {
				content: [
					{
						type: 'text',
						text: JSON.stringify(filteredTodos, null, 2),
					}
				]
			};
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
