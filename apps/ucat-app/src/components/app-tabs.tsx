import { StudyOrb } from "@/features/study-plan/components/study-orb";
import { useAttemptBannerInset } from "@/features/practice/components/attempt-banner-inset";
import { View, Platform } from "react-native";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useColors } from "@/components/ui";
export default function AppTabs() {
  const c = useColors();
  const reserveTopInsetForBanner = useAttemptBannerInset();
  const tabInsetProps = reserveTopInsetForBanner
    ? ({ disableAutomaticContentInsets: true } as const)
    : {};
  return (
    <View style={{ flex: 1 }}>
      <NativeTabs tintColor={c.accent} backgroundColor={c.card}>
        <NativeTabs.Trigger name="(home)" {...tabInsetProps}>
          <NativeTabs.Trigger.Icon sf="house" md="home" />
          <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="learn" {...tabInsetProps}>
          <NativeTabs.Trigger.Icon sf="book" md="menu_book" />
          <NativeTabs.Trigger.Label>Learn</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="practice" {...tabInsetProps}>
          <NativeTabs.Trigger.Icon sf="pencil.and.outline" md="edit" />
          <NativeTabs.Trigger.Label>Practice</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="progress" {...tabInsetProps}>
          <NativeTabs.Trigger.Icon sf="chart.bar" md="bar_chart" />
          <NativeTabs.Trigger.Label>Progress</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        {Platform.OS === "ios" && Number(Platform.Version) >= 26 && (
          <NativeTabs.BottomAccessory>
            <StudyOrb />
          </NativeTabs.BottomAccessory>
        )}
      </NativeTabs>
      {(Platform.OS !== "ios" || Number(Platform.Version) < 26) && (
        <View style={{ position: "absolute", bottom: 82, left: 16, right: 16 }}>
          <StudyOrb />
        </View>
      )}
    </View>
  );
}
