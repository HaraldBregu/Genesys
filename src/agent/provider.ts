import type { Message, ToolCallRequest } from "./types";
import type { Tool } from "./tool";

export type ProviderStreamEvent =
  | { type: "token"; data: string }
  | { type: "tool_call"; call: ToolCallRequest }
  | { type: "finish"; reason: "stop" | "tool_calls" | "length" | "other" };

export interface ProviderRequest {
  model: string;
  messages: Message[];
  tools: Tool[];
  temperature?: number;
  signal?: AbortSignal;
}

export interface LLMProvider {
  readonly name: string;
  stream(req: ProviderRequest): AsyncIterable<ProviderStreamEvent>;
}
