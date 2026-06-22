"use client";

import { useEffect, useState } from "react";
import type { InspireResponse } from "@/types/inspire";

interface InspireState {
  data: InspireResponse | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/** 拉取 /api/inspire（aihot 精选 + X 缓存）。客户端调用，内置一次性加载 + 手动刷新。 */
export function useInspire(): InspireState {
  const [data, setData] = useState<InspireResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch("/api/inspire")
      .then((res) => res.json() as Promise<InspireResponse>)
      .then((json) => {
        if (cancelled) return;
        setData(json);
        if (!json.success && json.error) setError(json.error);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "加载失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  return { data, loading, error, reload: () => setNonce((n) => n + 1) };
}
