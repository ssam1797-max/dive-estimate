"use client";

import * as React from "react";
import type { EstimateItemDraft } from "@/lib/estimates/types";
import {
  calculateEffectiveUnitPrice,
  type DiscountPolicyMap,
  type PriceTier,
} from "@/lib/estimates/pricing";

/**
 * 견적 목록(state.items)을 임시 저장하는 localStorage 키. 견적서 작성 화면을
 * 벗어났다가(내비게이션 이동 등) 돌아와도 담아둔 장비 목록이 유실되지 않도록
 * 매 변경마다 이 키에 동기화한다.
 */
const DRAFT_STORAGE_KEY = "draft_estimate_items";

export interface EstimateBuilderState {
  date: string;
  estimateNumber: string;
  isEstimateNumberLoading: boolean;
  estimateNumberError: string | null;
  providerId: string;
  receiverId: string;
  remarks: string;
  priceTier: PriceTier;
  items: EstimateItemDraft[];
}

type Action =
  | { type: "SET_DATE"; date: string }
  | { type: "SET_PROVIDER"; providerId: string }
  | { type: "SET_RECEIVER"; receiverId: string }
  | { type: "SET_REMARKS"; remarks: string }
  | { type: "SET_PRICE_TIER"; tier: PriceTier; discountPolicies: DiscountPolicyMap }
  | { type: "ESTIMATE_NUMBER_LOADING" }
  | { type: "ESTIMATE_NUMBER_LOADED"; estimateNumber: string }
  | { type: "ESTIMATE_NUMBER_FAILED"; message: string }
  | { type: "ADD_ITEM"; item: EstimateItemDraft }
  | { type: "REMOVE_ITEM"; clientId: string }
  | { type: "UPDATE_ITEM_QUANTITY"; clientId: string; quantity: number }
  | { type: "UPDATE_ITEM_UNIT_PRICE"; clientId: string; unitPrice: number }
  | { type: "LOAD_ITEMS"; items: EstimateItemDraft[] }
  | { type: "RESET_AFTER_SAVE" };

function todayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** 저장된 견적서를 "이어서 작성"할 때 폼 상태를 미리 채우는 초기값. */
export interface EstimateBuilderInitialData {
  date: string;
  estimateNumber: string;
  providerId: string;
  receiverId: string;
  remarks: string;
  priceTier: PriceTier;
  items: EstimateItemDraft[];
}

function createInitialState(initialData?: EstimateBuilderInitialData): EstimateBuilderState {
  if (initialData) {
    return {
      date: initialData.date,
      estimateNumber: initialData.estimateNumber,
      isEstimateNumberLoading: false,
      estimateNumberError: null,
      providerId: initialData.providerId,
      receiverId: initialData.receiverId,
      remarks: initialData.remarks,
      priceTier: initialData.priceTier,
      items: initialData.items,
    };
  }
  return {
    date: todayDateString(),
    estimateNumber: "",
    isEstimateNumberLoading: false,
    estimateNumberError: null,
    providerId: "",
    receiverId: "",
    remarks: "",
    priceTier: "RETAIL",
    items: [],
  };
}

function reducer(
  state: EstimateBuilderState,
  action: Action
): EstimateBuilderState {
  switch (action.type) {
    case "SET_DATE":
      return { ...state, date: action.date };
    case "SET_PROVIDER":
      return { ...state, providerId: action.providerId };
    case "SET_RECEIVER":
      return { ...state, receiverId: action.receiverId };
    case "SET_REMARKS":
      return { ...state, remarks: action.remarks };
    case "SET_PRICE_TIER": {
      const recalculated = state.items.map((item) => ({
        ...item,
        unitPrice: calculateEffectiveUnitPrice(
          item.priceRetail,
          item.brand,
          action.tier,
          action.discountPolicies
        ),
      }));
      return { ...state, priceTier: action.tier, items: recalculated };
    }
    case "ESTIMATE_NUMBER_LOADING":
      return {
        ...state,
        isEstimateNumberLoading: true,
        estimateNumberError: null,
      };
    case "ESTIMATE_NUMBER_LOADED":
      return {
        ...state,
        estimateNumber: action.estimateNumber,
        isEstimateNumberLoading: false,
        estimateNumberError: null,
      };
    case "ESTIMATE_NUMBER_FAILED":
      return {
        ...state,
        isEstimateNumberLoading: false,
        estimateNumberError: action.message,
      };
    case "ADD_ITEM":
      return { ...state, items: [...state.items, action.item] };
    case "REMOVE_ITEM":
      return {
        ...state,
        items: state.items.filter((item) => item.clientId !== action.clientId),
      };
    case "UPDATE_ITEM_QUANTITY":
      return {
        ...state,
        items: state.items.map((item) =>
          item.clientId === action.clientId
            ? { ...item, quantity: action.quantity }
            : item
        ),
      };
    case "UPDATE_ITEM_UNIT_PRICE":
      return {
        ...state,
        items: state.items.map((item) =>
          item.clientId === action.clientId
            ? { ...item, unitPrice: action.unitPrice }
            : item
        ),
      };
    case "LOAD_ITEMS":
      return { ...state, items: action.items };
    case "RESET_AFTER_SAVE":
      return createInitialState();
    default:
      return state;
  }
}

