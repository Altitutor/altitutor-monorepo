import { Pressable, Text, View } from "react-native";
import { Stack } from "expo-router/stack";
import { useQuery } from "@tanstack/react-query";
import {
  Copy,
  Failure,
  Group,
  Loading,
  Screen,
  useColors,
} from "@/components/ui";
import { dataApi } from "@/features/dashboard/api";
import { openWebSettings } from "@/features/settings/open-web-settings";

export default function Profile() {
  const c = useColors();
  const q = useQuery({ queryKey: ["profile"], queryFn: dataApi.profile });
  const edit = () => {
    void openWebSettings("/settings/profile").then(() => q.refetch());
  };
  return (
    <Screen>
      {process.env.EXPO_OS === "ios" ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button onPress={edit}>Edit</Stack.Toolbar.Button>
        </Stack.Toolbar>
      ) : (
        <Stack.Screen
          options={{
            headerRight: () => (
              <Pressable
                accessibilityRole="button"
                onPress={edit}
                style={{ padding: 12 }}
              >
                <Text style={{ color: c.accent }}>Edit</Text>
              </Pressable>
            ),
          }}
        />
      )}
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <Failure error={q.error} retry={() => void q.refetch()} />
      ) : (
        <Group dividers>
          {[
            ["First name", q.data.firstName],
            ["Last name", q.data.lastName],
            ["Email", q.data.email],
            ["Timezone", q.data.timezone.replaceAll("_", " ")],
          ].map(([label, value]) => (
            <View
              key={label}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 16,
                minHeight: 36,
              }}
            >
              <Copy>{label}</Copy>
              <Text
                selectable
                style={{
                  flex: 1,
                  textAlign: "right",
                  color: c.secondary,
                  fontSize: 16,
                }}
              >
                {value || "—"}
              </Text>
            </View>
          ))}
        </Group>
      )}
    </Screen>
  );
}
