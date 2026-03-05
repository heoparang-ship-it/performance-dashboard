"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { api, Store } from "@/lib/api";

interface StoreCtx {
  stores: Store[];
  selectedStoreId: number | null;
  setSelectedStoreId: (id: number) => void;
  refreshStores: () => Promise<void>;
  hasLinkedStores: boolean;
  periodDays: number;
  setPeriodDays: (days: number) => void;
}

const Ctx = createContext<StoreCtx>({
  stores: [],
  selectedStoreId: null,
  setSelectedStoreId: () => {},
  refreshStores: async () => {},
  hasLinkedStores: false,
  periodDays: 7,
  setPeriodDays: () => {},
});

export const useStore = () => useContext(Ctx);

export default function StoreProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  const [periodDays, setPeriodDays] = useState<number>(7);

  const refreshStores = useCallback(async () => {
    try {
      const data = await api.getStores(true); // 연결된 스토어만
      setStores(data);
      if (data.length > 0) {
        setSelectedStoreId((prev) => {
          // 현재 선택이 없거나, 선택된 스토어가 목록에 없으면 첫번째 선택
          if (!prev || !data.find((s) => s.id === prev)) {
            return data[0].id;
          }
          return prev;
        });
      }
    } catch {
      // 서버 미실행 시 무시
    }
  }, []);

  useEffect(() => {
    refreshStores();
  }, [refreshStores]);

  return (
    <Ctx.Provider
      value={{
        stores,
        selectedStoreId,
        setSelectedStoreId,
        refreshStores,
        hasLinkedStores: stores.length > 0,
        periodDays,
        setPeriodDays,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
