import "server-only";

/**
 * Supabase/PostgREST 는 요청 1건당 기본 최대 1000행만 반환한다(프로젝트의
 * db-max-rows 기본값). range() 없이 그냥 select 하면 나머지는 조용히
 * 잘려나간다 — 테이블이 1000행을 넘을 수 있는 모든 select 는 이 함수로
 * range() 페이지네이션을 거쳐 전량을 가져와야 한다.
 */
const SUPABASE_PAGE_SIZE = 1000;

interface PageFetchError {
  message: string;
  details?: string | null;
  hint?: string | null;
  code?: string | null;
}

interface PageFetchResult<T> {
  data: T[] | null;
  error: PageFetchError | null;
  /**
   * PostgREST 가 응답 헤더(Content-Range)로 돌려주는 "테이블 전체 행 수".
   * 호출부가 `.select(..., { count: "exact" })` 를 넘겨야만 채워진다 —
   * 채워져 있으면 남은 페이지 수를 미리 계산해 한 번에 병렬로 가져올 수
   * 있다(장비 4천여 건처럼 여러 페이지가 필요한 테이블에서 순차 요청 대신
   * 동시 요청으로 처리해 네비게이션 대기 시간을 크게 줄인다).
   */
  count?: number | null;
}

function toThrown(error: PageFetchError): Error {
  console.error("fetchAllPages 조회 실패:", {
    message: error.message,
    details: error.details,
    hint: error.hint,
    code: error.code,
  });
  const extra = [error.details, error.hint].filter(Boolean).join(" / ");
  return new Error(extra ? `${error.message} (${extra})` : error.message);
}

/** count 를 모를 때(호출부가 { count: "exact" } 를 안 넘긴 경우)의 기존 순차 폴백. */
async function fetchRemainingSequentially<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PageFetchResult<T>>,
  alreadyFetched: T[],
  nextFrom: number
): Promise<T[]> {
  const rows = [...alreadyFetched];
  let from = nextFrom;
  while (true) {
    const { data, error } = await fetchPage(from, from + SUPABASE_PAGE_SIZE - 1);
    if (error) throw toThrown(error);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < SUPABASE_PAGE_SIZE) break;
    from += SUPABASE_PAGE_SIZE;
  }
  return rows;
}

export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PageFetchResult<T>>
): Promise<T[]> {
  const first = await fetchPage(0, SUPABASE_PAGE_SIZE - 1);
  if (first.error) throw toThrown(first.error);

  const firstData = first.data ?? [];
  if (firstData.length === 0) return [];
  if (firstData.length < SUPABASE_PAGE_SIZE) return firstData;

  // 첫 페이지가 꽉 찼다 — 더 남았을 수 있다. count 를 모르면(호출부가
  // { count: "exact" } 를 안 넘김) 안전하게 기존 방식(순차)으로 이어서 가져온다.
  if (first.count == null) {
    return fetchRemainingSequentially(fetchPage, firstData, SUPABASE_PAGE_SIZE);
  }

  const totalPages = Math.ceil(first.count / SUPABASE_PAGE_SIZE);
  if (totalPages <= 1) return firstData;

  // 남은 페이지 수를 미리 알고 있으므로 순차 대기 없이 한 번에 동시 요청한다.
  const remainingPages = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, i) => i + 1).map(async (pageIndex) => {
      const from = pageIndex * SUPABASE_PAGE_SIZE;
      const { data, error } = await fetchPage(from, from + SUPABASE_PAGE_SIZE - 1);
      if (error) throw toThrown(error);
      return data ?? [];
    })
  );

  return [firstData, ...remainingPages].flat();
}
