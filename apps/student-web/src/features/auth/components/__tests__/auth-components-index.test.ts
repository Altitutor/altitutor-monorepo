import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("auth component exports", () => {
  it("does not re-export the eager payment component through non-payment auth imports", () => {
    const authIndex = readFileSync(join(__dirname, "..", "index.ts"), "utf8");

    expect(authIndex).not.toContain("from './AddCardSheet'");
  });
});
