export type Role = "system" | "user" | "assistant" | "tool";

export interface Message {
  role: Role;
  content: string;
  name?: string;
  toolCallId?: string;
  toolCalls?: ToolCallRequest[];
}

export interface ToolCallRequest {
  id: string;
  name: string;
  arguments: string;
}

export type AgentChunk =
  | { type: "token"; data: string }
  | { type: "tool_call"; call: ToolCallRequest }
  | { type: "tool_result"; callId: string; name: string; output: string }
  | { type: "message"; message: Message }
  | { type: "done"; result: { text: string; messages: Message[] } }
  | { type: "error"; error: Error };

export interface AgentRunInput {
  prompt: string;
  signal?: AbortSignal;
}
