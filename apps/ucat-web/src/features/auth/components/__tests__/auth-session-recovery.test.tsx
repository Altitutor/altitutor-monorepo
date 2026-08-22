import React from "react";
import { render } from "@testing-library/react";
import { AuthSessionRecovery } from "@/features/auth/components/auth-session-recovery";

describe("AuthSessionRecovery", () => {
  it("does not recover while auth is loading or a user exists", () => {
    const recover = jest.fn();
    const view = render(
      <AuthSessionRecovery
        isLoading
        hasUser={false}
        recover={recover}
      />,
    );

    view.rerender(
      <AuthSessionRecovery
        isLoading={false}
        hasUser
        recover={recover}
      />,
    );

    expect(recover).not.toHaveBeenCalled();
  });

  it("performs at most one hard recovery for a missing session", () => {
    const recover = jest.fn();
    const view = render(
      <AuthSessionRecovery
        isLoading={false}
        hasUser={false}
        recover={recover}
      />,
    );

    for (let index = 0; index < 150; index += 1) {
      view.rerender(
        <AuthSessionRecovery
          isLoading={false}
          hasUser={false}
          recover={recover}
        />,
      );
    }

    expect(recover).toHaveBeenCalledTimes(1);
  });
});
