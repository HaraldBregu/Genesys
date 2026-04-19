import type { LLMProvider } from "./provider";
import { ToolRegistry, type Tool } from "./tool";
import { InMemoryStore, type MemoryStore } from "./memory";
import type { AgentChunk, AgentRunInput, Message, ToolCallRequest } from "./types";

export interface AgentConfig {
  name: string;
  model: string;
  provider: LLMProvider;
  instructions?: string;
  temperature?: number;
  memory?: MemoryStore;
  tools?: Tool[];
  maxSteps?: number;
}

const DEFAULT_MAX_STEPS = 8;

export class Agent {
  readonly name: string;
  readonly model: string;
  private readonly provider: LLMProvider;
  private readonly instructions?: string;
  private readonly temperature?: number;
  private readonly memory: MemoryStore;
  private readonly registry: ToolRegistry;
  private readonly maxSteps: number;

  constructor(cfg: AgentConfig) {
    if (!cfg.name) throw new Error("agent name required");
    if (!cfg.model) throw new Error("agent model required");
    if (!cfg.provider) throw new Error("agent provider required");
    this.name = cfg.name;
    this.model = cfg.model;
    this.provider = cfg.provider;
    this.instructions = cfg.instructions;
    this.temperature = cfg.temperature;
    this.memory = cfg.memory ?? new InMemoryStore();
    this.registry = new ToolRegistry();
    for (const t of cfg.tools ?? []) this.registry.register(t);
    this.maxSteps = cfg.maxSteps ?? DEFAULT_MAX_STEPS;
  }

  async *run(input: AgentRunInput): AsyncIterable<AgentChunk> {
    try {
      this.seedSystem();
      this.memory.append({ role: "user", content: input.prompt });

      for (let step = 0; step < this.maxSteps; step++) {
        const { text, toolCalls } = yield* this.stepOnce(input.signal);

        const assistant: Message = toolCalls.length
          ? { role: "assistant", content: text, toolCalls }
          : { role: "assistant", content: text };
        this.memory.append(assistant);
        yield { type: "message", message: assistant };

        if (!toolCalls.length) {
          yield { type: "done", result: { text, messages: this.memory.all() } };
          return;
        }

        for (const call of toolCalls) {
          const output = await this.runTool(call, input.signal);
          const toolMsg: Message = {
            role: "tool",
            content: output,
            toolCallId: call.id,
            name: call.name,
          };
          this.memory.append(toolMsg);
          yield { type: "tool_result", callId: call.id, name: call.name, output };
        }
      }

      throw new Error(`agent exceeded maxSteps (${this.maxSteps})`);
    } catch (err) {
      yield { type: "error", error: err instanceof Error ? err : new Error(String(err)) };
    }
  }

  private async *stepOnce(signal?: AbortSignal): AsyncGenerator<
    AgentChunk,
    { text: string; toolCalls: ToolCallRequest[] }
  > {
    let text = "";
    const toolCalls: ToolCallRequest[] = [];

    const events = this.provider.stream({
      model: this.model,
      messages: this.memory.all(),
      tools: this.registry.list(),
      temperature: this.temperature,
      signal,
    });

    for await (const ev of events) {
      if (ev.type === "token") {
        text += ev.data;
        yield { type: "token", data: ev.data };
      } else if (ev.type === "tool_call") {
        toolCalls.push(ev.call);
        yield { type: "tool_call", call: ev.call };
      }
    }

    return { text, toolCalls };
  }

  private async runTool(call: ToolCallRequest, signal?: AbortSignal): Promise<string> {
    const tool = this.registry.get(call.name);
    if (!tool) return JSON.stringify({ error: `unknown tool: ${call.name}` });
    try {
      const args = call.arguments ? JSON.parse(call.arguments) : {};
      const result = await tool.execute(args, { signal });
      return typeof result === "string" ? result : JSON.stringify(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return JSON.stringify({ error: msg });
    }
  }

  private seedSystem(): void {
    if (!this.instructions) return;
    const first = this.memory.all()[0];
    if (first?.role === "system") return;
    this.memory.append({ role: "system", content: this.instructions });
  }
}
