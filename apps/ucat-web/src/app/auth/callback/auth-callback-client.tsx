"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { agentDebugLog, probeAuthCookies } from "@/lib/agent-debug-log";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { parseEmailOtpType, safeNextPath } from "./auth-callback-utils";

/**
 * PKCE magic links store the code verifier in the browser client's cookie storage.
 * Exchanging on the server (Route Handler + next/headers cookies) often cannot read
 * the same verifier chunks as document.cookie, which yields "code verifier should be non-empty".
 * Completing the exchange here uses the same @supabase/ssr browser client as signInWithOtp.
 */
function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Completing sign-in…");

  useEffect(() => {
    const code = searchParams.get("code");
    const tokenHash = searchParams.get("token_hash");
    const typeParam = searchParams.get("type");
    const next = safeNextPath(searchParams.get("next"));

    const finish = (errorMessage: string) => {
      setMessage(errorMessage);
      router.replace(`/signup?error=${encodeURIComponent(errorMessage)}`);
    };

    const supabase = getSupabaseBrowserClient();

    void (async () => {
      agentDebugLog({
        hypothesisId: "H1-H3-H5",
        location: "auth-callback-client.tsx:effect_start",
        message: "callback mount; URL vs searchParams vs cookies",
        data: {
          hasCodeParam: Boolean(code),
          codeLen: code?.length ?? 0,
          hasTokenHash: Boolean(tokenHash),
          typeParam: typeParam ?? "",
          hrefHasCodeQuery:
            typeof window !== "undefined" && window.location.search.includes("code="),
          hrefSearchLen:
            typeof window !== "undefined" ? window.location.search.length : -1,
          next,
          ...probeAuthCookies(),
        },
      });

      const otpType = parseEmailOtpType(typeParam);
      if (tokenHash && otpType) {
        const { error } = await supabase.auth.verifyOtp({
          type: otpType,
          token_hash: tokenHash,
        });
        if (error) {
          finish(error.message);
          return;
        }
        router.replace(next);
        return;
      }

      if (code) {
        agentDebugLog({
          hypothesisId: "H4",
          location: "auth-callback-client.tsx:before_exchange",
          message: "about to exchangeCodeForSession",
          data: { ...probeAuthCookies() },
        });
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          agentDebugLog({
            hypothesisId: "H1-H4",
            location: "auth-callback-client.tsx:exchange_error",
            message: "exchangeCodeForSession returned error",
            data: {
              errMsgLen: error.message.length,
              errStatus: error.status ?? null,
              errName: error.name,
              ...probeAuthCookies(),
            },
          });
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData.session) {
            agentDebugLog({
              hypothesisId: "H4",
              location: "auth-callback-client.tsx:exchange_error_but_session",
              message: "session exists after exchange error; redirecting",
              data: {},
            });
            router.replace(next);
            return;
          }
          if (process.env.NODE_ENV !== "production") {
            // eslint-disable-next-line no-console
            console.error("[auth/callback] exchangeCodeForSession:", error);
          }
          finish(error.message);
          return;
        }
        agentDebugLog({
          hypothesisId: "H4",
          location: "auth-callback-client.tsx:exchange_ok",
          message: "exchangeCodeForSession succeeded",
          data: { ...probeAuthCookies() },
        });
        router.replace(next);
        return;
      }

      finish("auth_failed");
    })();
  }, [router, searchParams]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-marketing-charcoal px-4 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

export function AuthCallbackClient() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-marketing-charcoal px-4 text-sm text-muted-foreground">
          Completing sign-in…
        </div>
      }
    >
      <AuthCallbackInner />
    </Suspense>
  );
}
