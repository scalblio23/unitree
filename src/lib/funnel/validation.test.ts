import { describe, expect, it } from "vitest";
import { firstNameOf, isValidAustralianPhone, isValidEmail, normalisePhone } from "./validation";
import { formatAmount, isValidAmount } from "./steps";

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

describe("phone normalisation", () => {
  it("strips formatting characters", () => {
    expect(normalisePhone("0412 345 678")).toBe("0412345678");
    expect(normalisePhone("(02) 9876-5432")).toBe("0298765432");
  });

  it("rewrites a +61 country code as a leading zero", () => {
    expect(normalisePhone("+61 412 345 678")).toBe("0412345678");
    expect(normalisePhone("61412345678")).toBe("0412345678");
  });
});

describe("australian phone numbers", () => {
  it.each([
    "0412345678",
    "0412 345 678",
    "+61 412 345 678",
    "+61412345678",
    "(02) 9876 5432",
    "03 9876 5432",
    "07 3123 4567",
    "08 9123 4567",
  ])("accepts %s", (value) => {
    expect(isValidAustralianPhone(value)).toBe(true);
  });

  it.each([
    "",
    "041234567", // one digit short
    "04123456789", // one digit long
    "0512345678", // not an Australian prefix
    "412345678", // missing leading zero
    "not a number",
  ])("rejects %s", (value) => {
    expect(isValidAustralianPhone(value)).toBe(false);
  });
});

describe("first name", () => {
  it("takes the first word of a full name", () => {
    expect(firstNameOf("  Sam   Tester ")).toBe("Sam");
    expect(firstNameOf("Sam")).toBe("Sam");
    expect(firstNameOf("   ")).toBe("");
  });
});

describe("borrowing amount", () => {
  it("formats whole dollars with grouping", () => {
    expect(formatAmount(5_000)).toBe("$5,000");
    expect(formatAmount(500_000)).toBe("$500,000");
  });

  it.each([5_000, 50_000, 500_000])("accepts %d", (value) => {
    expect(isValidAmount(value)).toBe(true);
  });

  it.each([0, 4_999, 505_000, 12_345, "50000", Number.NaN])("rejects %s", (value) => {
    expect(isValidAmount(value)).toBe(false);
  });
});
