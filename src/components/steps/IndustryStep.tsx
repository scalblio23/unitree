"use client";

import { useId, useState } from "react";
import { MAX_INDUSTRY_LENGTH } from "@/lib/funnel/steps";
import { INDUSTRY_ERROR } from "@/lib/funnel/validation";

type IndustryStepProps = {
  questionId: string;
  selected?: string;
  onSubmit: (industry: string) => void;
};

/** Short free-text answer. Enter or Continue moves on. */
export function IndustryStep({ questionId, selected, onSubmit }: IndustryStepProps) {
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const [industry, setIndustry] = useState(selected ?? "");
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const value = industry.trim();
        if (!value) {
          setError(INDUSTRY_ERROR);
          return;
        }
        onSubmit(value);
      }}
    >
      <h2 className="question" id={questionId} tabIndex={-1}>
        What industry are you in?
      </h2>

      <label className="visually-hidden" htmlFor={inputId}>
        Industry
      </label>
      <input
        id={inputId}
        className="field"
        type="text"
        name="industry"
        placeholder="e.g. Construction, Retail, Hospitality"
        maxLength={MAX_INDUSTRY_LENGTH}
        value={industry}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => {
          setIndustry(event.target.value);
          if (error) setError(null);
        }}
      />
      {error ? (
        <p className="error" id={errorId}>
          {error}
        </p>
      ) : null}

      <button className="primary" type="submit">
        Continue
      </button>
    </form>
  );
}
