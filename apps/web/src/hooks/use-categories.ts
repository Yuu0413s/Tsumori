import { useQuery } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";
import { apiClient } from "../lib/api-client.js";
import { ensureOk } from "../lib/ensure-ok.js";

export type Category = InferResponseType<typeof apiClient.api.categories.$get>[number];

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await ensureOk(await apiClient.api.categories.$get());
      return res.json();
    },
  });
}
