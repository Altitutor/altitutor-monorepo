import { Sentry } from "@/lib/sentry-client";
import {
  SheetNavigationProvider,
  useSheetTransition,
} from "@/features/navigation/use-open-screen";
import { LessonNavigationProvider } from "@/features/learning/lesson-navigation";
import { useOnboardingAccess } from "@/features/auth/onboarding-access";
import { ReviewNavigationProvider } from "@/features/attempts/review-navigation";
import { TrainerToolsProvider } from "@/features/skill-trainer/components/trainer-tools";
import { Platform, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AttemptBanner } from "@/features/practice/components/attempt-banner";
import {
  AttemptBannerInsetProvider,
  useAttemptBannerStackScreenOptions,
} from "@/features/practice/components/attempt-banner-inset";
import { useEffect, useState } from "react";
import { setBackgroundColorAsync } from "expo-system-ui";
import { AppThemeProvider, useAppTheme } from "@/features/settings/theme";
import { ExamToolsProvider } from "@/features/question-engine/components/exam-tools";
import { ThemeProvider, DarkTheme, DefaultTheme } from "expo-router";
import { Stack } from "expo-router/stack";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, useAuth } from "@/features/auth/auth-provider";
import { Loading, Screen, useColors } from "@/components/ui";
function Root() {
  return (
    <AppThemeProvider>
      <ThemedRoot />
    </AppThemeProvider>
  );
}
export default Sentry.wrap(Root);
function ThemedRoot() {
  const { scheme: colorScheme } = useAppTheme();
  const c = useColors();
  useEffect(() => {
    void setBackgroundColorAsync(c.background);
  }, [c.background]);
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30000, retry: 1 },
          mutations: { retry: false },
        },
      }),
  );
  return (
    <ThemeProvider
      value={{
        ...(colorScheme === "dark" ? DarkTheme : DefaultTheme),
        colors: {
          ...(colorScheme === "dark" ? DarkTheme : DefaultTheme).colors,
          primary: c.accent,
          background: c.background,
          card: c.card,
          text: c.text,
          border: c.border,
        },
      }}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <QueryClientProvider client={client}>
          <AuthProvider>
            <ExamToolsProvider>
              <TrainerToolsProvider>
                <LessonNavigationProvider>
                  <SheetNavigationProvider>
                    <ReviewNavigationProvider>
                      <AttemptBannerInsetProvider>
                        <Navigation />
                      </AttemptBannerInsetProvider>
                    </ReviewNavigationProvider>
                  </SheetNavigationProvider>
                </LessonNavigationProvider>
              </TrainerToolsProvider>
            </ExamToolsProvider>
            <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
          </AuthProvider>
        </QueryClientProvider>
      </GestureHandlerRootView>
    </ThemeProvider>
  );
}
function Navigation() {
  const finishSheetTransition = useSheetTransition();
  const { session, loading } = useAuth();
  const access = useOnboardingAccess();
  const ready = Boolean(session && access.data?.completed && !access.error);
  const c = useColors();
  const attemptBannerStackOptions = useAttemptBannerStackScreenOptions();
  if (loading)
    return (
      <Screen>
        <Loading variant="card" count={3} />
      </Screen>
    );
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      {ready && <AttemptBanner />}
      <Stack
        unstable_nativeProps={{ onFinishTransitioning: finishSheetTransition }}
        screenOptions={{
          headerTransparent: Platform.OS === "ios",
          headerShadowVisible: false,
          headerTintColor: c.text,
          contentStyle: { backgroundColor: c.background },
          headerBackButtonDisplayMode: "minimal",
          ...attemptBannerStackOptions,
        }}
      >
        <Stack.Protected guard={!session}>
          <Stack.Screen name="login" options={{ title: "Welcome to UCAT" }} />
        </Stack.Protected>
        <Stack.Protected guard={Boolean(session) && !ready}>
          <Stack.Screen
            name="onboarding-required"
            options={{
              title: "Finish setting up",
              headerBackVisible: false,
              gestureEnabled: false,
            }}
          />
        </Stack.Protected>
        <Stack.Protected guard={ready}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="settings"
            options={{
              headerShown: false,
              presentation: "formSheet",
              sheetAllowedDetents: [0.5, 1],
              sheetGrabberVisible: true,
            }}
          />
          <Stack.Screen
            name="study-orb"
            options={{
              title: "Your study companion",
              presentation: "formSheet",
              sheetAllowedDetents: [0.5, 1],
              sheetGrabberVisible: true,
            }}
          />
          <Stack.Screen
            name="lesson-navigator"
            options={{
              title: "Lesson parts",
              presentation: "formSheet",
              sheetAllowedDetents: [0.5, 1],
              sheetGrabberVisible: true,
            }}
          />
          <Stack.Screen
            name="exam"
            options={{ title: "Practice", gestureEnabled: false }}
          />
          <Stack.Screen
            name="exam-start"
            options={{
              title: "Your attempt",
              presentation: "formSheet",
              sheetAllowedDetents: [0.5, 1],
              sheetGrabberVisible: true,
            }}
          />
          <Stack.Screen
            name="lesson-start"
            options={{
              title: "Lesson",
              presentation: "formSheet",
              sheetAllowedDetents: [0.5, 1],
              sheetGrabberVisible: true,
            }}
          />
          <Stack.Screen name="lesson/[id]" options={{ title: "Lesson" }} />
          <Stack.Screen
            name="notifications"
            options={{
              title: "Notifications",
              presentation: "formSheet",
              sheetAllowedDetents: [0.5, 1],
              sheetGrabberVisible: true,
              headerLargeTitleEnabled: false,
            }}
          />

          <Stack.Screen name="catalogue" options={{ title: "Exam library" }} />
          <Stack.Screen
            name="set-section"
            options={{ title: "Question sets" }}
          />
          <Stack.Screen
            name="calculator"
            options={{
              title: "",
              headerShown: false,
              presentation: "formSheet",
              sheetAllowedDetents: [0.5, 1],
              sheetGrabberVisible: true,
            }}
          />
          <Stack.Screen
            name="exam-menu"
            options={{
              title: "Attempt",
              presentation: "formSheet",
              sheetAllowedDetents: [0.5],
              sheetGrabberVisible: true,
            }}
          />
          <Stack.Screen
            name="section-progress/[number]"
            options={{ title: "Section progress" }}
          />
          <Stack.Screen name="trainers" options={{ title: "Skill trainers" }} />
          <Stack.Screen
            name="trainer-play"
            options={{ title: "Skill trainer", gestureEnabled: false }}
          />
          <Stack.Screen
            name="trainer-start"
            options={{
              title: "Skill trainer",
              presentation: "formSheet",
              sheetAllowedDetents: [0.5, 1],
              sheetGrabberVisible: true,
            }}
          />
          <Stack.Screen
            name="question-navigator"
            options={{
              title: "Questions",
              presentation: "formSheet",
              sheetAllowedDetents: [0.5, 1],
              sheetGrabberVisible: true,
            }}
          />
          <Stack.Screen
            name="trainer-menu"
            options={{
              title: "Skill trainer",
              presentation: "formSheet",
              sheetAllowedDetents: [0.5],
              sheetGrabberVisible: true,
            }}
          />
          <Stack.Screen name="review" options={{ title: "Attempt results" }} />
          <Stack.Screen
            name="mock-progress"
            options={{ title: "Mock progress" }}
          />
          <Stack.Screen
            name="attempt-question"
            options={{
              title: "Question",
            }}
          />
        </Stack.Protected>
        <Stack.Screen
          name="auth-return"
          options={{ title: "Signing in", headerShown: false }}
        />
      </Stack>
    </View>
  );
}
