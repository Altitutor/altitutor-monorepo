import { act, renderHook } from "@testing-library/react";
import { useOpenPersonMessages } from "../useOpenPersonMessages";

const mockOpenTab = jest.fn();
const mockToast = jest.fn();
const mockEnsureStudent = jest.fn();
const mockEnsureParent = jest.fn();
const mockEnsureStaff = jest.fn();
jest.mock("@altitutor/ui", () => ({ useToast: () => ({ toast: mockToast }) }));
jest.mock("@/shared/contexts/AccessoryPanelContext", () => ({
  useAccessoryPanelActions: () => ({ openTab: mockOpenTab }),
}));
jest.mock("../../utils/contactHelpers", () => ({
  ensureContactForStudent: (...args: unknown[]) => mockEnsureStudent(...args),
  ensureContactForParent: (...args: unknown[]) => mockEnsureParent(...args),
  ensureContactForStaff: (...args: unknown[]) => mockEnsureStaff(...args),
}));
beforeEach(() => {
  jest.clearAllMocks();
});

it.each(["student", "parent", "staff"] as const)(
  "opens a %s contact in a conversation tab",
  async (type) => {
    const ensure = {
      student: mockEnsureStudent,
      parent: mockEnsureParent,
      staff: mockEnsureStaff,
    }[type];
    ensure.mockResolvedValue("contact-1");
    const { result } = renderHook(() =>
      useOpenPersonMessages(type, "person-1", "Test Person"),
    );
    await act(async () => {
      await result.current.openMessages();
    });
    expect(ensure).toHaveBeenCalledWith("person-1", { allowEmail: true });
    expect(mockOpenTab).toHaveBeenCalledWith({
      kind: "messages",
      id: "contact-1",
      title: "Test Person",
      query: "contact=contact-1",
    });
  },
);

it("explains when there is no messaging address", async () => {
  mockEnsureStudent.mockResolvedValue(null);
  const { result } = renderHook(() =>
    useOpenPersonMessages("student", "person-1"),
  );
  await act(async () => {
    await result.current.openMessages();
  });
  expect(mockOpenTab).not.toHaveBeenCalled();
  expect(mockToast).toHaveBeenCalledWith(
    expect.objectContaining({ variant: "destructive" }),
  );
});
