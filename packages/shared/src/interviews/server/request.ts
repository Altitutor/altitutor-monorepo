function privateResponse(body:unknown,status=200):Response {
  return Response.json(body,{status,headers:{'Cache-Control':'private, no-store, max-age=0'}});
}

/** JSON-only requests prevent cross-site form submissions; stream limits bound allocation. */
export async function readInterviewCommandBody(
  request: Request,
): Promise<{ body: unknown } | { response: Response }> {
  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  ) {
    return {
      response: privateResponse({ error: "JSON request required." }, 415),
    };
  }
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return {
      response: privateResponse(
        { error: "Cross-origin interview commands are not allowed." },
        403,
      ),
    };
  }
  const maximumBytes = 1_048_576;
  if (Number(request.headers.get("content-length")) > maximumBytes) {
    return {
      response: privateResponse(
        { error: "Interview request is too large." },
        413,
      ),
    };
  }
  const reader = request.body?.getReader();
  if (!reader)
    return {
      response: privateResponse({ error: "Invalid interview command." }, 400),
    };
  let size = 0;
  let text = "";
  const decoder = new TextDecoder();
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > maximumBytes) {
        await reader.cancel();
        return {
          response: privateResponse(
            { error: "Interview request is too large." },
            413,
          ),
        };
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    return { body: JSON.parse(text) as unknown };
  } catch {
    return {
      response: privateResponse({ error: "Invalid interview command." }, 400),
    };
  } finally {
    reader.releaseLock();
  }
}
