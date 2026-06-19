import { z } from "zod";

const serverEnvSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1),
  // Gemini는 임베딩(BP 검색)에도 쓰이므로 이미지 provider와 무관하게 필요하다.
  GEMINI_API_KEY: z.string().min(1),
  // 이미지 생성 provider. 'openai'로 두려면 OPENAI_API_KEY가 있어야 한다(호출 시점 검증).
  IMAGE_PROVIDER: z.enum(["openai", "gemini"]).default("gemini"),
  OPENAI_API_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | null = null;

export function serverEnv(): ServerEnv {
  if (cached) return cached;
  const result = serverEnvSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`환경변수 검증 실패:\n${issues}\n\n.env.local에 필수 키를 설정하세요.`);
  }
  cached = result.data;
  return cached;
}
