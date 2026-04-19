export type Chunk =
  | { type: "token"; data: string }
  | { type: "event"; name: string; payload: unknown }
  | { type: "error"; error: Error }
  | { type: "done"; result: unknown };

export interface Stream extends AsyncIterable<Chunk> {
  abort(): void;
  final(): Promise<{ result: unknown }>;
}
