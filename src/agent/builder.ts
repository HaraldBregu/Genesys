import { Agent, type AgentConfig } from "./agent";
import type { LLMProvider } from "./provider";
import type { MemoryStore } from "./memory";
import type { Tool } from "./tool";

export class AgentBuilder {
  private cfg: Partial<AgentConfig> = {};

  static create(name: string): AgentBuilder {
    const b = new AgentBuilder();
    b.cfg.name = name;
    return b;
  }

  model(id: string): this {
    this.cfg.model = id;
    return this;
  }

  provider(p: LLMProvider): this {
    this.cfg.provider = p;
    return this;
  }

  instructions(text: string): this {
    this.cfg.instructions = text;
    return this;
  }

  temperature(t: number): this {
    this.cfg.temperature = t;
    return this;
  }

  memory(m: MemoryStore): this {
    this.cfg.memory = m;
    return this;
  }

  tool(t: Tool): this {
    this.cfg.tools = [...(this.cfg.tools ?? []), t];
    return this;
  }

  tools(list: Tool[]): this {
    this.cfg.tools = [...(this.cfg.tools ?? []), ...list];
    return this;
  }

  maxSteps(n: number): this {
    this.cfg.maxSteps = n;
    return this;
  }

  build(): Agent {
    return new Agent(this.cfg as AgentConfig);
  }
}
