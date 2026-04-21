-- Phase 3: Semantic BP retrieval
-- Gemini text-embedding-004 (768차원) 벡터를 brand_references에 저장.
-- brand_id + cosine 거리로 kNN 검색. ivfflat 인덱스.

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE brand_references
  ADD COLUMN embedding vector(768),
  ADD COLUMN embedding_model TEXT,
  ADD COLUMN embedded_at TIMESTAMPTZ;

-- ivfflat: embedding이 null이 아닌 row만 인덱싱.
-- lists는 데이터량에 따라 튜닝. 초기엔 100.
CREATE INDEX idx_brand_refs_embedding
  ON brand_references
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- brand_id 기준 kNN 검색. 호출 간결성을 위해 RPC 함수로 노출.
CREATE OR REPLACE FUNCTION match_brand_references(
  p_brand_id UUID,
  p_embedding vector(768),
  p_limit INT DEFAULT 5,
  p_min_similarity FLOAT DEFAULT 0.3
)
RETURNS TABLE (
  id UUID,
  similarity FLOAT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    id,
    1 - (embedding <=> p_embedding) AS similarity
  FROM brand_references
  WHERE brand_id = p_brand_id
    AND embedding IS NOT NULL
    AND vision_status = 'ready'
    AND is_negative = false
    AND 1 - (embedding <=> p_embedding) >= p_min_similarity
  ORDER BY embedding <=> p_embedding
  LIMIT p_limit;
$$;
