import { describe, expect, it } from "vitest";
import { isTransferMode, normalizeTransferMode } from "./transferMode";

describe("transfer mode", () => {
  it("accepts only the explicit private and public modes", () => {
    expect(isTransferMode("private")).toBe(true);
    expect(isTransferMode("public")).toBe(true);
    expect(isTransferMode("automatic")).toBe(false);
    expect(isTransferMode(undefined)).toBe(false);
  });

  it("defaults legacy or missing values to private", () => {
    expect(normalizeTransferMode("private")).toBe("private");
    expect(normalizeTransferMode("public")).toBe("public");
    expect(normalizeTransferMode("legacy")).toBe("private");
    expect(normalizeTransferMode(null)).toBe("private");
  });
});
