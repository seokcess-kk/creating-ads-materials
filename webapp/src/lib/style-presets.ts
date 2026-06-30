// 구조화 스타일 노브 프리셋(UI 칩 라벨 → gpt-image 영어 구문). 단일 이미지·캐러셀 공통.
// '자동'(빈 값)이면 아트디렉터(Claude)가 자율로 정한다. 가이드 8슬롯 ④팔레트·⑤조명·⑥무드.
export const LIGHTING_PRESETS = [
  { v: "", l: "자동" },
  { v: "soft natural daylight", l: "자연광" },
  { v: "soft golden hour light, gentle rim light", l: "골든아워" },
  { v: "clean studio softbox lighting, soft shadow", l: "스튜디오" },
  { v: "dramatic studio rim lighting, deep shadows", l: "드라마틱" },
];

export const PALETTE_PRESETS = [
  { v: "", l: "자동" },
  { v: "limited palette of cream, beige and warm gray only, muted", l: "뉴트럴" },
  { v: "limited soft pastel palette only", l: "파스텔" },
  { v: "limited bold saturated palette, high contrast", l: "비비드" },
  { v: "limited earthy palette of olive, terracotta and sand only", l: "어스톤" },
];

export const MOOD_PRESETS = [
  { v: "", l: "자동" },
  { v: "premium, refined, minimal", l: "프리미엄" },
  { v: "warm, friendly, inviting", l: "따뜻함" },
  { v: "modern, clean, confident", l: "모던" },
  { v: "energetic, playful, vibrant", l: "에너지" },
];
