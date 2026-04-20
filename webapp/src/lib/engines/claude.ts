import Anthropic from "@anthropic-ai/sdk";
import type {
  Message,
  MessageCreateParams,
  MessageParam,
  TextBlock,
  Tool,
  ToolUseBlock,
} from "@anthropic-ai/sdk/resources/messages";
import { serverEnv } from "@/lib/env";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: serverEnv().ANTHROPIC_API_KEY });
  return client;
}

export const CLAUDE_MODELS = {
  opus: "claude-opus-4-7",
  sonnet: "claude-sonnet-4-6",
  haiku: "claude-haiku-4-5-20251001",
} as const;

export type ClaudeModelAlias = keyof typeof CLAUDE_MODELS;

export interface ClaudeCallInput {
  model?: ClaudeModelAlias | (string & {});
  system?: string;
  messages: MessageParam[];
  maxTokens?: number;
  temperature?: number;
  tools?: Tool[];
  toolChoice?: MessageCreateParams["tool_choice"];
}

function resolveModel(m: ClaudeCallInput["model"]): string {
  if (!m) return CLAUDE_MODELS.opus;
  if (m in CLAUDE_MODELS) return CLAUDE_MODELS[m as ClaudeModelAlias];
  return m;
}

export async function callClaude(input: ClaudeCallInput): Promise<Message> {
  return getClient().messages.create({
    model: resolveModel(input.model),
    max_tokens: input.maxTokens ?? 4000,
    temperature: input.temperature,
    system: input.system,
    messages: input.messages,
    tools: input.tools,
    tool_choice: input.toolChoice,
  });
}

export function extractText(response: Message): string {
  return response.content
    .filter((b): b is TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

export function extractToolUse<T = Record<string, unknown>>(
  response: Message,
  toolName: string,
): T | null {
  const block = response.content.find(
    (b): b is ToolUseBlock => b.type === "tool_use" && b.name === toolName,
  );
  return (block?.input as T) ?? null;
}
