import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Group, Screen, Failure, Loading } from "@/components/ui";
import { Choice } from "@/components/practice-controls";
import { useAppTheme } from "@/features/settings/theme";
import { dataApi } from "@/features/dashboard/api";
import { api } from "@/lib/api";
export default function AppSettings() {
  const { preference, setPreference } = useAppTheme();
  const client = useQueryClient();
  const q = useQuery({ queryKey: ["profile"], queryFn: dataApi.profile });
  const save = useMutation({
    mutationFn: (timezone: string) =>
      api("/profile", { method: "PATCH", body: { timezone } }),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["profile"] }),
        client.invalidateQueries({ queryKey: ["activity"] }),
        client.invalidateQueries({ queryKey: ["plan"] }),
      ]);
    },
  });
  const modes = ["system", "light", "dark"] as const;
  const zones = q.data?.timezoneOptions ?? [];
  return (
    <Screen>
      <Group dividers compact>
        <Choice
          label="Appearance"
          value={modes.indexOf(preference)}
          onChange={(v) => setPreference(modes[v] ?? "system")}
          options={[
            { value: 0, label: "System" },
            { value: 1, label: "Light" },
            { value: 2, label: "Dark" },
          ]}
        />
        {q.isPending ? (
          <Loading variant="rows" />
        ) : q.error ? (
          <Failure error={q.error} retry={() => void q.refetch()} />
        ) : (
          <Choice
            label="Timezone"
            value={zones.indexOf(q.data?.timezone ?? "")}
            onChange={(v) => {
              if (zones[v] && !save.isPending) save.mutate(zones[v]);
            }}
            options={zones.map((label, value) => ({
              value,
              label: label.replaceAll("_", " "),
            }))}
          />
        )}
      </Group>
      {save.error && <Failure error={save.error} />}
    </Screen>
  );
}
