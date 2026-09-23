import { type Screen, type StepId, progressFor, stepNumber } from "./steps";

export type Answers = {
  /** Captured on the contact step and used only to personalise the thank you. */
  firstName: string;
  amount?: number;
  inBusiness?: string;
  industry?: string;
  purpose?: string;
  creditScore?: string;
};

/** The questions answered before the contact step. */
export type QuestionId = Exclude<StepId, "contact">;

export type FunnelState = {
  /**
   * Every screen visited so far, oldest first. The last entry is the current
   * screen, and going back pops one off, so branching paths rewind correctly.
   */
  stack: Screen[];
  answers: Answers;
};

export type FunnelAction =
  | { type: "answer"; id: "amount"; value: number }
  | { type: "answer"; id: Exclude<QuestionId, "amount">; value: string }
  | { type: "complete"; firstName: string }
  | { type: "back" };

export const INITIAL_STATE: FunnelState = {
  stack: ["amount"],
  answers: { firstName: "" },
};

export function currentScreen(state: FunnelState): Screen {
  return state.stack[state.stack.length - 1];
}

export function canGoBack(state: FunnelState): boolean {
  return state.stack.length > 1;
}

/**
 * Where a completed step leads. Not running a business, or rating their credit
 * as bad, ends the flow.
 */
export function nextScreenAfter(id: StepId, answers: Answers): Screen {
  switch (id) {
    case "amount":
      return "inBusiness";
    case "inBusiness":
      return answers.inBusiness === "no" ? "disqualified" : "industry";
    case "industry":
      return "purpose";
    case "purpose":
      return "creditScore";
    case "creditScore":
      return answers.creditScore === "bad" ? "disqualified" : "contact";
    case "contact":
      return "qualified";
  }
}

export function funnelReducer(state: FunnelState, action: FunnelAction): FunnelState {
  switch (action.type) {
    case "answer": {
      const answers = { ...state.answers, [action.id]: action.value };
      return {
        answers,
        stack: [...state.stack, nextScreenAfter(action.id, answers)],
      };
    }

    case "complete":
      // Only the first name is kept; the email and phone stay in the step's own
      // state and are discarded when it unmounts.
      return {
        answers: { ...state.answers, firstName: action.firstName },
        stack: [...state.stack, nextScreenAfter("contact", state.answers)],
      };

    case "back":
      return canGoBack(state) ? { ...state, stack: state.stack.slice(0, -1) } : state;
  }
}

export { progressFor, stepNumber };
