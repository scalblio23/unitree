import { describe, expect, it } from "vitest";
import {
  type FunnelAction,
  type FunnelState,
  INITIAL_STATE,
  canGoBack,
  currentScreen,
  funnelReducer,
  nextScreenAfter,
} from "./machine";
import { STEP_ORDER, TOTAL_STEPS, progressFor, stepNumber } from "./steps";

function run(actions: FunnelAction[], from: FunnelState = INITIAL_STATE): FunnelState {
  return actions.reduce(funnelReducer, from);
}

/** Answers every question down the qualifying path, leaving the contact step current. */
function qualifyingPath(): FunnelAction[] {
  return [
    { type: "answer", id: "amount", value: 150_000 },
    { type: "answer", id: "inBusiness", value: "yes" },
    { type: "answer", id: "industry", value: "Construction" },
    { type: "answer", id: "purpose", value: "equipment" },
    { type: "answer", id: "creditScore", value: "good" },
  ];
}

describe("progression", () => {
  it("starts on the borrowing amount", () => {
    expect(currentScreen(INITIAL_STATE)).toBe("amount");
    expect(stepNumber("amount")).toBe(1);
    expect(canGoBack(INITIAL_STATE)).toBe(false);
  });

  it("has six steps, ending with the contact details", () => {
    expect(TOTAL_STEPS).toBe(6);
    expect(stepNumber("contact")).toBe(6);
  });

  it("walks every question in order", () => {
    let state = INITIAL_STATE;
    const seen = [currentScreen(state)];
    for (const action of qualifyingPath()) {
      state = funnelReducer(state, action);
      seen.push(currentScreen(state));
    }
    expect(seen).toEqual(STEP_ORDER);
  });

  it("reaches the thank you screen after the contact step", () => {
    const state = run([...qualifyingPath(), { type: "complete", firstName: "Sam" }]);
    expect(currentScreen(state)).toBe("qualified");
    expect(stepNumber("qualified")).toBeNull();
  });

  it("keeps the answers and only the first name from the contact step", () => {
    const state = run([...qualifyingPath(), { type: "complete", firstName: "Sam" }]);
    expect(state.answers).toEqual({
      firstName: "Sam",
      amount: 150_000,
      inBusiness: "yes",
      industry: "Construction",
      purpose: "equipment",
      creditScore: "good",
    });
  });

  it("keeps answers when stepping back", () => {
    let state = run(qualifyingPath());
    state = funnelReducer(state, { type: "back" });
    state = funnelReducer(state, { type: "back" });
    expect(currentScreen(state)).toBe("purpose");
    expect(state.answers.amount).toBe(150_000);
    expect(state.answers.industry).toBe("Construction");
    expect(state.answers.creditScore).toBe("good");
  });

  it("does nothing when going back from the first step", () => {
    expect(funnelReducer(INITIAL_STATE, { type: "back" })).toBe(INITIAL_STATE);
  });
});

describe("conditional logic", () => {
  it("disqualifies someone who does not run a business", () => {
    const state = run([
      { type: "answer", id: "amount", value: 50_000 },
      { type: "answer", id: "inBusiness", value: "no" },
    ]);
    expect(currentScreen(state)).toBe("disqualified");
  });

  it("disqualifies a bad credit score", () => {
    const [amount, inBusiness, industry, purpose] = qualifyingPath();
    const state = run([
      amount,
      inBusiness,
      industry,
      purpose,
      { type: "answer", id: "creditScore", value: "bad" },
    ]);
    expect(currentScreen(state)).toBe("disqualified");
  });

  it.each(["ok", "good", "great"])("continues to contact on a %s credit score", (value) => {
    const [amount, inBusiness, industry, purpose] = qualifyingPath();
    const state = run([
      amount,
      inBusiness,
      industry,
      purpose,
      { type: "answer", id: "creditScore", value },
    ]);
    expect(currentScreen(state)).toBe("contact");
  });

  it.each(["working-capital", "equipment", "expansion", "stock", "refinance", "other"])(
    "carries every loan purpose through: %s",
    (value) => {
      const [amount, inBusiness, industry] = qualifyingPath();
      const state = run([amount, inBusiness, industry, { type: "answer", id: "purpose", value }]);
      expect(currentScreen(state)).toBe("creditScore");
    },
  );

  it("rewinds out of the disqualified branch to the question that caused it", () => {
    let state = run([
      { type: "answer", id: "amount", value: 50_000 },
      { type: "answer", id: "inBusiness", value: "no" },
    ]);
    state = funnelReducer(state, { type: "back" });
    expect(currentScreen(state)).toBe("inBusiness");
  });

  it("routes each answer to the screen the flow specifies", () => {
    const answers = { firstName: "", inBusiness: "yes", creditScore: "great" };
    expect(nextScreenAfter("amount", answers)).toBe("inBusiness");
    expect(nextScreenAfter("inBusiness", answers)).toBe("industry");
    expect(nextScreenAfter("industry", answers)).toBe("purpose");
    expect(nextScreenAfter("purpose", answers)).toBe("creditScore");
    expect(nextScreenAfter("creditScore", answers)).toBe("contact");
    expect(nextScreenAfter("contact", answers)).toBe("qualified");
  });
});

describe("progress track", () => {
  it("starts empty and fills an equal share per step", () => {
    STEP_ORDER.forEach((step, index) => {
      expect(progressFor(step)).toBeCloseTo(index / 6);
    });
  });

  it("is full on both terminal screens", () => {
    expect(progressFor("qualified")).toBe(1);
    expect(progressFor("disqualified")).toBe(1);
  });
});
