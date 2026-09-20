import { HeaderActions } from "@/components/header-actions";
import { useEffect, useState } from "react";
import { Alert } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Action,
  Copy,
  Failure,
  Field,
  Group,
  Loading,
  Screen,
} from "@/components/ui";
import { dataApi } from "@/features/dashboard/api";
import { api } from "@/lib/api";
export default function Account() {
  const q = useQuery({ queryKey: ["profile"], queryFn: dataApi.profile });
  const client = useQueryClient();
  const [firstName, setFirst] = useState("");
  const [lastName, setLast] = useState("");
  const [timezone, setTimezone] = useState("");
  useEffect(() => {
    if (q.data) {
      setFirst(q.data.firstName ?? "");
      setLast(q.data.lastName ?? "");
      setTimezone(q.data.timezone);
    }
  }, [q.data]);
  const save = useMutation({
    mutationFn: () =>
      api("/profile", {
        method: "PATCH",
        body: { firstName, lastName, timezone },
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["profile"] });
      Alert.alert("Profile saved");
    },
  });
  return (
    <Screen>
      <HeaderActions />
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <Failure error={q.error} retry={() => void q.refetch()} />
      ) : (
        <Group title="Your profile">
          <Copy muted>{q.data?.email}</Copy>
          <Field
            accessibilityLabel="First name"
            placeholder="First name"
            value={firstName}
            onChangeText={setFirst}
            autoComplete="given-name"
          />
          <Field
            accessibilityLabel="Last name"
            placeholder="Last name"
            value={lastName}
            onChangeText={setLast}
            autoComplete="family-name"
          />
          <Field
            accessibilityLabel="Timezone"
            placeholder="Australia/Adelaide"
            value={timezone}
            onChangeText={setTimezone}
            autoCapitalize="none"
          />
          <Action
            title={save.isPending ? "Saving…" : "Save profile"}
            disabled={save.isPending || !firstName.trim() || !lastName.trim()}
            onPress={() => save.mutate()}
          />
          {save.error && <Failure error={save.error} />}
        </Group>
      )}
    </Screen>
  );
}
