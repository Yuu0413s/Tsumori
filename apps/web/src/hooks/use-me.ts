import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../lib/api-client.js";
import { ensureOk } from "../lib/ensure-ok.js";

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const res = await ensureOk(await apiClient.api.me.$get());
      return res.json();
    },
  });
}
