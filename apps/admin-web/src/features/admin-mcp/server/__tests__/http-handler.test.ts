/** @jest-environment node */
import { createAdminMcpHttpHandler } from "../http-handler";

async function payload(response: Response) {
  const text = await response.text();
  const line = text.split("\n").find((value) => value.startsWith("data: "));
  return JSON.parse(line ? line.slice(6) : text) as {
    result?: { tools?: Array<{ name: string }>; isError?: boolean };
  };
}
function request(
  body: unknown = { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} },
) {
  return new Request("https://admin.example.test/api/mcp", {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      authorization: "Bearer test",
    },
    body: JSON.stringify(body),
  });
}
describe("admin MCP public HTTP interface", () => {
  beforeAll(() => jest.useFakeTimers());
  afterAll(() => jest.useRealTimers());
  it("rejects a connection without current admin authority and client consent", async () => {
    const response = await createAdminMcpHttpHandler(async () => undefined)(
      request(),
    );
    expect(response.status).toBe(401);
  });
  it("rejects more than 100 messages before dispatching a JSON-RPC batch", async () => {
    const handler = createAdminMcpHttpHandler(async () => ({
      token: "test",
      clientId: "test",
      scopes: ["admin:read", "admin:operations"],
    }));
    const response = await handler(
      request(
        Array.from({ length: 101 }, (_, id) => ({
          jsonrpc: "2.0",
          id,
          method: "ping",
        })),
      ),
    );
    expect(response.status).toBe(400);
  });
  it("stops an oversized streamed body before buffering the complete upload", async () => {
    let chunksSent = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        const prefix =
          chunksSent === 0
            ? '{"jsonrpc":"2.0","id":1,"method":"ping","padding":"'
            : "";
        chunksSent += 1;
        const suffix = chunksSent === 8 ? '"}' : "";
        controller.enqueue(
          new TextEncoder().encode(prefix + "x".repeat(1024 * 1024) + suffix),
        );
        if (chunksSent === 8) controller.close();
      },
    });
    const init: RequestInit & { duplex: "half" } = {
      method: "POST",
      body,
      duplex: "half",
      headers: {
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
        authorization: "Bearer test",
      },
    };
    const response = await createAdminMcpHttpHandler(async () => ({
      token: "test",
      clientId: "test",
      scopes: ["admin:read", "admin:operations"],
    }))(new Request("https://admin.example.test/api/mcp", init));
    expect(response.status).toBe(413);
    expect(chunksSent).toBeLessThan(8);
  });
  it("rejects excessive tool argument elements before schema validation", async () => {
    const response = await createAdminMcpHttpHandler(async () => ({
      token: "test",
      clientId: "test",
      scopes: ["admin:read", "admin:operations"],
    }))(
      request({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "discover_admin_data",
          arguments: { surplus: Array(100_001).fill(null) },
        },
      }),
    );
    expect(response.status).toBe(200);
    expect((await payload(response)).result?.isError).toBe(true);
  });
  it("initializes and calls a read-only tool with verified request authority", async () => {
    const handler = createAdminMcpHttpHandler(async () => ({
      token: "test",
      clientId: "test",
      scopes: ["admin:read", "admin:operations"],
    }));
    const initialized = await handler(
      request({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-11-25",
          capabilities: {},
          clientInfo: { name: "compatibility-check", version: "1" },
        },
      }),
    );
    expect(initialized.status).toBe(200);
    expect(await payload(initialized)).toMatchObject({
      result: { serverInfo: { name: "altitutor-admin" } },
    });
    const response = await handler(
      request({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "discover_admin_data",
          arguments: {},
        },
      }),
    );
    expect(response.status).toBe(200);
    expect(await payload(response)).toMatchObject({
      result: { structuredContent: { result: expect.anything() } },
    });
  });
  it("returns a parse error for malformed JSON and rejects an invalid media type", async () => {
    const handler = createAdminMcpHttpHandler(async () => ({
      token: "test",
      clientId: "test",
      scopes: ["admin:read", "admin:operations"],
    }));
    const malformed = await handler(
      new Request("https://admin.example.test/api/mcp", {
        method: "POST",
        headers: request().headers,
        body: '{"unfinished":',
      }),
    );
    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toMatchObject({ error: { code: -32700 } });
    const invalidType = new Request(request());
    invalidType.headers.set("content-type", "application/jsonp");
    expect((await handler(invalidType)).status).toBe(415);
  });
  it("requires both response formats and retains stateless GET behavior", async () => {
    const handler = createAdminMcpHttpHandler(async () => ({
      token: "test",
      clientId: "test",
      scopes: ["admin:read", "admin:operations"],
    }));
    const jsonOnly = request();
    jsonOnly.headers.set("accept", "application/json");
    expect((await handler(jsonOnly)).status).toBe(406);
    const get = await handler(
      new Request("https://admin.example.test/api/mcp", {
        headers: { authorization: "Bearer test", accept: "text/event-stream" },
      }),
    );
    expect(get.status).toBe(405);
  });
  it("exposes flexible discovery and operations, without scheduling or payment actions", async () => {
    const response = await createAdminMcpHttpHandler(async () => ({
      token: "test",
      clientId: "test",
      scopes: ["admin:read", "admin:operations"],
    }))(request());
    expect(response.status).toBe(200);
    const names = (await payload(response)).result?.tools?.map(
      (tool) => tool.name,
    );
    expect(names).toEqual(
      expect.arrayContaining([
        "discover_admin_data",
        "query_admin_reporting",
        "get_admin_entity",
        "create_admin_project",
        "change_admin_task",
        "change_admin_document",
      ]),
    );
    expect(names?.some((name) => /send|charge|schedule/.test(name))).toBe(
      false,
    );
  });
});
