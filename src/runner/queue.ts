type Waiter<T> = {
  resolve: (result: IteratorResult<T>) => void;
  reject: (err: unknown) => void;
};

export class AsyncQueue<T> implements AsyncIterable<T> {
  private buffer: T[] = [];
  private waiters: Waiter<T>[] = [];
  private finished = false;
  private error: unknown = null;

  push(value: T): void {
    if (this.finished) return;
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter.resolve({ value, done: false });
      return;
    }
    this.buffer.push(value);
  }

  finish(): void {
    if (this.finished) return;
    this.finished = true;
    for (const w of this.waiters) {
      w.resolve({ value: undefined as unknown as T, done: true });
    }
    this.waiters = [];
  }

  fail(err: unknown): void {
    if (this.finished) return;
    this.error = err;
    this.finished = true;
    for (const w of this.waiters) w.reject(err);
    this.waiters = [];
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return {
      next: (): Promise<IteratorResult<T>> => {
        if (this.buffer.length > 0) {
          return Promise.resolve({ value: this.buffer.shift()!, done: false });
        }
        if (this.error) return Promise.reject(this.error);
        if (this.finished) {
          return Promise.resolve({ value: undefined as unknown as T, done: true });
        }
        return new Promise<IteratorResult<T>>((resolve, reject) => {
          this.waiters.push({ resolve, reject });
        });
      },
      return: (): Promise<IteratorResult<T>> => {
        this.finish();
        return Promise.resolve({ value: undefined as unknown as T, done: true });
      },
    };
  }
}
