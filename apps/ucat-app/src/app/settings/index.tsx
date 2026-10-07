import { Alert, Linking } from "react-native";
import { Action, Group, Row, Screen } from "@/components/ui";
import { haptic } from "@/lib/haptics";
import { supabase } from "@/lib/supabase";
import { disablePushNotifications } from "@/features/notifications/push";
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
        title="Privacy policy"
        secondary
        onPress={() => void Linking.openURL("https://altitutor.com/mobile-privacy/")}
      />
      <Action
        title="Sign out"
        secondary
        tone="danger"
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
                  haptic("warning");
                  void disablePushNotifications()
                    .then(() => supabase.auth.signOut({ scope: "local" }))
                    .then(({ error }) => {
                      if (error) Alert.alert("Unable to sign out", error.message);
                    })
                    .catch((error: unknown) => Alert.alert(
                      "Unable to sign out",
                      error instanceof Error ? error.message : "Please try again.",
                    ));
                },
              },
            ],
          )
        }
      />
    </Screen>
  );
}
