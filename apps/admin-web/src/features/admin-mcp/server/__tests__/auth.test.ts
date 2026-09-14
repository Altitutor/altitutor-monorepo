/** @jest-environment node */
import { createClient } from "@supabase/supabase-js";
import { verifyAdminMcpToken } from "../auth";

jest.mock("@supabase/supabase-js", () => ({ createClient: jest.fn() }));
const getUser = jest.fn();
const rpc = jest.fn();
function token(claims: Record<string, unknown>) {
  return `header.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.signature`;
}
const claims = {
  sub: "actor",
  client_id: "client",
  iss: "https://db.example.test/auth/v1",
  aud: "authenticated",
};
beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://db.example.test";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "public-key";
  jest
    .mocked(createClient)
    .mockReturnValue({ auth: { getUser }, rpc } as unknown as ReturnType<
      typeof createClient
    >);
  getUser.mockResolvedValue({ data: { user: { id: "actor" } }, error: null });
  rpc.mockResolvedValue({ data: true, error: null });
});
it("requires provider-verified identity as well as token claims", async () => {
  getUser.mockResolvedValue({
    data: { user: null },
    error: new Error("Invalid signature"),
  });
  expect(
    await verifyAdminMcpToken(new Request("https://admin.test"), token(claims)),
  ).toBeUndefined();
});
it("checks live admin/client authority again after revocation", async () => {
  expect(
    await verifyAdminMcpToken(new Request("https://admin.test"), token(claims)),
  ).toMatchObject({ clientId: "client" });
  rpc.mockResolvedValue({ data: false, error: null });
  expect(
    await verifyAdminMcpToken(new Request("https://admin.test"), token(claims)),
  ).toBeUndefined();
});
it.each([
  { ...claims, iss: "https://other.test/auth/v1" },
  { ...claims, client_id: undefined },
  { ...claims, aud: "service_role" },
])("rejects a token outside the expected OAuth context", async (value) => {
  expect(
    await verifyAdminMcpToken(new Request("https://admin.test"), token(value)),
  ).toBeUndefined();
});
