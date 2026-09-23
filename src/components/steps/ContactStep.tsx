"use client";

import { useId, useRef, useState } from "react";
import {
  EMAIL_ERROR,
  MOBILE_ERROR,
  NAME_ERROR,
  isValidAustralianMobile,
  isValidEmail,
} from "@/lib/funnel/validation";
import {
  LEAD_ENDPOINT,
  SUBMIT_ERROR,
  createSubmissionId,
  type LeadRequest,
} from "@/lib/lead/submission";

type ContactStepProps = {
  /** The answers from steps 1-3, sent with the lead. */
  answers: { firstHome?: string; situation?: string; income?: string };
  /** Called only after the lead has been delivered; receives the trimmed first name. */
  onComplete: (firstName: string) => void;
  questionId: string;
};

type Errors = { name?: string; email?: string; mobile?: string };

/**
 * The contact details are held in this component's state, posted once to the
 * server route, and discarded when the step unmounts. The Make webhook URL is
 * only ever known to the route, never to this component.
 */
export function ContactStep({ answers, onComplete, questionId }: ContactStepProps) {
  const baseId = useId();
  const nameId = `${baseId}-name`;
  const emailId = `${baseId}-email`;
  const mobileId = `${baseId}-mobile`;
  const hintId = `${baseId}-hint`;
  const formErrorId = `${baseId}-form-error`;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Guards a double submit synchronously: React state updates are batched, so a
  // second click landing in the same tick would otherwise see `submitting` false.
  const busy = useRef(false);
  // Held across retries so a lead whose response was lost is not sent twice.
  const submissionId = useRef<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;

    const next: Errors = {};
    if (!name.trim()) next.name = NAME_ERROR;
    if (!isValidEmail(email)) next.email = EMAIL_ERROR;
    if (!isValidAustralianMobile(mobile)) next.mobile = MOBILE_ERROR;

    if (next.name || next.email || next.mobile) {
      setErrors(next);
      setSubmitError(null);
      return;
    }

    const firstName = name.trim();
    if (!submissionId.current) submissionId.current = createSubmissionId();

    const lead: LeadRequest = {
      submissionId: submissionId.current,
      name: firstName,
      email: email.trim(),
      mobile: mobile.trim(),
      firstHome: answers.firstHome ?? "",
      situation: answers.situation ?? "",
      income: answers.income ?? "",
      pageUrl: window.location.href,
    };

    busy.current = true;
    setErrors({});
    setSubmitError(null);
    setSubmitting(true);

    let succeeded = false;
    try {
      const response = await fetch(LEAD_ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(lead),
      });
      succeeded = response.ok;
    } catch {
      succeeded = false;
    }

    busy.current = false;

    if (!succeeded) {
      // The visitor stays on the step and can retry. Never show the success
      // screen for a lead that was not delivered.
      setSubmitting(false);
      setSubmitError(SUBMIT_ERROR);
      return;
    }

    setSubmitting(false);
    setName("");
    setEmail("");
    setMobile("");
    onComplete(firstName);
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h2 className="question" id={questionId} tabIndex={-1}>
        Where should we send your offer?
      </h2>
      <p className="hint" id={hintId}>
        We&apos;ll use this to match you with the best offer
      </p>

      <label className="visually-hidden" htmlFor={nameId}>
        Your name
      </label>
      <input
        id={nameId}
        className="field"
        type="text"
        name="name"
        autoComplete="given-name"
        placeholder="Your name"
        value={name}
        disabled={submitting}
        aria-invalid={errors.name ? true : undefined}
        aria-describedby={errors.name ? `${nameId}-error` : hintId}
        onChange={(event) => {
          setName(event.target.value);
          if (errors.name) setErrors((current) => ({ ...current, name: undefined }));
        }}
      />
      {errors.name ? (
        <p className="error" id={`${nameId}-error`}>
          {errors.name}
        </p>
      ) : null}

      <label className="visually-hidden" htmlFor={emailId}>
        Email address
      </label>
      <input
        id={emailId}
        className="field"
        type="email"
        name="email"
        autoComplete="email"
        inputMode="email"
        placeholder="Email address"
        value={email}
        disabled={submitting}
        aria-invalid={errors.email ? true : undefined}
        aria-describedby={errors.email ? `${emailId}-error` : undefined}
        onChange={(event) => {
          setEmail(event.target.value);
          if (errors.email) setErrors((current) => ({ ...current, email: undefined }));
        }}
      />
      {errors.email ? (
        <p className="error" id={`${emailId}-error`}>
          {errors.email}
        </p>
      ) : null}

      <label className="visually-hidden" htmlFor={mobileId}>
        Mobile number
      </label>
      <input
        id={mobileId}
        className="field"
        type="tel"
        name="mobile"
        autoComplete="tel"
        inputMode="tel"
        placeholder="Mobile number"
        value={mobile}
        disabled={submitting}
        aria-invalid={errors.mobile ? true : undefined}
        aria-describedby={errors.mobile ? `${mobileId}-error` : undefined}
        onChange={(event) => {
          setMobile(event.target.value);
          if (errors.mobile) setErrors((current) => ({ ...current, mobile: undefined }));
        }}
      />
      {errors.mobile ? (
        <p className="error" id={`${mobileId}-error`}>
          {errors.mobile}
        </p>
      ) : null}

      {submitError ? (
        <p className="error error--form" id={formErrorId} role="alert">
          {submitError}
        </p>
      ) : null}

      <button
        className="primary"
        type="submit"
        disabled={submitting}
        aria-busy={submitting || undefined}
        aria-describedby={submitError ? formErrorId : undefined}
      >
        {submitting ? "Sending…" : "See My Offer"}
      </button>
    </form>
  );
}
