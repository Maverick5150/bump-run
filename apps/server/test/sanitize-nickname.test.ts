import { describe, expect, it } from "vitest";
import { sanitizeNickname } from "../src/socket/schemas.js";

describe("sanitizeNickname", () => {
  it("trims whitespace", () => {
    expect(sanitizeNickname("  Ricky  ")).toBe("Ricky");
  });

  it("strips HTML markup", () => {
    expect(sanitizeNickname("<b>Ricky</b>")).toBe("Ricky");
    expect(sanitizeNickname("<script>alert(1)</script>Ricky")).toBe("alert(1)Ricky");
  });

  it("strips control characters", () => {
    const withBell = "Ricky" + String.fromCharCode(7);
    expect(sanitizeNickname(withBell)).toBe("Ricky");
  });

  it("collapses internal whitespace runs", () => {
    expect(sanitizeNickname("Ricky   Bobby")).toBe("Ricky Bobby");
  });

  it("clips to 16 characters", () => {
    expect(sanitizeNickname("A".repeat(50))).toBe("A".repeat(16));
  });

  it("returns null for a blank or whitespace-only nickname", () => {
    expect(sanitizeNickname("")).toBeNull();
    expect(sanitizeNickname("   ")).toBeNull();
  });
});
