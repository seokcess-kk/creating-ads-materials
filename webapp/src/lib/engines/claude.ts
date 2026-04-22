import Anthropic from "@anthropic-ai/sdk";
import type {
  Message,
  MessageCreateParams,
  MessageParam,
  TextBlock,
  TextBlockParam,
  Tool,
  ToolUseBlock,
} from "@anthropic-ai/sdk/resources/messages";
import { serverEnv } from "@/lib/env";
import { recordUsage, type UsageContext } from "@/lib/usage/record";

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
  // string 또는 cache block 배열. string 시 자동으로 cache_control: ephemeral 부여.
  system?: string | TextBlockParam[];
  messages: MessageParam[];
  maxTokens?: number;
  temperature?: number;
  tools?: Tool[];
  toolChoice?: MessageCreateParams["tool_choice"];
  usageContext?: UsageContext;
  // system prompt에 prompt caching을 걸지 여부 (기본 true).
  // system이 1024 토큰 미만이면 Anthropic이 캐싱을 무시하므로 안전.
  cacheSystem?: boolean;
}

function resolveModel(m: ClaudeCallInput["model"]): string {
  if (!m) return CLAUDE_MODELS.opus;
  if (m in CLAUDE_MODELS) return CLAUDE_MODELS[m as ClaudeModelAlias];
  return m;
}

function normalizeSystem(
  system: ClaudeCallInput["system"],
  cacheSystem: boolean,
): string | TextBlockParam[] | undefined {
  if (system == null) return undefined;
  if (typeof system !== "string") return system;
  if (!cacheSystem) return system;
  return [
    {
      type: "text",
      text: system,
      cache_control: { type: "ephemeral" },
    },
  ];
}

export async function callClaude(input: ClaudeCallInput): Promise<Message> {
  const resolvedModel = resolveModel(input.model);
  const system = normalizeSystem(input.system, input.cacheSystem ?? true);
  const response = await getClient().messages.create({
    model: resolvedModel,
    max_tokens: input.maxTokens ?? 4000,
    temperature: input.temperature,
    system,
    messages: input.messages,
    tools: input.tools,
    tool_choice: input.toolChoice,
  });

  if (input.usageContext) {
    const u = response.usage;
    recordUsage({
      provider: "anthropic",
      operation: input.usageContext.operation,
      model: resolvedModel,
      brandId: input.usageContext.brandId,
      campaignId: input.usageContext.campaignId,
      metadata: input.usageContext.metadata,
      inputTokens: u?.input_tokens,
      outputTokens: u?.output_tokens,
      cacheReadTokens: u?.cache_read_input_tokens ?? undefined,
      cacheCreationTokens: u?.cache_creation_input_tokens ?? undefined,
    }).catch((err) =>
      console.warn("Claude usage 기록 실패:", (err as Error).message),
    );
  }

  return response;
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
