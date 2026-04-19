import type { Message } from "./types";

export interface MemoryStore {
  all(): Message[];
  append(msg: Message): void;
  appendMany(msgs: Message[]): void;
  clear(): void;
}

export class InMemoryStore implements MemoryStore {
  private readonly messages: Message[] = [];

  constructor(seed: Message[] = []) {
    this.messages.push(...seed);
  }

  all(): Message[] {
    return [...this.messages];
  }

  append(msg: Message): void {
    this.messages.push(msg);
  }

  appendMany(msgs: Message[]): void {
    this.messages.push(...msgs);
  }

  clear(): void {
    this.messages.length = 0;
  }
}
