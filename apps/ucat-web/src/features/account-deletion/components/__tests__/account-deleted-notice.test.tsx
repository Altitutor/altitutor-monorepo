import React from "react";
import { render, waitFor } from "@testing-library/react";
import { AccountDeletedNotice } from "@/features/account-deletion/components/account-deleted-notice";

const toast = jest.fn();

jest.mock("@altitutor/ui", () => ({
  useToast: () => ({ toast }),
}));

describe("AccountDeletedNotice", () => {
  beforeEach(() => {
    toast.mockReset();
  });

  it("tells the student their UCAT account was deleted", async () => {
    render(<AccountDeletedNotice />);

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Account deleted",
          description: expect.stringMatching(
            /Altitutor UCAT account has been deleted/i,
          ),
        }),
      );
    });
  });
});
