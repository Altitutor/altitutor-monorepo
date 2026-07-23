import React from "react";
import { render, screen } from "@testing-library/react";
import { LoginPageLayout } from "@/features/auth/components/login-page-layout";

jest.mock("@/features/auth/components/auth-page-header", () => ({
  AuthPageHeader: () => null,
}));

describe("LoginPageLayout", () => {
  it("uses the formal product name and calm return copy", () => {
    render(
      <LoginPageLayout>
        <p>Login form</p>
      </LoginPageLayout>,
    );

    expect(screen.getByText("Altitutor UCAT")).toBeInTheDocument();
    expect(
      screen.getByText("Ready to continue practising? Log in below."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Alti UCAT Prep")).not.toBeInTheDocument();
  });
});
