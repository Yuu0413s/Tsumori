import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";
import { apiClient } from "../lib/api-client.js";
import { ensureOk } from "../lib/ensure-ok.js";

const SETTINGS_QUERY_KEY = ["settings"];

export type UserSettings = InferResponseType<typeof apiClient.api.settings.$get>;

export type SettingsPatch = Partial<{
  breakExtendsDeadline: boolean;
  soundEnabled: boolean;
  preAlarmMinutes: number | null;
}>;

export function useSettings() {
  return useQuery({
    queryKey: SETTINGS_QUERY_KEY,
    queryFn: async () => {
      const res = await ensureOk(await apiClient.api.settings.$get());
      return res.json();
    },
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patch: SettingsPatch) => {
      const res = await ensureOk(await apiClient.api.settings.$patch({ json: patch }));
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(SETTINGS_QUERY_KEY, data);
    },
  });
}
