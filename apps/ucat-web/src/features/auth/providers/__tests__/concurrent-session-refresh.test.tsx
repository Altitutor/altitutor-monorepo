import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@altitutor/shared";
import { AuthProvider, useAuth } from "@/features/auth/providers/auth-provider";
import { useOnboardingProgress } from "@/features/onboarding/hooks/use-onboarding-progress";
import { useUcatAccess } from "@/features/ucat-access/hooks/use-ucat-access";
import { useStudentUcatSessions } from "@/features/sessions/hooks/use-sessions";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { recoverTransientBrowserSession } from "@/lib/supabase/recover-transient-session";

jest.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: jest.fn(),
}));
jest.mock("@sentry/nextjs", () => ({ setUser: jest.fn() }));

const mockedGetClient = jest.mocked(getSupabaseBrowserClient);
const VIEWS = [
  "vstudent_profile",
  "vstudent_ucat_my_access",
  "vstudent_sessions",
] as const;
type View = (typeof VIEWS)[number];

function jwt(role: "anon" | "authenticated", exp: number) {
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ role, exp, sub: "student-1" })}.test`;
}

function reply(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Unauthorized",
    headers: { get: () => "application/json" },
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function Probe() {
  const { user } = useAuth();
  const onboarding = useOnboardingProgress();
  const access = useUcatAccess();
  const sessions = useStudentUcatSessions();
  return (
    <output data-testid="state">
      {JSON.stringify({
        authUser: Boolean(user),
        onboardingError: onboarding.isError,
        accessError: access.accessLoadFailed,
        sessionsError: sessions.isError,
      })}
    </output>
  );
}

describe("concurrent server cookie refresh", () => {
  afterEach(() => {
    document.cookie.split(";").forEach((cookie) => {
      const name = cookie.split("=")[0].trim();
      if (name.startsWith("student-auth")) {
        document.cookie = `${name}=; Max-Age=0; Path=/`;
      }
    });
    jest.restoreAllMocks();
    mockedGetClient.mockReset();
  });

  it.each([
    ["replaced", "authenticated", false],
    ["cleared", "anon", true],
    ["temporarily-cleared", "authenticated", false],
  ] as const)(
    "handles a %s cookie during refresh without using stale credentials",
    async (cookieChange, expectedRole, expectedErrors) => {
      jest.spyOn(console, "error").mockImplementation(() => {});
      const cookieName = `student-auth-${cookieChange}`;
      let now = Date.now();
      jest.spyOn(Date, "now").mockImplementation(() => now);
      const anonKey = jwt("anon", Math.floor(now / 1000) + 86400);
      const accessToken = jwt("authenticated", Math.floor(now / 1000) + 3600);
      const viewCalls: Array<{ view: View; role: string }> = [];
      let changeCookieDuringTokenFetch = false;
      let refreshCalls = 0;
      const fakeFetch: typeof fetch = async (input, init) => {
        const requestUrl =
          typeof input === "string" || input instanceof URL
            ? String(input)
            : input.url;
        const url = new URL(requestUrl);
        if (url.pathname === "/auth/v1/user") {
          return reply({
            id: "student-1",
            aud: "authenticated",
            role: "authenticated",
          });
        }
        if (url.pathname === "/auth/v1/token") {
          refreshCalls += 1;
          if (changeCookieDuringTokenFetch && cookieChange === "replaced") {
            const serverSession = {
              access_token: jwt("authenticated", Math.floor(now / 1000) + 3600),
              refresh_token: "server-refreshed",
              token_type: "bearer",
              expires_in: 3600,
              expires_at: Math.floor(now / 1000) + 3600,
              user: {
                id: "student-1",
                aud: "authenticated",
                role: "authenticated",
              },
            };
            document.cookie = `${cookieName}=base64-${Buffer.from(JSON.stringify(serverSession)).toString("base64url")}; Path=/`;
          } else if (changeCookieDuringTokenFetch) {
            document.cookie = `${cookieName}=; Max-Age=0; Path=/`;
          }
          return reply({
            access_token: jwt("authenticated", Math.floor(now / 1000) + 3600),
            refresh_token: "browser-refreshed",
            token_type: "bearer",
            expires_in: 3600,
            user: {
              id: "student-1",
              aud: "authenticated",
              role: "authenticated",
            },
          });
        }
        const view = VIEWS.find((candidate) =>
          url.pathname.endsWith(`/${candidate}`),
        );
        if (view) {
          const headers = init?.headers;
          const authorization =
            headers && typeof (headers as Headers).get === "function"
              ? (headers as Headers).get("authorization")
              : Object.entries(headers ?? {}).find(
                  ([name]) => name.toLowerCase() === "authorization",
                )?.[1];
          const token = authorization?.replace(/^Bearer /i, "") ?? "";
          let role = "missing";
          try {
            role = JSON.parse(
              Buffer.from(token.split(".")[1], "base64url").toString("utf8"),
            ).role;
          } catch {}
          viewCalls.push({ view, role });
          if (role === "anon") {
            return reply(
              { code: "42501", message: `permission denied for view ${view}` },
              401,
            );
          }
          return reply(
            view === "vstudent_sessions"
              ? []
              : view === "vstudent_profile"
                ? { onboarding_progress: null }
                : null,
          );
        }
        throw new Error(`Unexpected test request: ${url.pathname}`);
      };
      const client = recoverTransientBrowserSession(
        createBrowserClient<Database>("https://test.supabase.co", anonKey, {
          isSingleton: false,
          cookieOptions: { name: cookieName },
          auth: { detectSessionInUrl: false, autoRefreshToken: false },
          global: { fetch: fakeFetch },
        }) as SupabaseClient<Database>,
      );
      mockedGetClient.mockReturnValue(client);
      const signIn = await client.auth.setSession({
        access_token: accessToken,
        refresh_token: "refresh-1",
      });
      expect(signIn.error).toBeNull();
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      const app = (showProbe: boolean) => (
        <QueryClientProvider client={queryClient}>
          <AuthProvider>{showProbe ? <Probe /> : null}</AuthProvider>
        </QueryClientProvider>
      );
      const { rerender } = render(app(true));
      const healthy = {
        authUser: true,
        onboardingError: false,
        accessError: false,
        sessionsError: false,
      };
      await waitFor(() =>
        expect(
          JSON.parse(screen.getByTestId("state").textContent ?? ""),
        ).toEqual(healthy),
      );
      rerender(app(false));
      queryClient.clear();
      now += 2 * 3600_000;
      if (cookieChange === "temporarily-cleared") {
        document.cookie.split(";").forEach((cookie) => {
          const name = cookie.split("=")[0].trim();
          if (name.startsWith(cookieName)) {
            document.cookie = `${name}=; Max-Age=0; Path=/`;
          }
        });
        setTimeout(() => {
          const serverSession = {
            access_token: jwt("authenticated", Math.floor(now / 1000) + 3600),
            refresh_token: "server-refreshed",
            token_type: "bearer",
            expires_in: 3600,
            expires_at: Math.floor(now / 1000) + 3600,
            user: {
              id: "student-1",
              aud: "authenticated",
              role: "authenticated",
            },
          };
          document.cookie = `${cookieName}=base64-${Buffer.from(JSON.stringify(serverSession)).toString("base64url")}; Path=/`;
        }, 120);
      } else {
        changeCookieDuringTokenFetch = true;
      }
      rerender(app(true));
      await waitFor(() => expect(viewCalls.length).toBeGreaterThanOrEqual(6), {
        timeout: 5000,
      });
      expect(refreshCalls).toBe(cookieChange === "temporarily-cleared" ? 0 : 1);
      expect(viewCalls.slice(-3).map(({ view }) => view).sort()).toEqual(
        [...VIEWS].sort(),
      );
      expect(viewCalls.slice(-3).map(({ role }) => role)).toEqual([
        expectedRole,
        expectedRole,
        expectedRole,
      ]);
      expect(Boolean((await client.auth.getSession()).data.session)).toBe(
        !expectedErrors,
      );
      await waitFor(() =>
        expect(
          JSON.parse(screen.getByTestId("state").textContent ?? ""),
        ).toEqual({
          authUser: true,
          onboardingError: expectedErrors,
          accessError: expectedErrors,
          sessionsError: expectedErrors,
        }),
      );
    },
  );
});
