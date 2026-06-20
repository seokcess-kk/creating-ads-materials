-- M22: 안내문(notice) 콘텐츠 모드
-- 설득형(BOFU) 캠페인과 별개로, 안내문/공지처럼 정보 전달이 핵심인 ad-hoc 콘텐츠를
-- 사전 저장된 offer/audience 없이 처리하기 위한 캠페인 레벨 확장.
--
-- 설계 메모:
--  - content_mode 가 분기 축. 기존 행은 'persuasion' 으로 backfill 되어 동작 불변.
--  - goal ENUM 은 건드리지 않는다(ALTER TYPE 회피). notice 캠페인도 goal='BOFU' 를
--    유지하되 런타임 분기는 content_mode 로만 한다.
--  - raw_content: 안내문 원문 통째 paste(1급 입력).
--  - notice_meta: 원문에서 추출/검수한 정보 슬롯(정원·신청URL·공지URL·대상·마감·기입요청).
--  - tone_override: identity 프리미엄 voice 를 사무적 톤으로 내리는 공식 경로.

ALTER TABLE campaigns
  ADD COLUMN content_mode TEXT NOT NULL DEFAULT 'persuasion'
    CHECK (content_mode IN ('persuasion', 'notice')),
  ADD COLUMN raw_content TEXT,
  ADD COLUMN notice_meta JSONB,
  ADD COLUMN tone_override TEXT;

COMMENT ON COLUMN campaigns.content_mode IS 'persuasion=설득형 BOFU 광고 / notice=안내문(정보 전달)';
COMMENT ON COLUMN campaigns.raw_content IS '안내문 원문 통째 paste (notice 모드의 1급 입력)';
COMMENT ON COLUMN campaigns.notice_meta IS '안내문 정보 슬롯 JSON: {summary,capacity,applyUrl,noticeUrl,eligibility,deadline,requestFields[]}';
COMMENT ON COLUMN campaigns.tone_override IS '캠페인 레벨 톤 오버라이드 자유 텍스트 (예: 사무적, 프리미엄 지양)';
