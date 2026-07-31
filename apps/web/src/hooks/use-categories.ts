import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";
import { apiClient } from "../lib/api-client.js";
import { ensureOk } from "../lib/ensure-ok.js";

const CATEGORIES_QUERY_KEY = ["categories"];

export type Category = InferResponseType<typeof apiClient.api.categories.$get>[number];

export function useCategories() {
  return useQuery({
    queryKey: CATEGORIES_QUERY_KEY,
    queryFn: async () => {
      const res = await ensureOk(await apiClient.api.categories.$get());
      return res.json();
    },
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; color?: string }) => {
      const res = await ensureOk(await apiClient.api.categories.$post({ json: input }));
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY });
    },
  });
}

// $patch の型は動的パス（:id）とリクエストボディを同時には推論できない
// （apps/api 側がバリデータ未導入で input スキーマが無いため、param のみの型になる。
// use-time-entry.ts の useEndTimeEntry と同じ制限・同じ回避策）。
// URL生成だけ $url() で型安全に行い、実際のリクエストは fetch で送る。
export function useUpdateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string; name?: string; color?: string }) => {
      const url = apiClient.api.categories[":id"].$url({ param: { id } });
      const res = await ensureOk(
        await fetch(url, {
          method: "PATCH",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(patch),
        }),
      );
      return res.json() as Promise<Category>;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY });
    },
  });
}

// 「非表示」は論理削除（isActive=false）で表現される（apps/api/src/routes/categories.ts）。
// 一覧（listVisible）はisActive=trueのみ返すため、成功後は一覧を取り直すだけでよい。
export function useHideCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await ensureOk(await apiClient.api.categories[":id"].$delete({ param: { id } }));
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY });
    },
  });
}
