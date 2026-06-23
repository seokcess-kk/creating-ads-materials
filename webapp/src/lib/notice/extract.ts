import { z } from "zod";
import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import { callClaude, extractToolUse } from "@/lib/engines/claude";
import type { NoticeMeta } from "./types";
import type { UsageContext } from "@/lib/usage/record";

export const NOTICE_EXTRACT_TOOL = "record_notice_meta";

export const NoticeMetaSchema = z.object({
  summary: z.string().max(200).optional(),
  capacity: z.string().max(120).optional(),
  applyUrl: z.string().max(500).optional(),
  noticeUrl: z.string().max(500).optional(),
  eligibility: z.string().max(300).optional(),
  deadline: z.string().max(200).optional(),
  requestFields: z.array(z.string().max(120)).max(12).optional(),
});

const noticeExtractTool: Tool = {
  name: NOTICE_EXTRACT_TOOL,
  description:
    "안내문 원문에서 광고 소재에 필요한 핵심 정보 슬롯을 구조화 추출. 원문에 없는 항목은 생략(추측 금지).",
  input_schema: {
    type: "object",
    properties: {
      summary: { type: "string", description: "안내문 1~2문장 요약" },
      capacity: {
        type: "string",
        description: "모집 인원/정원 (예: '30명 선착순'). 없으면 생략",
      },
      applyUrl: {
        type: "string",
        description: "신청 경로 URL (구글폼 등). 원문에 있는 그대로",
      },
      noticeUrl: { type: "string", description: "상세 공지/홈페이지 URL" },
      eligibility: {
        type: "string",
        description: "등록 대상/자격 조건 (예: '썸머스쿨 기간만 별도 이용 희망 학생')",
      },
      deadline: {
        type: "string",
        description: "마감/일정 조건 (예: '선착순 마감 시 신청 제한')",
      },
      requestFields: {
        type: "array",
        items: { type: "string" },
        description: "신청 시 기입 요청 항목 (예: ['등원 희망 기간'])",
      },
    },
    required: [],
  },
};

function buildSystem(): string {
  return `당신은 광고 소재 제작을 위해 안내문/공지 원문에서 핵심 정보 슬롯을 추출하는 도구입니다.

원칙:
- 원문에 명시된 사실만 추출. 추측·창작·과장 절대 금지. 없는 항목은 생략.
- URL은 원문에 등장한 그대로(축약·변형 금지).
- 정원·마감·대상·신청경로·기입요청 등 "소재에 실려야 할 정보"에 집중.
- summary는 광고가 아니라 사실 요약(1~2문장).

도구 ${NOTICE_EXTRACT_TOOL} 로만 기록.`;
}

/**
 * 안내문 원문 → 정보 슬롯(notice_meta) 구조화 추출.
 * 실패 시 throw (호출자가 원문 보존 fallback 처리).
 */
export async function extractNoticeMeta(
  rawContent: string,
  usageContext?: UsageContext,
): Promise<NoticeMeta> {
  const response = await callClaude({
    model: "sonnet",
    maxTokens: 1500,
    system: buildSystem(),
    usageContext,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `# 안내문 원문\n${rawContent}\n\n위 원문에서 정보 슬롯을 추출해 ${NOTICE_EXTRACT_TOOL} 로 기록하세요.`,
          },
        ],
      },
    ],
    tools: [noticeExtractTool],
    toolChoice: { type: "tool", name: NOTICE_EXTRACT_TOOL },
  });

  const raw = extractToolUse(response, NOTICE_EXTRACT_TOOL);
  if (!raw) throw new Error("안내문 정보 추출 결과를 얻지 못했습니다");
  const parsed = NoticeMetaSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`안내문 정보 스키마 검증 실패: ${parsed.error.message}`);
  }
  return parsed.data;
}

/** notice_meta 를 프롬프트용 텍스트 블록으로 직렬화. */
export function formatNoticeMeta(meta: NoticeMeta | null | undefined): string {
  if (!meta) return "(정보 슬롯 미추출 — 원문 참조)";
  const lines: string[] = [];
  if (meta.summary) lines.push(`- 요약: ${meta.summary}`);
  if (meta.capacity) lines.push(`- 모집/정원: ${meta.capacity}`);
  if (meta.eligibility) lines.push(`- 대상/자격: ${meta.eligibility}`);
  if (meta.deadline) lines.push(`- 마감/일정: ${meta.deadline}`);
  if (meta.applyUrl) lines.push(`- 신청 경로: ${meta.applyUrl}`);
  if (meta.noticeUrl) lines.push(`- 상세 공지: ${meta.noticeUrl}`);
  if (meta.requestFields?.length)
    lines.push(`- 신청 시 기입 요청: ${meta.requestFields.join(", ")}`);
  return lines.length ? lines.join("\n") : "(정보 슬롯 비어있음 — 원문 참조)";
}
