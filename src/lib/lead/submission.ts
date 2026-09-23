import {
  CREDIT_SCORE_OPTIONS,
  IN_BUSINESS_OPTIONS,
  MAX_INDUSTRY_LENGTH,
  PURPOSE_OPTIONS,
  formatAmount,
  isValidAmount,
  type Option,
} from "@/lib/funnel/steps";
import {
  EMAIL_ERROR,
  INDUSTRY_ERROR,
  NAME_ERROR,
  PHONE_ERROR,
  isValidAustralianPhone,
  isValidEmail,
  normalisePhone,
} from "@/lib/funnel/validation";

/** Shown on the contact step when the lead could not be delivered. */
export const SUBMIT_ERROR = "Sorry, we couldn't send your details. Please try again.";

/** The endpoint the browser posts to. The Make webhook URL never leaves the server. */
export const LEAD_ENDPOINT = "/api/lead";

/** What the browser posts to {@link LEAD_ENDPOINT}. */
export type LeadRequest = {
  /** Generated once per completed form so retries of the same lead can be de-duplicated. */
  submissionId: string;
  name: string;
  email: string;
  phone: string;
  /** Whole dollars, from the slider. */
  amount: number;
  /** Option values, as stored by the funnel reducer. */
  inBusiness: string;
  /** Free text. */
  industry: string;
  purpose: string;
  creditScore: string;
  pageUrl: string;
};

/**
 * What the server posts to the Make webhook: one flat object per lead, one row
 * per object, with human-readable answers rather than option slugs.
 * `status` and `notes` are deliberately blank — they are filled in by hand
 * after the fact.
 */
export type LeadPayload = {
  submissionId: string;
  /** ISO 8601, always UTC, stamped by the server when the lead is accepted. */
  submittedAt: string;
  name: string;
  email: string;
  phone: string;
  /** Formatted, e.g. "$50,000". */
  amount: string;
  inBusiness: string;
  industry: string;
  purpose: string;
  creditScore: string;
  pageUrl: string;
  status: "";
  notes: "";
};

export type LeadFieldErrors = Partial<Record<keyof LeadRequest, string>>;

export type ValidationResult =
  | { ok: true; value: LeadRequest }
  | { ok: false; errors: LeadFieldErrors };

const MAX_NAME = 120;
const MAX_EMAIL = 254;
const MAX_URL = 2000;
const SUBMISSION_ID_PATTERN = /^[A-Za-z0-9_-]{8,100}$/;

/**
 * A unique id for one completed form. Kept stable across retries of the same
 * submission so that a lost response cannot turn one lead into two rows.
 */
export function createSubmissionId(): string {
  const uuid =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 14)}`;
  return `sr-${uuid}`;
}

function labelFor(options: Option[], value: unknown): string | null {
  if (typeof value !== "string") return null;
  return options.find((option) => option.value === value)?.label ?? null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Validates an untrusted request body. The browser runs the same rules before
 * posting, but the route never trusts that — the endpoint is public, so
 * everything is re-checked here.
 */
export function validateLeadRequest(body: unknown): ValidationResult {
  if (typeof body !== "object" || body === null) {
    return { ok: false, errors: { submissionId: "Malformed request body." } };
  }

  const input = body as Record<string, unknown>;
  const errors: LeadFieldErrors = {};

  const submissionId = asString(input.submissionId);
  if (!SUBMISSION_ID_PATTERN.test(submissionId)) {
    errors.submissionId = "Missing or malformed submission id.";
  }

  const name = asString(input.name);
  if (!name || name.length > MAX_NAME) errors.name = NAME_ERROR;

  const email = asString(input.email);
  if (!isValidEmail(email) || email.length > MAX_EMAIL) errors.email = EMAIL_ERROR;

  const phone = asString(input.phone);
  if (!isValidAustralianPhone(phone)) errors.phone = PHONE_ERROR;

  if (!isValidAmount(input.amount)) errors.amount = "Invalid borrowing amount.";

  if (labelFor(IN_BUSINESS_OPTIONS, input.inBusiness) === null) {
    errors.inBusiness = "Unknown business answer.";
  }

  const industry = asString(input.industry);
  if (!industry || industry.length > MAX_INDUSTRY_LENGTH) errors.industry = INDUSTRY_ERROR;

  if (labelFor(PURPOSE_OPTIONS, input.purpose) === null) {
    errors.purpose = "Unknown loan purpose.";
  }

  if (labelFor(CREDIT_SCORE_OPTIONS, input.creditScore) === null) {
    errors.creditScore = "Unknown credit score answer.";
  }

  const pageUrl = asString(input.pageUrl);
  if (!isHttpUrl(pageUrl) || pageUrl.length > MAX_URL) errors.pageUrl = "Invalid page URL.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      submissionId,
      name,
      email,
      phone,
      amount: input.amount as number,
      inBusiness: String(input.inBusiness),
      industry,
      purpose: String(input.purpose),
      creditScore: String(input.creditScore),
      pageUrl,
    },
  };
}

/**
 * Turns a validated request into the row Make appends. `submittedAt` is taken
 * from the server clock, never from the client, and is always UTC.
 */
export function buildLeadPayload(request: LeadRequest, now: Date = new Date()): LeadPayload {
  return {
    submissionId: request.submissionId,
    submittedAt: now.toISOString(),
    name: request.name,
    email: request.email.toLowerCase(),
    phone: normalisePhone(request.phone),
    amount: formatAmount(request.amount),
    inBusiness: labelFor(IN_BUSINESS_OPTIONS, request.inBusiness) ?? request.inBusiness,
    industry: request.industry,
    purpose: labelFor(PURPOSE_OPTIONS, request.purpose) ?? request.purpose,
    creditScore: labelFor(CREDIT_SCORE_OPTIONS, request.creditScore) ?? request.creditScore,
    pageUrl: request.pageUrl,
    status: "",
    notes: "",
  };
}
