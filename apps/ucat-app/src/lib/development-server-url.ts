import { developmentServerUrl } from "@altitutor/shared";
import Constants from "expo-constants";

export function resolveServerUrl(value: string): string {
  return developmentServerUrl(value, {
    isNativeDevelopment: __DEV__ && process.env.EXPO_OS !== "web",
    hostUri: Constants.expoConfig?.hostUri,
  });
}
