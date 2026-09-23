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
import { TOTAL_STEPS, progressFor, stepNumber } from "./steps";

function run(actions: FunnelAction[], from: FunnelState = INITIAL_STATE): FunnelState {
  return actions.reduce(funnelReducer, from);
}

/** Answers steps 1-3 down the qualifying path, leaving the contact step current. */
function qualifyingPath(): FunnelAction[] {
  return [
    { type: "select", id: "firstHome", value: "yes" },
    { type: "select", id: "situation", value: "full-time" },
    { type: "select", id: "income", value: "150k-200k" },
  ];
}

describe("progression", () => {
  it("starts on the first home question", () => {
    expect(currentScreen(INITIAL_STATE)).toBe("firstHome");
    expect(stepNumber("firstHome")).toBe(1);
    expect(canGoBack(INITIAL_STATE)).toBe(false);
  });

  it("has four steps", () => {
    expect(TOTAL_STEPS).toBe(4);
    expect(stepNumber("contact")).toBe(4);
  });

  it("walks first home -> situation -> income -> contact", () => {
    let state = INITIAL_STATE;
    const seen = [currentScreen(state)];
    for (const action of qualifyingPath()) {
      state = funnelReducer(state, action);
      seen.push(currentScreen(state));
    }
    expect(seen).toEqual(["firstHome", "situation", "income", "contact"]);
  });

  it("reaches the qualified screen after the contact step", () => {
    const state = run([...qualifyingPath(), { type: "complete", firstName: "Sam" }]);
    expect(currentScreen(state)).toBe("qualified");
    expect(stepNumber("qualified")).toBeNull();
  });

  it("keeps only the first name from the contact step", () => {
    const state = run([...qualifyingPath(), { type: "complete", firstName: "Sam" }]);
    expect(state.answers.firstName).toBe("Sam");
    expect(Object.keys(state.answers).sort()).toEqual([
      "firstHome",
      "firstName",
      "income",
      "situation",
    ]);
  });

  it("keeps answers when stepping back", () => {
    let state = run(qualifyingPath());
    state = funnelReducer(state, { type: "back" });
    state = funnelReducer(state, { type: "back" });
    expect(currentScreen(state)).toBe("situation");
    expect(state.answers.firstHome).toBe("yes");
    expect(state.answers.situation).toBe("full-time");
    expect(state.answers.income).toBe("150k-200k");
  });

  it("does nothing when going back from the first step", () => {
    expect(funnelReducer(INITIAL_STATE, { type: "back" })).toBe(INITIAL_STATE);
  });
});

describe("disqualification", () => {
  it("ends the flow when they are not buying a first home", () => {
    const state = funnelReducer(INITIAL_STATE, {
      type: "select",
      id: "firstHome",
      value: "no",
    });
    expect(currentScreen(state)).toBe("disqualified");
  });

  it("continues when they are", () => {
    const state = funnelReducer(INITIAL_STATE, {
      type: "select",
      id: "firstHome",
      value: "yes",
    });
    expect(currentScreen(state)).toBe("situation");
  });

  it("rewinds out of the disqualified branch to the question that caused it", () => {
    let state = funnelReducer(INITIAL_STATE, { type: "select", id: "firstHome", value: "no" });
    state = funnelReducer(state, { type: "back" });
    expect(currentScreen(state)).toBe("firstHome");
  });

  it.each(["full-time", "part-time", "self-employed", "government-assistance"])(
    "carries every situation answer through to income: %s",
    (value) => {
      const state = run([
        { type: "select", id: "firstHome", value: "yes" },
        { type: "select", id: "situation", value },
      ]);
      expect(currentScreen(state)).toBe("income");
    },
  );

  it.each(["under-120k", "120k-150k", "150k-200k", "200k-plus"])(
    "carries every income answer through to contact: %s",
    (value) => {
      const state = run([
        { type: "select", id: "firstHome", value: "yes" },
        { type: "select", id: "situation", value: "part-time" },
        { type: "select", id: "income", value },
      ]);
      expect(currentScreen(state)).toBe("contact");
    },
  );

  it("routes each answer to the screen the flow specifies", () => {
    const answers = { firstName: "", firstHome: "yes" };
    expect(nextScreenAfter("firstHome", answers)).toBe("situation");
    expect(nextScreenAfter("situation", answers)).toBe("income");
    expect(nextScreenAfter("income", answers)).toBe("contact");
    expect(nextScreenAfter("contact", answers)).toBe("qualified");
    expect(nextScreenAfter("firstHome", { firstName: "", firstHome: "no" })).toBe("disqualified");
  });
});

describe("progress track", () => {
  it("starts empty and fills a quarter per step", () => {
    expect(progressFor("firstHome")).toBe(0);
    expect(progressFor("situation")).toBe(0.25);
    expect(progressFor("income")).toBe(0.5);
    expect(progressFor("contact")).toBe(0.75);
  });

  it("is full on both terminal screens", () => {
    expect(progressFor("qualified")).toBe(1);
    expect(progressFor("disqualified")).toBe(1);
  });
});
