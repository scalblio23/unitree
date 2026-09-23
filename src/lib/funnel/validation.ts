export const NAME_ERROR = "Please enter your full name.";
export const EMAIL_ERROR = "Please enter a valid email address.";
export const PHONE_ERROR = "Please enter a valid Australian phone number.";
export const INDUSTRY_ERROR = "Please tell us what industry you're in.";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

/**
 * Strip everything that isn't a digit, then rewrite a leading +61 / 61 country
 * code as a leading 0 so both local and international spellings normalise to
 * the same 10-digit form.
 */
export function normalisePhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits.startsWith("61") ? `0${digits.slice(2)}` : digits;
}

/**
 * Australian mobiles (04) and landlines with an area code (02, 03, 07, 08),
 * each followed by eight more digits.
 */
export function isValidAustralianPhone(value: string): boolean {
  return /^0[23478]\d{8}$/.test(normalisePhone(value));
}

/** The first word of a full name, for the thank you greeting. */
export function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? "";
}