/**
 * 견적서 작성 화면의 클라이언트 상태(기본 정보 + 장비 목록)를 관리하는 훅.
 * 날짜가 바뀔 때마다 견적서 번호(YYMMDD-순번)를 서버에서 자동으로 다시 받아옵니다.
 *
 * initialData 를 넘기면("이어서 작성/수정" 진입) 그 값으로 폼을 채우고,
 * 원본 견적서 번호가 자동 재발급 로직에 의해 조용히 바뀌어버리는 일이 없도록
 * 번호 자동 발급 effect 와 localStorage 임시저장(다른 "신규 작성" 세션의
 * 초안과 뒤섞이면 안 됨) 을 모두 건너뛴다 — 신규 작성(initialData 없음)의
 * 기존 동작은 이 분기와 무관하게 100% 그대로 유지된다.
 */
export function useEstimateBuilder(
  discountPolicies: DiscountPolicyMap,
  initialData?: EstimateBuilderInitialData,
  options?: {
    /**
     * "이 견적서 복제"처럼 항목/공급자 등은 그대로 가져오면서도 견적서
     * 번호는 새로 발급받아야 하는 경우 true로 넘긴다. 기본값(false)은
     * "이어서 수정" 세션과 동일하게 원본 번호를 그대로 유지한다.
     */
    regenerateEstimateNumber?: boolean;
  }
) {
  const [state, dispatch] = React.useReducer(
    reducer,
    initialData,
    createInitialState
  );

  const isEditSessionRef = React.useRef(!!initialData);
  const skipNumberFetchRef = React.useRef(
    !!initialData && !options?.regenerateEstimateNumber
  );

  const discountPoliciesRef = React.useRef(discountPolicies);
  React.useEffect(() => {
    discountPoliciesRef.current = discountPolicies;
  }, [discountPolicies]);

  const fetchEstimateNumber = React.useCallback(async (date: string) => {
    dispatch({ type: "ESTIMATE_NUMBER_LOADING" });
    try {
      const response = await fetch(
        `/api/estimates/next-number?date=${encodeURIComponent(date)}`
      );
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body?.error ?? "견적서 번호를 생성하지 못했습니다.");
      }

      dispatch({
        type: "ESTIMATE_NUMBER_LOADED",
        estimateNumber: body.estimateNumber,
      });
    } catch (error) {
      console.error("견적서 번호 생성 실패:", error);
      dispatch({
        type: "ESTIMATE_NUMBER_FAILED",
        message:
          error instanceof Error
            ? error.message
            : "견적서 번호를 생성하지 못했습니다.",
      });
    }
  }, []);

  React.useEffect(() => {
    // "이어서 작성/수정" 세션에서는 이미 로드된 원본 견적서 번호를 그대로
    // 유지한다 — 이 effect 는 최초 마운트 시에도 실행되므로, 여기서 막지
    // 않으면 로드하자마자 원본 번호가 새로 발급된 번호로 조용히 바뀐다.
    // (단, "견적서 복제"처럼 regenerateEstimateNumber 가 true면 새 번호를
    // 발급받아야 하므로 건너뛰지 않는다.)
    if (skipNumberFetchRef.current) return;
    fetchEstimateNumber(state.date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.date]);

  // 마운트 시 1회, localStorage 에 남아있는 임시 저장 목록이 있으면 그대로 복원한다.
  // (initial state 는 SSR/CSR 첫 렌더가 항상 동일해야 hydration 오류가 없으므로,
  // localStorage 접근은 useState 초기값이 아니라 마운트 후 effect 에서 수행한다.)
  // "이어서 작성/수정" 세션에서는 건너뛴다 — 이미 불러온 원본 견적서 항목이
  // 다른 "신규 작성" 세션에서 남겨둔 임시 초안으로 덮어써지면 안 된다.
  React.useEffect(() => {
    if (isEditSessionRef.current) return;
    try {
      const saved = window.localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        dispatch({ type: "LOAD_ITEMS", items: parsed as EstimateItemDraft[] });
      }
    } catch (error) {
      console.error("임시 저장된 견적 목록을 복원하지 못했습니다:", error);
    }
  }, []);

  // 견적 목록이 바뀔 때마다(추가/삭제/수량 변경 등) 즉시 localStorage 에 동기화한다.
  // 목록이 비면 저장해둔 임시 데이터도 함께 지운다(비어있는 배열을 계속 남겨두지 않는다).
  // "이어서 작성/수정" 세션의 항목은 별개의 초안이므로 이 공용 임시저장 키에
  // 섞어 넣지 않는다(다음에 "신규 작성" 화면을 열었을 때 엉뚱하게 복원되는 것 방지).
  React.useEffect(() => {
    if (isEditSessionRef.current) return;
    try {
      if (state.items.length === 0) {
        window.localStorage.removeItem(DRAFT_STORAGE_KEY);
      } else {
        window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(state.items));
      }
    } catch (error) {
      console.error("견적 목록 임시 저장에 실패했습니다:", error);
    }
  }, [state.items]);

  const setDate = React.useCallback(
    (date: string) => dispatch({ type: "SET_DATE", date }),
    []
  );
  const setProviderId = React.useCallback(
    (providerId: string) => dispatch({ type: "SET_PROVIDER", providerId }),
    []
  );
  const setReceiverId = React.useCallback(
    (receiverId: string) => dispatch({ type: "SET_RECEIVER", receiverId }),
    []
  );
  const setRemarks = React.useCallback(
    (remarks: string) => dispatch({ type: "SET_REMARKS", remarks }),
    []
  );
  const setPriceTier = React.useCallback(
    (tier: PriceTier) =>
      dispatch({ type: "SET_PRICE_TIER", tier, discountPolicies: discountPoliciesRef.current }),
    []
  );
  const addItem = React.useCallback(
    (item: EstimateItemDraft) => dispatch({ type: "ADD_ITEM", item }),
    []
  );
  const removeItem = React.useCallback(
    (clientId: string) => dispatch({ type: "REMOVE_ITEM", clientId }),
    []
  );
  const updateItemQuantity = React.useCallback(
    (clientId: string, quantity: number) =>
      dispatch({ type: "UPDATE_ITEM_QUANTITY", clientId, quantity }),
    []
  );
  const updateItemUnitPrice = React.useCallback(
    (clientId: string, unitPrice: number) =>
      dispatch({ type: "UPDATE_ITEM_UNIT_PRICE", clientId, unitPrice }),
    []
  );
  const loadItems = React.useCallback(
    (items: EstimateItemDraft[]) => dispatch({ type: "LOAD_ITEMS", items }),
    []
  );
  const clearItems = React.useCallback(
    () => dispatch({ type: "LOAD_ITEMS", items: [] }),
    []
  );
  const resetAfterSave = React.useCallback(
    () => dispatch({ type: "RESET_AFTER_SAVE" }),
    []
  );
  const retryEstimateNumber = React.useCallback(
    () => fetchEstimateNumber(state.date),
    [fetchEstimateNumber, state.date]
  );

  const totalAmount = React.useMemo(
    () =>
      state.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    [state.items]
  );

  return {
    state,
    totalAmount,
    actions: {
      setDate,
      setProviderId,
      setReceiverId,
      setRemarks,
      setPriceTier,
      addItem,
      removeItem,
      updateItemQuantity,
      updateItemUnitPrice,
      loadItems,
      clearItems,
      resetAfterSave,
      retryEstimateNumber,
    },
  };
}
