import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";
import { apiClient } from "../lib/api-client.js";
import { ensureOk } from "../lib/ensure-ok.js";

const CURRENT_QUERY_KEY = ["time-entries", "current"];

export type TimeEntry = NonNullable<
  InferResponseType<(typeof apiClient.api)["time-entries"]["current"]["$get"]>
>;

export function useCurrentTimeEntry() {
  return useQuery({
    queryKey: CURRENT_QUERY_KEY,
    queryFn: async () => {
      const res = await ensureOk(await apiClient.api["time-entries"].current.$get());
      return res.json();
    },
  });
}

export function useStartTimeEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      categoryId: string;
      name?: string;
      plannedDurationMinutes?: number;
    }) => {
      const res = await ensureOk(await apiClient.api["time-entries"].$post({ json: input }));
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(CURRENT_QUERY_KEY, data);
    },
  });
}

export function useStartBreak() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await ensureOk(
        await apiClient.api["time-entries"][":id"].break.$patch({ param: { id } }),
      );
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(CURRENT_QUERY_KEY, data);
    },
  });
}

export function useResumeTimeEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await ensureOk(
        await apiClient.api["time-entries"][":id"].resume.$patch({ param: { id } }),
      );
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(CURRENT_QUERY_KEY, data);
    },
  });
}

// $patch の型は動的パス（:id）とリクエストボディを同時には推論できない
// （apps/api 側がバリデータ未導入で input スキーマが無いため、param のみの型になる。
// ランタイムには影響しない Hono RPC クライアントの型推論上の制限）。
// URL 生成だけ $url() で型安全に行い、実際のリクエストは fetch で送る。
export function useEndTimeEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      reason,
      focused,
    }: {
      id: string;
      reason?: string;
      focused?: boolean;
    }) => {
      const url = apiClient.api["time-entries"][":id"].end.$url({ param: { id } });
      const res = await ensureOk(
        await fetch(url, {
          method: "PATCH",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ reason, focused }),
        }),
      );
      return res.json() as Promise<TimeEntry>;
    },
    onSuccess: () => {
      queryClient.setQueryData(CURRENT_QUERY_KEY, null);
    },
  });
}
