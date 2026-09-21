import { Alert } from "react-native";
import { Action, Group, Row, Screen } from "@/components/ui";
import { supabase } from "@/lib/supabase";
export default function Settings() {
  return (
    <Screen>
      <Group>
        <Row
          title="App settings"
          icon="settings"
          href="/settings/app-settings"
        />
        <Row title="My profile" icon="person" href="/settings/profile" />
        <Row title="Plan" icon="plan" href="/settings/plan" />
        <Row title="Refer friends" icon="people" href="/settings/referrals" />
      </Group>
      <Action
        title="Sign out"
        secondary
        onPress={() =>
          Alert.alert(
            "Sign out?",
            "Your saved progress stays with your account.",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Sign out",
                style: "destructive",
                onPress: () => {
                  void supabase.auth.signOut().then(({ error }) => {
                    if (error) Alert.alert("Unable to sign out", error.message);
                  });
                },
              },
            ],
          )
        }
      />
    </Screen>
  );
}
