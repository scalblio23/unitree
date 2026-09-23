export type StepId = "amount" | "inBusiness" | "industry" | "purpose" | "creditScore" | "contact";

export type Screen = StepId | "qualified" | "disqualified";

export type Option = {
  /** Stable key used for branching and as a React key. */
  value: string;
  label: string;
};

/** The numbered steps, in the order they are asked. */
export const STEP_ORDER: StepId[] = [
  "amount",
  "inBusiness",
  "industry",
  "purpose",
  "creditScore",
  "contact",
];

export const TOTAL_STEPS = STEP_ORDER.length;

/** Borrowing amount slider bounds, in whole dollars. */
export const AMOUNT_MIN = 5_000;
export const AMOUNT_MAX = 500_000;
export const AMOUNT_STEP = 5_000;
export const AMOUNT_DEFAULT = 50_000;

export const MAX_INDUSTRY_LENGTH = 100;

export const IN_BUSINESS_OPTIONS: Option[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

export const PURPOSE_OPTIONS: Option[] = [
  { value: "working-capital", label: "Working capital / cash flow" },
  { value: "equipment", label: "Equipment or vehicle purchase" },
  { value: "expansion", label: "Business expansion" },
  { value: "stock", label: "Stock / inventory" },
  { value: "refinance", label: "Refinance existing debt" },
  { value: "other", label: "Other" },
];

export const CREDIT_SCORE_OPTIONS: Option[] = [
  { value: "bad", label: "Bad" },
  { value: "ok", label: "OK" },
  { value: "good", label: "Good" },
  { value: "great", label: "Great" },
];

/** "$50,000" — whole dollars, Australian grouping. */
export function formatAmount(amount: number): string {
  return `$${amount.toLocaleString("en-AU")}`;
}

export function isValidAmount(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= AMOUNT_MIN &&
    value <= AMOUNT_MAX &&
    value % AMOUNT_STEP === 0
  );
}

export function isStep(screen: Screen): screen is StepId {
  return (STEP_ORDER as string[]).includes(screen);
}

/** 1-based number for the "STEP n OF 6" counter, or null on terminal screens. */
export function stepNumber(screen: Screen): number | null {
  return isStep(screen) ? STEP_ORDER.indexOf(screen) + 1 : null;
}

/**
 * Step 1 starts the track empty, each later step adds an equal share, and
 * both terminal screens fill it.
 */
export function progressFor(screen: Screen): number {
  const number = stepNumber(screen);
  return number === null ? 1 : (number - 1) / TOTAL_STEPS;
}
