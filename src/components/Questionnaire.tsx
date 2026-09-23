"use client";

import { useCallback, useEffect, useId, useReducer, useRef } from "react";
import { ChoiceStep } from "./steps/ChoiceStep";
import { ContactStep } from "./steps/ContactStep";
import { DisqualifiedScreen, QualifiedScreen } from "./steps/OutcomeScreens";
import {
  canGoBack,
  currentScreen,
  funnelReducer,
  INITIAL_STATE,
  progressFor,
  stepNumber,
} from "@/lib/funnel/machine";
import {
  FIRST_HOME_OPTIONS,
  INCOME_OPTIONS,
  SITUATION_OPTIONS,
  TOTAL_STEPS,
} from "@/lib/funnel/steps";

export function Questionnaire() {
  const [state, dispatch] = useReducer(funnelReducer, INITIAL_STATE);
  const headingId = useId();

  const screen = currentScreen(state);
  const number = stepNumber(screen);
  const isTerminal = number === null;

  // Browser history mirrors the visited stack: forward moves push an entry and
  // every backwards move — including the card's Back button — is driven by
  // popstate, so the two cannot drift apart.
  const depth = useRef(0);
  const fromPopstate = useRef(false);
  const mounted = useRef(false);

  useEffect(() => {
    const target = state.stack.length - 1;
    if (target !== depth.current) {
      if (fromPopstate.current) {
        fromPopstate.current = false;
      } else if (target > depth.current) {
        window.history.pushState({ funnelDepth: target }, "");
      }
      depth.current = target;
    }

    // Announce the new screen to assistive tech, but don't grab focus on load.
    if (mounted.current) {
      document.getElementById(headingId)?.focus({ preventScroll: true });
    }
    mounted.current = true;
  }, [state.stack, headingId]);

  useEffect(() => {
    function onPopstate(event: PopStateEvent) {
      const entry = event.state as { funnelDepth?: number } | null;
      const target = typeof entry?.funnelDepth === "number" ? entry.funnelDepth : 0;
      const delta = depth.current - target;
      // Forward navigation can't be replayed (the stack was popped), so only
      // backwards moves are applied; depth stays put and remains consistent.
      if (delta <= 0) return;
      fromPopstate.current = true;
      depth.current = target;
      for (let i = 0; i < delta; i += 1) {
        dispatch({ type: "back" });
      }
    }

    window.addEventListener("popstate", onPopstate);
    return () => window.removeEventListener("popstate", onPopstate);
  }, []);

  const goBack = useCallback(() => {
    if (depth.current > 0) {
      window.history.back();
      return;
    }
    dispatch({ type: "back" });
  }, []);

  const showBack = !isTerminal && canGoBack(state);

  return (
    <div className={`card${screen === "qualified" ? " card--wide" : ""}`}>
      <div className="card-top">
        {showBack ? (
          <button type="button" className="back" onClick={goBack}>
            &larr; Back
          </button>
        ) : (
          <span aria-hidden="true" />
        )}
        {number !== null ? (
          <span className="step-count">
            Step {number} of {TOTAL_STEPS}
          </span>
        ) : null}
      </div>

      <div className="track">
        <div className="track-fill" style={{ width: `${progressFor(screen) * 100}%` }} />
      </div>

      <p className="visually-hidden" aria-live="polite">
        {number !== null ? `Step ${number} of ${TOTAL_STEPS}` : "Result"}
      </p>

      <div className="step" key={screen}>
        {screen === "firstHome" ? (
          <ChoiceStep
            questionId={headingId}
            question="Are you looking to buy your first home?"
            options={FIRST_HOME_OPTIONS}
            selected={state.answers.firstHome}
            onSelect={(value) => dispatch({ type: "select", id: "firstHome", value })}
          />
        ) : null}

        {screen === "situation" ? (
          <ChoiceStep
            questionId={headingId}
            question="Describe your situation"
            options={SITUATION_OPTIONS}
            selected={state.answers.situation}
            onSelect={(value) => dispatch({ type: "select", id: "situation", value })}
          />
        ) : null}

        {screen === "income" ? (
          <ChoiceStep
            questionId={headingId}
            question="What is your combined household income? (both partners)"
            options={INCOME_OPTIONS}
            selected={state.answers.income}
            onSelect={(value) => dispatch({ type: "select", id: "income", value })}
          />
        ) : null}

        {screen === "contact" ? (
          <ContactStep
            questionId={headingId}
            answers={state.answers}
            onComplete={(firstName) => dispatch({ type: "complete", firstName })}
          />
        ) : null}

        {screen === "qualified" ? (
          <QualifiedScreen headingId={headingId} firstName={state.answers.firstName} />
        ) : null}

        {screen === "disqualified" ? <DisqualifiedScreen headingId={headingId} /> : null}
      </div>
    </div>
  );
}
