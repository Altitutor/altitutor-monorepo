/** @jest-environment jsdom */

import React from "react";
import { render } from "@testing-library/react";
import { useAuthSessionRecovery } from "./useAuthSessionRecovery";

function RecoveryHarness({
  enabled = true,
  isLoading,
  hasSession,
  recover,
}: {
  enabled?: boolean;
  isLoading: boolean;
  hasSession: boolean;
  recover: () => void;
}) {
  useAuthSessionRecovery({ enabled, isLoading, hasSession, recover });
  return null;
}

describe("useAuthSessionRecovery", () => {
  it("does not recover for disabled, loading, or authenticated boundaries", () => {
    const recover = jest.fn();
    const view = render(
      <RecoveryHarness
        enabled={false}
        isLoading={false}
        hasSession={false}
        recover={recover}
      />,
    );

    view.rerender(
      <RecoveryHarness
        isLoading
        hasSession={false}
        recover={recover}
      />,
    );
    view.rerender(
      <RecoveryHarness
        isLoading={false}
        hasSession
        recover={recover}
      />,
    );

    expect(recover).not.toHaveBeenCalled();
  });

  it("performs at most one recovery for a missing protected session", () => {
    const recover = jest.fn();
    const view = render(
      <RecoveryHarness
        isLoading={false}
        hasSession={false}
        recover={recover}
      />,
    );

    for (let index = 0; index < 150; index += 1) {
      view.rerender(
        <RecoveryHarness
          isLoading={false}
          hasSession={false}
          recover={recover}
        />,
      );
    }

    expect(recover).toHaveBeenCalledTimes(1);
  });
});
