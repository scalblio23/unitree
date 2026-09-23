export const NAME_ERROR = "Please enter your name.";
export const EMAIL_ERROR = "Please enter a valid email address.";
export const MOBILE_ERROR = "Please enter a valid Australian mobile number.";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

/**
 * Strip everything that isn't a digit, then rewrite a leading +61 / 61 country
 * code as a leading 0 so both local and international spellings normalise to
 * the same 10-digit form.
 */
export function normaliseMobile(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits.startsWith("61") ? `0${digits.slice(2)}` : digits;
}

/** Australian mobiles: 04 followed by eight more digits. */
export function isValidAustralianMobile(value: string): boolean {
  return /^04\d{8}$/.test(normaliseMobile(value));
}
