import OpenAI from "openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import type {
  LLMProvider,
  ProviderRequest,
  ProviderStreamEvent,
} from "./provider";
import type { Message, ToolCallRequest } from "./types";
import type { Tool } from "./tool";

export interface OpenAIProviderOptions {
  apiKey?: string;
  baseURL?: string;
  client?: OpenAI;
}

export class OpenAIProvider implements LLMProvider {
  readonly name = "openai";
  private readonly client: OpenAI;

  constructor(opts: OpenAIProviderOptions = {}) {
    this.client =
      opts.client ?? new OpenAI({ apiKey: opts.apiKey, baseURL: opts.baseURL });
  }

  async *stream(req: ProviderRequest): AsyncIterable<ProviderStreamEvent> {
    const stream = await this.client.chat.completions.create({
      model: req.model,
      messages: req.messages.map(toOpenAIMessage),
      tools: req.tools.length ? req.tools.map(toOpenAITool) : undefined,
      temperature: req.temperature,
      stream: true,
    }, { signal: req.signal });

    const pending = new Map<number, { id?: string; name?: string; args: string }>();
    let finishReason: ProviderStreamEvent["type"] extends "finish" ? never : string = "other";

    for await (const chunk of stream) {
      const choice = chunk.choices[0];
      if (!choice) continue;
      const delta = choice.delta;

      if (delta?.content) {
        yield { type: "token", data: delta.content };
      }

      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          const slot = pending.get(tc.index) ?? { args: "" };
          if (tc.id) slot.id = tc.id;
          if (tc.function?.name) slot.name = tc.function.name;
          if (tc.function?.arguments) slot.args += tc.function.arguments;
          pending.set(tc.index, slot);
        }
      }

      if (choice.finish_reason) {
        finishReason = choice.finish_reason;
      }
    }

    for (const slot of pending.values()) {
      if (!slot.id || !slot.name) continue;
      const call: ToolCallRequest = {
        id: slot.id,
        name: slot.name,
        arguments: slot.args,
      };
      yield { type: "tool_call", call };
    }

    yield { type: "finish", reason: normalizeFinish(finishReason) };
  }
}

function toOpenAIMessage(m: Message): ChatCompletionMessageParam {
  switch (m.role) {
    case "system":
      return { role: "system", content: m.content };
    case "user":
      return { role: "user", content: m.content };
    case "assistant":
      if (m.toolCalls?.length) {
        return {
          role: "assistant",
          content: m.content || null,
          tool_calls: m.toolCalls.map((c) => ({
            id: c.id,
            type: "function",
            function: { name: c.name, arguments: c.arguments },
          })),
        };
      }
      return { role: "assistant", content: m.content };
    case "tool":
      return {
        role: "tool",
        content: m.content,
        tool_call_id: m.toolCallId ?? "",
      };
  }
}

function toOpenAITool(t: Tool): ChatCompletionTool {
  return {
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters as Record<string, unknown>,
    },
  };
}

function normalizeFinish(r: string): "stop" | "tool_calls" | "length" | "other" {
  if (r === "stop" || r === "tool_calls" || r === "length") return r;
  return "other";
}
