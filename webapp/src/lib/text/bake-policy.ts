/**
 * 텍스트 베이킹 정책 — "정확히 보존돼야 하는 텍스트"는 이미지 모델에 굽지 않고 후합성으로 올린다.
 *
 * gpt-image-2(및 유사 모델)는 짧고 또렷한 한글/숫자는 잘 렌더하지만, 정확한 날짜·금액·퍼센트·
 * 연락처·통계처럼 한 글자도 틀리면 안 되는 데이터는 재현성이 낮아(오타·날조) 굽기에 부적합하다.
 * 또 한 블록에 굽기엔 긴 문장은 위계·여백 없이 "글자 벽"이 되어 가독성이 떨어진다.
 * 이런 텍스트는 컴포지터(벡터 폰트) 후합성으로 또렷하게 올려야 수정·현지화·A/B도 가능해진다.
 *
 * 근거(gpt-image-2 가이드): limits(정확 숫자·빽빽한 텍스트는 재현성 낮음 — 오타 'regiond'),
 * 광고·SNS카드뉴스·슬라이드(수치·본문은 굽지 말 것), cases(긴 문단=글자 벽 → 제목+부제로 분리).
 */

// 정확히 보존돼야 하는 데이터 패턴(굽기 비권장). 짧은 단일 숫자(예: "하루 5분")는 의도적으로 제외.
const PRECISE_DATA: RegExp[] = [
  /\d{3,}/, // 3자리+ 연속 숫자 — 연도·금액·전화·통계·코드
  /\d{4}\s*년|\d{1,2}\s*월|\d{1,2}\s*일/, // 날짜
  /\d{1,2}\s*시(?:\s*\d{1,2}\s*분)?|\d{1,2}\s*[:：]\s*\d{2}/, // 시각
  /\d[\d,]*\s*원|만\s*원|[₩]\s*?\d|\$\s*?\d|\d+\s*달러/, // 금액
  /\d+\s*[%％]|퍼센트/, // 퍼센트
  /https?:\/\/|www\.|@[\w.]+|[\w.-]+\.(?:com|net|org|io|kr|co\.kr)\b/i, // URL·이메일·핸들·도메인
];

// 한 헤드라인/블록에 굽기엔 긴 한글(글자 벽 위험) — 이 길이를 넘으면 후합성 권장.
const LONG_FOR_BAKE = 28;

/** 이 텍스트는 모델에 굽지 말고 후합성(overlay)으로 처리해야 하는가? */
export function needsOverlayText(text: string | null | undefined): boolean {
  const s = text?.trim();
  if (!s) return false;
  if (s.length > LONG_FOR_BAKE) return true;
  return PRECISE_DATA.some((re) => re.test(s));
}

/** 여러 텍스트 중 하나라도 후합성이 필요하면 true. */
export function anyNeedsOverlay(
  ...texts: Array<string | null | undefined>
): boolean {
  return texts.some(needsOverlayText);
}
