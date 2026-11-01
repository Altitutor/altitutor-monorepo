import React from "react";
import { act, render, waitFor } from "@testing-library/react";
import { StudentPostHogIdentity, StudentPostHogProvider } from "../posthog-provider";
import { captureStudentEvent, posthog, posthogIdentityHeaders } from "../posthog";
import type { CaptureResult } from "posthog-js";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { AuthProvider } from "@/features/auth/providers";

let authChanged: (event: AuthChangeEvent, session: Session | null) => void;
const auth = {
  getSession: jest.fn(async () => ({ data: { session: null }, error: null })),
  onAuthStateChange: (callback: typeof authChanged) => {
    authChanged = callback;
    return { data: { subscription: { unsubscribe: () => undefined } } };
  },
};
// Keep application auth/context code real; replace only the external auth SDK.
jest.mock("@supabase/ssr", () => ({ createBrowserClient: () => ({ auth }) }));
jest.mock("@sentry/nextjs", () => ({ setUser: jest.fn() }));

jest.mock("next/navigation", () => ({
  usePathname: () => "/register/private-token",
  useSearchParams: () => new URLSearchParams("step=4&email=private"),
}));

beforeEach(() => {
  jest.replaceProperty(process, "env", {
    ...process.env,
    NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: "phc_isolated_browser",
    NEXT_PUBLIC_POSTHOG_HOST: "https://posthog.invalid",
    NEXT_PUBLIC_SUPABASE_URL: "https://auth.invalid",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "isolated-anon-key",
  });
  // Isolate the external transport, retaining the real provider and SDK pipeline.
  jest.spyOn(XMLHttpRequest.prototype, "send").mockImplementation(() => undefined);
  if (posthog.__loaded) posthog.opt_in_capturing();
});

afterEach(() => {
  posthog.opt_out_capturing();
  jest.restoreAllMocks();
});

it("emits a sanitized pageview through the real browser SDK", async () => {
  const events: CaptureResult[] = [];
  const unsubscribe = posthog.on("eventCaptured", (event: CaptureResult) => events.push(event));
  const screen = render(<StudentPostHogProvider><div>Study app</div></StudentPostHogProvider>);
  try {
    await waitFor(() => expect(events).toContainEqual(expect.objectContaining({
      event: "$pageview",
      properties: expect.objectContaining({
        app: "student-web",
        product: "online-learning",
        $current_url: "http://localhost/register/[token]?step=4",
      }),
    })));
    expect(JSON.stringify(events)).not.toContain("private-token");
    expect(JSON.stringify(events)).not.toContain("email=private");
  } finally {
    screen.unmount();
    unsubscribe();
  }
});


it("resets analytics identity after the real auth provider signs out", async () => {
  const events: CaptureResult[] = [];
  const unsubscribe = posthog.on("eventCaptured", (event: CaptureResult) => events.push(event));
  const client = new QueryClient();
  const screen = render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <StudentPostHogProvider><StudentPostHogIdentity /></StudentPostHogProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
  try {
    await waitFor(() => expect(authChanged).toBeDefined());
    const session: Session = {
      access_token: "isolated-access",
      refresh_token: "isolated-refresh",
      expires_in: 3600,
      token_type: "bearer",
      user: {
        id: "student-1",
        app_metadata: {},
        user_metadata: {},
        aud: "authenticated",
        created_at: "2026-01-01T00:00:00Z",
      },
    };
    await act(async () => authChanged("SIGNED_IN", session));
    expect(posthogIdentityHeaders()["X-POSTHOG-DISTINCT-ID"]).toBe("student-1");
    await act(async () => authChanged("SIGNED_OUT", null));
    captureStudentEvent("study_opened");
    expect(posthogIdentityHeaders()["X-POSTHOG-DISTINCT-ID"]).not.toBe("student-1");
    expect(events).toContainEqual(expect.objectContaining({
      event: "$identify",
      properties: expect.objectContaining({ distinct_id: "student-1" }),
      $set: expect.objectContaining({ active_product: "online-learning" }),
    }));
    expect(events).toContainEqual(expect.objectContaining({
      event: "study_opened",
      properties: expect.objectContaining({ distinct_id: expect.not.stringMatching(/^student-1$/) }),
    }));
  } finally {
    screen.unmount();
    client.clear();
    unsubscribe();
  }
});


it("does not emit application events after collection is opted out", async () => {
  const screen = render(<StudentPostHogProvider><div>Study app</div></StudentPostHogProvider>);
  await waitFor(() => expect(posthog.__loaded).toBe(true));
  posthog.opt_out_capturing();
  const events: CaptureResult[] = [];
  const unsubscribe = posthog.on("eventCaptured", (event: CaptureResult) => events.push(event));
  try {
    captureStudentEvent("study_opened");
    expect(events).toEqual([]);
  } finally {
    screen.unmount();
    unsubscribe();
  }
});

it("retains the existing collection boundary for newly supported advertising identifiers", async () => {
  window.history.replaceState({}, "", "/?oppref=partner&bfcid=click");
  document.cookie = "_fbc=fb.1.1770000000000.click; path=/";
  document.cookie = "_fbp=fb.1.1770000000000.123456789; path=/";
  const events: CaptureResult[] = [];
  const unsubscribe = posthog.on("eventCaptured", (event: CaptureResult) => events.push(event));
  const screen = render(<StudentPostHogProvider><div>Study app</div></StudentPostHogProvider>);
  try {
    await waitFor(() => expect(posthog.__loaded).toBe(true));
    posthog.identify("collection-policy-fixture");
    expect(events.some((event) => event.event === "$identify")).toBe(true);
    for (const event of events) {
      for (const properties of [event.properties, event.$set, event.$set_once]) {
        for (const key of ["$fbc", "$fbp", "oppref", "bfcid", "$initial_oppref", "$initial_bfcid"]) {
          expect(properties ?? {}).not.toHaveProperty(key);
        }
      }
    }
  } finally {
    screen.unmount();
    unsubscribe();
    window.history.replaceState({}, "", "/");
    document.cookie = "_fbc=; max-age=0; path=/";
    document.cookie = "_fbp=; max-age=0; path=/";
    posthog.reset();
  }
});
