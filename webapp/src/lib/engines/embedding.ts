import { GoogleGenAI } from "@google/genai";
import { serverEnv } from "@/lib/env";
import { recordUsage, type UsageContext } from "@/lib/usage/record";

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!client) client = new GoogleGenAI({ apiKey: serverEnv().GEMINI_API_KEY });
  return client;
}

export const EMBEDDING_MODEL = "gemini-embedding-001";
export const EMBEDDING_DIM = 768;

export interface EmbedTextInput {
  text: string;
  taskType?: "SEMANTIC_SIMILARITY" | "RETRIEVAL_QUERY" | "RETRIEVAL_DOCUMENT";
  usageContext?: UsageContext;
}

export async function embedText(input: EmbedTextInput): Promise<number[]> {
  const response = await getClient().models.embedContent({
    model: EMBEDDING_MODEL,
    contents: input.text,
    config: {
      outputDimensionality: EMBEDDING_DIM,
      ...(input.taskType ? { taskType: input.taskType } : {}),
    },
  });
  const values = response.embeddings?.[0]?.values;
  if (!values || values.length !== EMBEDDING_DIM) {
    throw new Error(
      `Embedding 실패: 차원 불일치 (got ${values?.length ?? 0}, expected ${EMBEDDING_DIM})`,
    );
  }

  if (input.usageContext) {
    recordUsage({
      provider: "gemini",
      operation: input.usageContext.operation,
      model: EMBEDDING_MODEL,
      brandId: input.usageContext.brandId,
      campaignId: input.usageContext.campaignId,
      metadata: {
        ...input.usageContext.metadata,
        textLength: input.text.length,
        dim: EMBEDDING_DIM,
      },
    });
  }

  return values;
}
