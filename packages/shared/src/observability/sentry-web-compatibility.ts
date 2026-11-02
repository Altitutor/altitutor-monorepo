/** Keep the web SDK upgrade on the existing collection and transaction policy.
 * Native initializes an independently versioned SDK and does not use this preset.
 */
export function sentryWebCompatibilityOptions() {
  const privateHeaders = ["forwarded", "-ip", "remote-", "via", "-user"];
  return {
    traceLifecycle: "static" as const,
    attachStacktrace: false,
    dataCollection: {
      userInfo: false,
      cookies: { deny: privateHeaders },
      httpHeaders: {
        request: { deny: privateHeaders },
        response: { deny: privateHeaders },
      },
      httpBodies: [],
      urlQueryParams: { deny: privateHeaders },
      genAI: { inputs: false, outputs: false },
      mcp: { inputs: false, outputs: false },
      databaseQueryData: false,
      queues: false,
      // These retain the resolved 10.78 sendDefaultPii:false baseline.
      graphQL: { document: true, variables: true },
      stackFrameVariables: true,
      frameContextLines: 7,
    },
  };
}
