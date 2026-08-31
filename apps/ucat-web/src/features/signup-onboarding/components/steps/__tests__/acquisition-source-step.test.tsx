import React, { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { UcatAcquisitionSource } from "@altitutor/shared";
import { SignupCompleteAcquisitionSourceStep } from "@/features/signup-onboarding/components/steps/acquisition-source-step";

function Harness({ onComplete = jest.fn() }: { onComplete?: jest.Mock }) {
  const [sources, setSources] = useState<UcatAcquisitionSource[]>([]);
  const [other, setOther] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <SignupCompleteAcquisitionSourceStep
      selectedSources={sources}
      otherSource={other}
      onSelectedSourcesChange={setSources}
      onOtherSourceChange={setOther}
      onComplete={onComplete}
      error={error}
      setError={setError}
    />
  );
}

describe("SignupCompleteAcquisitionSourceStep", () => {
  it("requires at least one source", () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Select at least one option to continue.",
    );
  });

  it("supports multiple sources", async () => {
    const onComplete = jest.fn().mockResolvedValue(undefined);
    render(<Harness onComplete={onComplete} />);

    fireEvent.click(screen.getByRole("checkbox", { name: "Reddit" }));
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Friend or classmate" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("checkbox", { name: "Reddit" })).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Friend or classmate" }),
    ).toBeChecked();
  });

  it("keeps not sure mutually exclusive", () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole("checkbox", { name: "Reddit" }));
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "I’m not sure / prefer not to say",
      }),
    );

    expect(screen.getByRole("checkbox", { name: "Reddit" })).not.toBeChecked();
    expect(
      screen.getByRole("checkbox", {
        name: "I’m not sure / prefer not to say",
      }),
    ).toBeChecked();
  });
});
