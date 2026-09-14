/** @jest-environment node */
import { createAdminMcpHttpHandler } from "../http-handler";

async function payload(response: Response) {
  const text = await response.text();
  const line = text.split("\n").find((value) => value.startsWith("data: "));
  return JSON.parse(line ? line.slice(6) : text) as {
    result?: { tools?: Array<{ name: string }> };
  };
}
function request() {
  return new Request("https://admin.example.test/api/mcp", {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      authorization: "Bearer test",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
      params: {},
    }),
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
