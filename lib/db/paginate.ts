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

export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: PageFetchError | null }>
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await fetchPage(from, from + SUPABASE_PAGE_SIZE - 1);
    if (error) {
      console.error("fetchAllPages 조회 실패:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
      const extra = [error.details, error.hint].filter(Boolean).join(" / ");
      throw new Error(extra ? `${error.message} (${extra})` : error.message);
    }
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < SUPABASE_PAGE_SIZE) break;
    from += SUPABASE_PAGE_SIZE;
  }
  return rows;
}
