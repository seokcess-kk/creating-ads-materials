-- Prompt Caching 도입: cache creation 토큰(첫 호출 시 캐시 저장)을 별도 추적.
-- cache read(90% 할인)와 달리 cache creation은 기본 input 단가의 1.25배.
-- 정확한 비용 추정을 위해 컬럼 분리.

ALTER TABLE api_usage
  ADD COLUMN cache_creation_tokens INT;
