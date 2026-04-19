export interface ToolSchema {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface Tool<TArgs = unknown, TResult = unknown> {
  name: string;
  description: string;
  parameters: ToolSchema;
  execute(args: TArgs, ctx: ToolContext): Promise<TResult> | TResult;
}

export interface ToolContext {
  signal?: AbortSignal;
}

export class ToolRegistry {
  private readonly tools = new Map<string, Tool>();

  register(tool: Tool): this {
    if (this.tools.has(tool.name)) throw new Error(`tool exists: ${tool.name}`);
    this.tools.set(tool.name, tool);
    return this;
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  list(): Tool[] {
    return [...this.tools.values()];
  }

  size(): number {
    return this.tools.size;
  }
}
