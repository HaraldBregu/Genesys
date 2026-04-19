import { AsyncQueue } from "./queue";
import { neverContinue, type ContinueStrategy } from "./strategy";
import type { Chunk, Stream } from "./types";

const MAX_DEPTH = 16;

export interface RunnerOptions {
  shouldContinue?: ContinueStrategy;
  depth?: number;
  parent?: Runner | null;
}

export class Runner {
  private readonly prompt: string;
  private readonly depth: number;
  private readonly parent: Runner | null;
  private readonly shouldContinue: ContinueStrategy;
  private readonly queue = new AsyncQueue<Chunk>();
  private aborted = false;

  private constructor(prompt: string, opts: RunnerOptions) {
    this.prompt = prompt;
    this.depth = opts.depth ?? 0;
    this.parent = opts.parent ?? null;
    this.shouldContinue = opts.shouldContinue ?? neverContinue;
  }

  static start(prompt: string, opts: RunnerOptions = {}): Stream {
    if (!prompt) throw new Error("prompt required");
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
      this.emit({ type: "event", name: "start", payload: { prompt: this.prompt, depth: this.depth } });

      await this.work();

      if (this.aborted) return;

      const decision = await this.shouldContinue({ prompt: this.prompt, depth: this.depth });
      if (decision.continue) {
        await this.chainInto(decision.nextPrompt);
        return;
      }

      this.emit({ type: "done", result: { prompt: this.prompt, depth: this.depth } });
    } catch (err) {
      this.emit({ type: "error", error: err instanceof Error ? err : new Error(String(err)) });
    } finally {
      this.queue.finish();
    }
  }

  private async work(): Promise<void> {
    await new Promise((r) => setTimeout(r, 100));
    this.emit({ type: "token", data: this.prompt });
  }

  private emit(chunk: Chunk): void {
    if (this.aborted) return;
    this.queue.push(chunk);
  }

  private async chainInto(nextPrompt: string): Promise<void> {
    const child = Runner.start(nextPrompt, {
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
    this.queue.finish();
  }
}
