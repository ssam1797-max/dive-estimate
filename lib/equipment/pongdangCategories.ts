/**
 * 퐁당닷컴 크롤링 대상 최상위 카테고리 코드 목록.
 *  - c0002 ("스쿠버"): 마스크/핀/슈트/호흡기/컴퓨터 등 핵심 장비 전체.
 *  - c0003 ("스쿠버 acc"): 스냅링/오링/아답터/호스/장비걸이/세척제 등 부속품·
 *    소모품 계열.
 *
 * 크롤러(server-only)와, 카테고리별로 나눠 순차 호출하는 클라이언트 쪽
 * 동기화 훅이 둘 다 이 목록을 알아야 해서 별도 파일로 뺐다 — 크롤러 파일은
 * "server-only"가 걸려 있어 클라이언트 컴포넌트에서 직접 import할 수 없다.
 */
export const PONGDANG_CATEGORY_CODES = ["c0002", "c0003"] as const;

export type PongdangCategoryCode = (typeof PONGDANG_CATEGORY_CODES)[number];
