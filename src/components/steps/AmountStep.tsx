"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  AMOUNT_DEFAULT,
  AMOUNT_MAX,
  AMOUNT_MIN,
  AMOUNT_STEP,
  formatAmount,
} from "@/lib/funnel/steps";

/** Pause after the thumb is released, so the visitor sees the value land. */
export const POINTER_ADVANCE_MS = 450;
/** Keyboard users nudge the value in steps, so wait for them to stop. */
export const KEYBOARD_ADVANCE_MS = 1200;

const NUDGE_KEYS = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "PageUp",
  "PageDown",
  "Home",
  "End",
]);

type AmountStepProps = {
  questionId: string;
  selected?: number;
  onSubmit: (amount: number) => void;
};

/**
 * The borrowing amount slider. The figure updates live while dragging, and
 * letting go of the slider moves on to the next question automatically.
 */
export function AmountStep({ questionId, selected, onSubmit }: AmountStepProps) {
  const sliderId = useId();
  const [amount, setAmount] = useState(selected ?? AMOUNT_DEFAULT);

  // The timer callback reads the latest value, not the one from its render.
  const latest = useRef(amount);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const done = useRef(false);

  function cancelAdvance() {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }

  function advance() {
    cancelAdvance();
    if (done.current) return;
    done.current = true;
    onSubmit(latest.current);
  }

  function scheduleAdvance(delay: number) {
    cancelAdvance();
    timer.current = setTimeout(advance, delay);
  }

  useEffect(() => cancelAdvance, []);

  const fill = ((amount - AMOUNT_MIN) / (AMOUNT_MAX - AMOUNT_MIN)) * 100;

  return (
    <div>
      <h2 className="question" id={questionId} tabIndex={-1}>
        How much are you looking to borrow?
      </h2>

      <p className="amount-value" aria-hidden="true">
        {formatAmount(amount)}
        {amount === AMOUNT_MAX ? "+" : ""}
      </p>

      <label className="visually-hidden" htmlFor={sliderId}>
        Amount to borrow
      </label>
      <input
        id={sliderId}
        className="amount-slider"
        type="range"
        min={AMOUNT_MIN}
        max={AMOUNT_MAX}
        step={AMOUNT_STEP}
        value={amount}
        aria-valuetext={formatAmount(amount)}
        style={{ "--fill": `${fill}%` } as React.CSSProperties}
        onChange={(event) => {
          const value = Number(event.target.value);
          latest.current = value;
          setAmount(value);
        }}
        onPointerDown={cancelAdvance}
        onPointerUp={() => scheduleAdvance(POINTER_ADVANCE_MS)}
        onKeyUp={(event) => {
          if (NUDGE_KEYS.has(event.key)) scheduleAdvance(KEYBOARD_ADVANCE_MS);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            advance();
          }
        }}
      />

      <div className="amount-scale" aria-hidden="true">
        <span>{formatAmount(AMOUNT_MIN)}</span>
        <span>{formatAmount(AMOUNT_MAX)}+</span>
      </div>

      <button className="primary" type="button" onClick={advance}>
        Continue
      </button>
    </div>
  );
}
