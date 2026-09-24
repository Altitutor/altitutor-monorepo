import { isDevelopmentPreviewEnvironment } from "../development-preview";

describe("development previews", () => {
  it.each([
    ["development", true],
    ["test", false],
    ["production", false],
    [undefined, false],
  ])("allows only the development environment (%s)", (environment, allowed) => {
    expect(isDevelopmentPreviewEnvironment(environment)).toBe(allowed);
  });
});
