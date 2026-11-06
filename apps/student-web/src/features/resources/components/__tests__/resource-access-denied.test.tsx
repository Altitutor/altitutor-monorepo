import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { ResourceAccessDenied } from "../resource-access-denied";

Object.assign(globalThis, { React });

it("distinguishes pending and failed access checks from a denial", () => {
  const refetch = jest.fn();
  const { rerender } = render(
    <ResourceAccessDenied accessCheck={{ status: "pending", isFetching: false, refetch }} />,
  );

  expect(screen.getByRole("status")).toHaveTextContent("Checking resource access");
  expect(screen.queryByRole("heading", { name: "Access Required" })).toBeNull();

  rerender(<ResourceAccessDenied accessCheck={{ status: "error", isFetching: false, refetch }} />);
  expect(screen.getByRole("heading", { name: "Could not check resource access" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(refetch).toHaveBeenCalledTimes(1);

  rerender(<ResourceAccessDenied accessCheck={{ status: "success", isFetching: false, refetch }} />);
  expect(screen.getByRole("heading", { name: "Access Required" })).toBeVisible();
});
