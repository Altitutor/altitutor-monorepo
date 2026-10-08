function waitForGatewayRecovery(signal: AbortSignal | null | undefined) {
  return new Promise<void>((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(signal?.reason ?? new DOMException("Aborted", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, 500);
    if (signal?.aborted) {
      abort();
      return;
    }
    signal?.addEventListener("abort", abort, { once: true });
  });
}

/** Recover one gateway interruption for server REST reads; never replay RPCs or writes. */
export function createGatewayReadFetch(
  supabaseUrl: string,
  fetcher: typeof fetch = fetch,
): typeof fetch {
  const origin = new URL(supabaseUrl).origin;
  return async (input, init) => {
    const request = input instanceof Request ? input : null;
    const signal = init?.signal === undefined ? request?.signal : init.signal;
    signal?.throwIfAborted();
    const response = await fetcher(input, init);
    if (response.status !== 502) return response;

    const method = (init?.method ?? request?.method ?? "GET").toUpperCase();
    const url = new URL(request?.url ?? String(input));
    if (
      method !== "GET" ||
      url.origin !== origin ||
      !/^\/rest\/v1\/[^/]+\/?$/.test(url.pathname) ||
      /^\/rest\/v1\/rpc\/?$/.test(url.pathname)
    ) {
      return response;
    }

    // Next can retain a response clone; cancellation of one tee branch may never settle.
    // Cleanup must not block the retry delay or swallow its abort signal.
    if (response.body && !response.body.locked) {
      void response.body.cancel().catch(() => {});
    }
    await waitForGatewayRecovery(signal);
    return fetcher(input, init);
  };
}
