import { useQuery } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";
import { apiClient } from "../lib/api-client.js";
import { ensureOk } from "../lib/ensure-ok.js";

export type TodayEntry = InferResponseType<
  (typeof apiClient.api)["time-entries"]["today"]["$get"]
>[number];

export function useTodayEntries() {
  return useQuery({
    queryKey: ["time-entries", "today"],
    queryFn: async () => {
      const res = await ensureOk(await apiClient.api["time-entries"].today.$get());
      return res.json();
    },
  });
}
