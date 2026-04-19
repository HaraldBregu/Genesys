export interface RunnerEvent {
  prompt: string;
  shouldContinue: boolean;
  done: boolean;
}

export class Runner {
  static async run(prompt: string): Promise<AsyncGenerator<RunnerEvent>> {
    async function* generate(): AsyncGenerator<RunnerEvent> {
      while (true) {
        await new Promise((resolve) => setTimeout(resolve, 500));

        const shouldContinue = Math.random() < 0.8;

        yield { prompt, shouldContinue, done: !shouldContinue };

        if (!shouldContinue) return;
      }
    }

    return generate();
  }
}
