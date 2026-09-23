import { type Screen, type StepId, progressFor, stepNumber } from "./steps";

export type Answers = {
  /** Captured on the contact step and used only to personalise the confirmation. */
  firstName: string;
  firstHome?: string;
  situation?: string;
  income?: string;
};

export type FunnelState = {
  /**
   * Every screen visited so far, oldest first. The last entry is the current
   * screen, and going back pops one off, so branching paths rewind correctly.
   */
  stack: Screen[];
  answers: Answers;
};

export type FunnelAction =
  | { type: "select"; id: StepId; value: string }
  | { type: "complete"; firstName: string }
  | { type: "back" };

export const INITIAL_STATE: FunnelState = {
  stack: ["firstHome"],
  answers: { firstName: "" },
};

export function currentScreen(state: FunnelState): Screen {
  return state.stack[state.stack.length - 1];
}

export function canGoBack(state: FunnelState): boolean {
  return state.stack.length > 1;
}

/** Where a completed step leads. Answering "no" to the first question ends the flow. */
export function nextScreenAfter(id: StepId, answers: Answers): Screen {
  switch (id) {
    case "firstHome":
      return answers.firstHome === "no" ? "disqualified" : "situation";
    case "situation":
      return "income";
    case "income":
      return "contact";
    case "contact":
      return "qualified";
  }
}

function applyAnswer(answers: Answers, id: StepId, value: string): Answers {
  switch (id) {
    case "firstHome":
      return { ...answers, firstHome: value };
    case "situation":
      return { ...answers, situation: value };
    case "income":
      return { ...answers, income: value };
    default:
      return answers;
  }
}

export function funnelReducer(state: FunnelState, action: FunnelAction): FunnelState {
  switch (action.type) {
    case "select": {
      const answers = applyAnswer(state.answers, action.id, action.value);
      return { answers, stack: [...state.stack, nextScreenAfter(action.id, answers)] };
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
