"use client";

import type { Option } from "@/lib/funnel/steps";

type ChoiceStepProps = {
  question: string;
  options: Option[];
  selected?: string;
  onSelect: (value: string) => void;
  questionId: string;
};

/**
 * Single-select steps (employment, income, mortgage, mortgage size). Choosing
 * an option advances straight away, so there is no Continue button.
 */
export function ChoiceStep({
  question,
  options,
  selected,
  onSelect,
  questionId,
}: ChoiceStepProps) {
  return (
    <div>
      <h2 className="question" id={questionId} tabIndex={-1}>
        {question}
      </h2>

      <div role="group" aria-labelledby={questionId}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className="option"
            aria-pressed={selected === option.value}
            onClick={() => onSelect(option.value)}
          >
            <span>{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
