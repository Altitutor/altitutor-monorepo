import { Alert, Linking } from "react-native";
import { openBrowserAsync } from "expo-web-browser";

const privacyPolicyUrl = "https://altitutor.com/mobile-privacy/";

export async function openPrivacyPolicy(): Promise<void> {
  try {
    await Linking.openURL(privacyPolicyUrl);
    return;
  } catch {
    // iOS may refuse the external browser even for a valid HTTPS URL.
  }
  try {
    await openBrowserAsync(privacyPolicyUrl);
  } catch {
    Alert.alert(
      "Unable to open privacy policy",
      `Please try again, or open this address in your browser:\n${privacyPolicyUrl}`,
    );
  }
}
