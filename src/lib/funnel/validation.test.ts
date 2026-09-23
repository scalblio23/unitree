import { describe, expect, it } from "vitest";
import { isValidAustralianMobile, isValidEmail, normaliseMobile } from "./validation";

describe("email", () => {
  it.each(["sam@example.com", "sam.taylor+tag@mail.co.uk", " sam@example.com "])(
    "accepts %s",
    (value) => {
      expect(isValidEmail(value)).toBe(true);
    },
  );

  it.each(["", "sam", "sam@example", "sam at example.com", "sam@.com", "sam@example.c"])(
    "rejects %s",
    (value) => {
      expect(isValidEmail(value)).toBe(false);
    },
  );
});

describe("mobile normalisation", () => {
  it("strips formatting characters", () => {
    expect(normaliseMobile("0412 345 678")).toBe("0412345678");
    expect(normaliseMobile("(04) 1234-5678")).toBe("0412345678");
  });

  it("rewrites a +61 country code as a leading zero", () => {
    expect(normaliseMobile("+61 412 345 678")).toBe("0412345678");
    expect(normaliseMobile("61412345678")).toBe("0412345678");
  });
});

describe("australian mobiles", () => {
  it.each(["0412345678", "0412 345 678", "+61 412 345 678", "61412345678", "+61412345678"])(
    "accepts %s",
    (value) => {
      expect(isValidAustralianMobile(value)).toBe(true);
    },
  );

  it.each([
    "",
    "041234567", // one digit short
    "04123456789", // one digit long
    "0312345678", // landline prefix
    "412345678", // missing leading zero
    "not a number",
  ])("rejects %s", (value) => {
    expect(isValidAustralianMobile(value)).toBe(false);
  });
});
