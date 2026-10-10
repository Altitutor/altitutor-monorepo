import { getSupabaseClient } from "@/shared/lib/supabase/client";
import { useAuthStore } from "@/shared/lib/supabase/auth";
import { authApi } from "../auth";

jest.mock("@/shared/lib/supabase/client", () => ({
  getSupabaseClient: jest.fn(),
}));

const signOut = jest.fn().mockResolvedValue({ error: null });
beforeEach(() => {
  signOut.mockClear();
  jest
    .mocked(getSupabaseClient)
    .mockReturnValue({ auth: { signOut } } as unknown as ReturnType<
      typeof getSupabaseClient
    >);
});

it("API logout preserves connected OAuth clients by ending only this session", async () => {
  await authApi.logout();
  expect(signOut).toHaveBeenCalledWith({ scope: "local" });
});

it("profile-menu logout preserves connected OAuth clients by ending only this session", async () => {
  await useAuthStore.getState().signOut();
  expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  expect(useAuthStore.getState().user).toBeNull();
});
