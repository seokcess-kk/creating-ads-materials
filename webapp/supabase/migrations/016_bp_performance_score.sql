-- Phase 1: BP 성과 점수 + weighted retrieval
-- performance_score는 사용자가 수동 부여하는 성과 등급(1=실패 ~ 5=대박, null=미평가).
-- 기존 weight는 자사 ship 평점 → 역전파(bp_rating_feedback)로 자동 조정되는 내부 신호이고,
-- performance_score는 외부 수입(ATC/Meta/TikTok 등)·수동 큐레이션 성과를 담는 보조 신호.
-- 랭킹 가중은 애플리케이션(TS)에서 수행해 공식 튜닝을 자유롭게 한다.

ALTER TABLE brand_references
  ADD COLUMN performance_score SMALLINT CHECK (performance_score BETWEEN 1 AND 5);

-- 기존 RPC는 (id, similarity)만 반환 → weight/performance_score도 노출하도록 재정의.
-- RETURN TABLE 시그니처 변경이라 DROP 후 CREATE.
DROP FUNCTION IF EXISTS match_brand_references(UUID, vector(768), INT, FLOAT);

CREATE FUNCTION match_brand_references(
  p_brand_id UUID,
  p_embedding vector(768),
  p_limit INT DEFAULT 5,
  p_min_similarity FLOAT DEFAULT 0.3
)
RETURNS TABLE (
  id UUID,
  similarity FLOAT,
  weight INT,
  performance_score SMALLINT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    r.id,
    1 - (r.embedding <=> p_embedding) AS similarity,
    r.weight,
    r.performance_score
  FROM brand_references r
  WHERE r.brand_id = p_brand_id
    AND r.embedding IS NOT NULL
    AND r.vision_status = 'ready'
    AND r.is_negative = false
    AND 1 - (r.embedding <=> p_embedding) >= p_min_similarity
  ORDER BY r.embedding <=> p_embedding
  LIMIT p_limit;
$$;
