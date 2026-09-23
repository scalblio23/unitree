export type StepId = "firstHome" | "situation" | "income" | "contact";

export type Screen = StepId | "qualified" | "disqualified";

export type Option = {
  /** Stable key used for branching and as a React key. */
  value: string;
  label: string;
};

/** The numbered steps, in the order they are asked. */
export const STEP_ORDER: StepId[] = ["firstHome", "situation", "income", "contact"];

export const TOTAL_STEPS = STEP_ORDER.length;

export const FIRST_HOME_OPTIONS: Option[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

export const SITUATION_OPTIONS: Option[] = [
  { value: "full-time", label: "Full time" },
  { value: "part-time", label: "Part time" },
  { value: "self-employed", label: "Self employed" },
  { value: "government-assistance", label: "Government Assistance" },
];

export const INCOME_OPTIONS: Option[] = [
  { value: "under-120k", label: "Under $120k" },
  { value: "120k-150k", label: "$120k – $150k" },
  { value: "150k-200k", label: "$150k – $200k" },
  { value: "200k-plus", label: "$200k+" },
];

export function isStep(screen: Screen): screen is StepId {
  return (STEP_ORDER as string[]).includes(screen);
}

/** 1-based number for the "STEP n OF 4" counter, or null on terminal screens. */
export function stepNumber(screen: Screen): number | null {
  return isStep(screen) ? STEP_ORDER.indexOf(screen) + 1 : null;
}

/**
 * Step 1 starts the track empty, each later step adds a quarter, and both
 * terminal screens fill it.
 */
export function progressFor(screen: Screen): number {
  const number = stepNumber(screen);
  return number === null ? 1 : (number - 1) / TOTAL_STEPS;
}
