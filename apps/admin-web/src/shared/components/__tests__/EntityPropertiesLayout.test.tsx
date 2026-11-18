import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EntityPropertiesLayout } from "../EntityPropertiesLayout";

it("reveals the narrow properties drawer when an edit action starts", async () => {
  const originalObserver = globalThis.ResizeObserver;
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  const bounds = jest
    .spyOn(HTMLElement.prototype, "getBoundingClientRect")
    .mockReturnValue({
      x: 0,
      y: 0,
      width: 850,
      height: 900,
      top: 0,
      left: 0,
      right: 850,
      bottom: 900,
      toJSON: () => ({}),
    });
  function Fixture() {
    const [editing, setEditing] = useState(false);
    return (
      <EntityPropertiesLayout
        id="person-properties"
        editing={editing}
        sidebar={
          <label>
            First name
            <input />
          </label>
        }
      >
        <button onClick={() => setEditing(true)}>Edit person</button>
      </EntityPropertiesLayout>
    );
  }
  try {
    render(<Fixture />);
    expect(
      screen.queryByRole("dialog", { name: "Right sidebar" }),
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Edit person" }));
    expect(
      await screen.findByRole("dialog", { name: "Right sidebar" }),
    ).toBeVisible();
    expect(screen.getByRole("textbox", { name: "First name" })).toBeVisible();
  } finally {
    bounds.mockRestore();
    globalThis.ResizeObserver = originalObserver;
  }
});
