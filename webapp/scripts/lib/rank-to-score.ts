/**
 * TikTok CC Top Ads는 이미 "상위 광고"만 보이는 큐레이션이라 대부분이 평균 이상이다.
 * 같은 덤프 안에서의 상대 순위를 1~5로 분배해 retrieval 가중을 다양화한다.
 *
 * 분포 (total=N):
 *   상위 20% → 5 (대박)
 *   20~40% → 4
 *   40~60% → 3 (평균)
 *   60~80% → 2
 *   80~100% → 1
 *
 * rank: 0-based. total이 1이면 5점.
 */
export function rankToPerformanceScore(rank: number, total: number): 1 | 2 | 3 | 4 | 5 {
  if (total <= 0) return 3;
  const pct = rank / total;
  if (pct < 0.2) return 5;
  if (pct < 0.4) return 4;
  if (pct < 0.6) return 3;
  if (pct < 0.8) return 2;
  return 1;
}
