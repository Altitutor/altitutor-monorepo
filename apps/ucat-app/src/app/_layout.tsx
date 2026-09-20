import { LessonNavigationProvider } from "@/features/learning/lesson-navigation";
import { TrainerToolsProvider } from "@/features/skill-trainer/components/trainer-tools";
import { Platform, View } from "react-native";
import { AttemptBanner } from "@/features/practice/components/attempt-banner";
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
export default function Root() {
  return (
    <AppThemeProvider>
      <ThemedRoot />
    </AppThemeProvider>
  );
}
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
      <QueryClientProvider client={client}>
        <AuthProvider>
          <ExamToolsProvider>
            <TrainerToolsProvider>
              <LessonNavigationProvider>
                <Navigation />
              </LessonNavigationProvider>
            </TrainerToolsProvider>
          </ExamToolsProvider>
          <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
function Navigation() {
  const { session, loading } = useAuth();
  const c = useColors();
  if (loading)
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      {session && <AttemptBanner />}
      <Stack
        screenOptions={{
          headerTransparent: Platform.OS === "ios",
          headerShadowVisible: false,
          headerTintColor: c.text,
          contentStyle: { backgroundColor: c.background },
          headerBackButtonDisplayMode: "minimal",
        }}
      >
        <Stack.Protected guard={!session}>
          <Stack.Screen name="login" options={{ title: "Welcome to UCAT" }} />
        </Stack.Protected>
        <Stack.Protected guard={Boolean(session)}>
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
          <Stack.Screen name="lesson/[id]" options={{ title: "Lesson" }} />
          <Stack.Screen
            name="notifications"
            options={{
              title: "Notifications",
              presentation: "formSheet",
              sheetAllowedDetents: [0.5, 1],
              sheetGrabberVisible: true,
            }}
          />
          <Stack.Screen name="study-plan" options={{ title: "Study plan" }} />
          <Stack.Screen name="catalogue" options={{ title: "Exam library" }} />
          <Stack.Screen
            name="calculator"
            options={{
              title: "Calculator",
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
          <Stack.Screen name="review" options={{ title: "Review" }} />
        </Stack.Protected>
      </Stack>
    </View>
  );
}
