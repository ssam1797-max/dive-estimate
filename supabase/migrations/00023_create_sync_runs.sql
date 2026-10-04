-- =====================================================================
-- 데이터 동기화 실행 이력(sync_runs) 테이블 생성.
--
-- "데이터 동기화 현황" 카드에서 최신 동기화 일시/처리 건수/상태 메시지를
-- 보여주려면, 지금까지는 클라이언트 메모리에만 있던(새로고침하면 사라지는)
-- 동기화 결과를 서버에 남겨둬야 한다. 퐁당닷컴 동기화는 카테고리×페이지
-- 단위로 여러 번 나눠 호출되므로(usePongdangChunkedSync 참고), 각 조각이
-- 아니라 전체가 끝난 시점에 1건으로 기록한다.
-- =====================================================================

create table if not exists public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'pongdang',
  started_at timestamptz not null,
  finished_at timestamptz not null default now(),
  status text not null check (status in ('success', 'error')),
  total_parsed integer not null default 0,
  inserted_count integer not null default 0,
  updated_count integer not null default 0,
  protected_count integer not null default 0,
  failed_count integer not null default 0,
  distinct_brand_count integer not null default 0,
  distinct_category_count integer not null default 0,
  message text,
  created_at timestamptz not null default now()
);

comment on table public.sync_runs is
  '퐁당닷컴 등 외부 데이터 동기화 실행 이력 1건당 1행. "데이터 동기화 현황" 카드가 최신 행/최근 N건을 보여준다.';

create index if not exists sync_runs_created_at_idx on public.sync_runs (created_at desc);
