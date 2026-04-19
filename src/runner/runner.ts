import { AsyncQueue } from "./queue";
import { neverContinue, type ContinueStrategy } from "./strategy";
import type { Chunk, Stream } from "./types";
import type { Agent } from "../agent";

const MAX_DEPTH = 16;

export interface RunnerOptions {
  agent: Agent;
  shouldContinue?: ContinueStrategy;
  depth?: number;
  parent?: Runner | null;
}

export class Runner {
  private readonly prompt: string;
  private readonly agent: Agent;
  private readonly depth: number;
  private readonly parent: Runner | null;
  private readonly shouldContinue: ContinueStrategy;
  private readonly queue = new AsyncQueue<Chunk>();
  private readonly abortCtrl = new AbortController();
  private aborted = false;

  private constructor(prompt: string, opts: RunnerOptions) {
    this.prompt = prompt;
    this.agent = opts.agent;
    this.depth = opts.depth ?? 0;
    this.parent = opts.parent ?? null;
    this.shouldContinue = opts.shouldContinue ?? neverContinue;
  }

  static start(prompt: string, opts: RunnerOptions): Stream {
    if (!prompt) throw new Error("prompt required");
    if (!opts.agent) throw new Error("agent required");
    if ((opts.depth ?? 0) > MAX_DEPTH) throw new Error("max depth exceeded");
    const instance = new Runner(prompt, opts);
    void instance.run();
    return instance.asStream();
  }

  private asStream(): Stream {
    const queue = this.queue;
    const self = this;
    return {
      [Symbol.asyncIterator]: () => queue[Symbol.asyncIterator](),
      abort: () => self.abort(),
      final: async () => {
        let result: unknown = undefined;
        for await (const chunk of queue) {
          if (chunk.type === "done") result = chunk.result;
          if (chunk.type === "error") throw chunk.error;
        }
        return { result };
      },
    };
  }

  private async run(): Promise<void> {
    try {
      this.emit({
        type: "event",
        name: "start",
        payload: { prompt: this.prompt, depth: this.depth, agent: this.agent.name },
      });

      const finalText = await this.work();

      if (this.aborted) return;

      const decision = await this.shouldContinue({ prompt: this.prompt, depth: this.depth });
      if (decision.continue) {
        await this.chainInto(decision.nextPrompt);
        return;
      }

      this.emit({ type: "done", result: { prompt: this.prompt, depth: this.depth, text: finalText } });
    } catch (err) {
      this.emit({ type: "error", error: err instanceof Error ? err : new Error(String(err)) });
    } finally {
      this.queue.finish();
    }
  }

  private async work(): Promise<string> {
    let text = "";
    for await (const chunk of this.agent.run({ prompt: this.prompt, signal: this.abortCtrl.signal })) {
      if (this.aborted) break;
      switch (chunk.type) {
        case "token":
          text += chunk.data;
          this.emit({ type: "token", data: chunk.data });
          break;
        case "tool_call":
          this.emit({ type: "event", name: "tool_call", payload: chunk.call });
          break;
        case "tool_result":
          this.emit({
            type: "event",
            name: "tool_result",
            payload: { callId: chunk.callId, name: chunk.name, output: chunk.output },
          });
          break;
        case "message":
          this.emit({ type: "event", name: "message", payload: chunk.message });
          break;
        case "done":
          text = chunk.result.text;
          break;
        case "error":
          throw chunk.error;
      }
    }
    return text;
  }

  private emit(chunk: Chunk): void {
    if (this.aborted) return;
    this.queue.push(chunk);
  }

  private async chainInto(nextPrompt: string): Promise<void> {
    const child = Runner.start(nextPrompt, {
      agent: this.agent,
      parent: this,
      depth: this.depth + 1,
      shouldContinue: this.shouldContinue,
    });
    for await (const chunk of child) {
      if (this.aborted) {
        child.abort();
        break;
      }
      this.emit(chunk);
    }
  }

  private abort(): void {
    if (this.aborted) return;
    this.aborted = true;
    this.abortCtrl.abort();
    this.queue.finish();
  }
}
