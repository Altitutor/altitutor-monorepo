/** Keep authoring payloads within the SDK's 4 MiB transport budget. */
export const MCP_MAX_REQUEST_BYTES = 4 * 1024 * 1024;

function requestError(status: number, code: number, message: string) {
  return Response.json(
    { jsonrpc: "2.0", error: { code, message }, id: null },
    { status },
  );
}

/** Bound uploads before mcp-handler 1.x eagerly parses them, retaining verified auth. */
export function withMcpRequestBodyLimit<Auth>(
  handler: (request: Request & { auth?: Auth }) => Response | Promise<Response>,
) {
  return async (request: Request & { auth?: Auth }): Promise<Response> => {
    if (request.method !== "POST") return handler(request);
    const mediaType = request.headers
      .get("content-type")
      ?.split(";")[0]
      .trim()
      .toLowerCase();
    if (mediaType !== "application/json") {
      return requestError(
        415,
        -32000,
        "Content-Type must be application/json.",
      );
    }

    const reader = request.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MCP_MAX_REQUEST_BYTES) {
          await reader.cancel();
          return requestError(
            413,
            -32000,
            "Request body exceeds the 4 MiB limit.",
          );
        }
        chunks.push(value);
      }
    } finally {
      reader?.releaseLock();
    }

    const body = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    // The v1 adapter parses JSON in an async listener whose rejection is not returned.
    // Validate this bounded body before invoking it, so malformed JSON returns 400.
    try {
      JSON.parse(new TextDecoder().decode(body));
    } catch {
      return requestError(400, -32700, "Parse error: Invalid JSON");
    }
    const boundedRequest = Object.assign(new Request(request, { body }), {
      auth: request.auth,
    });
    return handler(boundedRequest);
  };
}
