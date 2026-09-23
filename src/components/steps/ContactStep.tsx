"use client";

import { useId, useRef, useState } from "react";
import {
  EMAIL_ERROR,
  NAME_ERROR,
  PHONE_ERROR,
  firstNameOf,
  isValidAustralianPhone,
  isValidEmail,
} from "@/lib/funnel/validation";
import type { Answers } from "@/lib/funnel/machine";
import {
  LEAD_ENDPOINT,
  SUBMIT_ERROR,
  createSubmissionId,
  type LeadRequest,
} from "@/lib/lead/submission";

type ContactStepProps = {
  /** The answers from the earlier steps, sent with the lead. */
  answers: Omit<Answers, "firstName">;
  /** Called only after the lead has been delivered; receives the first name. */
  onComplete: (firstName: string) => void;
  questionId: string;
};

type Errors = { name?: string; email?: string; phone?: string };

/**
 * The contact details are held in this component's state, posted once to the
 * server route, and discarded when the step unmounts. The Make webhook URL is
 * only ever known to the route, never to this component.
 */
export function ContactStep({ answers, onComplete, questionId }: ContactStepProps) {
  const baseId = useId();
  const nameId = `${baseId}-name`;
  const emailId = `${baseId}-email`;
  const phoneId = `${baseId}-phone`;
  const formErrorId = `${baseId}-form-error`;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
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
    if (!isValidAustralianPhone(phone)) next.phone = PHONE_ERROR;

    if (next.name || next.email || next.phone) {
      setErrors(next);
      setSubmitError(null);
      return;
    }

    const fullName = name.trim();
    if (!submissionId.current) submissionId.current = createSubmissionId();

    const lead: LeadRequest = {
      submissionId: submissionId.current,
      name: fullName,
      email: email.trim(),
      phone: phone.trim(),
      amount: answers.amount ?? 0,
      inBusiness: answers.inBusiness ?? "",
      industry: answers.industry ?? "",
      purpose: answers.purpose ?? "",
      creditScore: answers.creditScore ?? "",
      pageUrl: window.location.href,
    };

    busy.current = true;
    setErrors({});
    setSubmitError(null);
    setSubmitting(true);

    let succeeded = false;
    // A short reason shown with the error, so a failed submission can be diagnosed.
    let reason = "network";
    try {
      const response = await fetch(LEAD_ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(lead),
      });
      succeeded = response.ok;
      if (!succeeded) {
        const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
        reason =
          typeof body?.error === "string"
            ? `${body.error}-${response.status}`
            : `http-${response.status}`;
      }
    } catch {
      succeeded = false;
    }

    busy.current = false;

    if (!succeeded) {
      // The visitor stays on the step and can retry. Never show the success
      // screen for a lead that was not delivered.
      setSubmitting(false);
      setSubmitError(`${SUBMIT_ERROR} (ref: ${reason})`);
      return;
    }

    setSubmitting(false);
    setName("");
    setEmail("");
    setPhone("");
    onComplete(firstNameOf(fullName));
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h2 className="question" id={questionId} tabIndex={-1}>
        Enter your details to finalise your application
      </h2>

      <label className="visually-hidden" htmlFor={nameId}>
        Full name
      </label>
      <input
        id={nameId}
        className="field"
        type="text"
        name="name"
        autoComplete="name"
        placeholder="Full name"
        value={name}
        disabled={submitting}
        aria-invalid={errors.name ? true : undefined}
        aria-describedby={errors.name ? `${nameId}-error` : undefined}
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
        Email
      </label>
      <input
        id={emailId}
        className="field"
        type="email"
        name="email"
        autoComplete="email"
        inputMode="email"
        placeholder="Email"
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

      <label className="visually-hidden" htmlFor={phoneId}>
        Phone
      </label>
      <input
        id={phoneId}
        className="field"
        type="tel"
        name="phone"
        autoComplete="tel"
        inputMode="tel"
        placeholder="Phone"
        value={phone}
        disabled={submitting}
        aria-invalid={errors.phone ? true : undefined}
        aria-describedby={errors.phone ? `${phoneId}-error` : undefined}
        onChange={(event) => {
          setPhone(event.target.value);
          if (errors.phone) setErrors((current) => ({ ...current, phone: undefined }));
        }}
      />
      {errors.phone ? (
        <p className="error" id={`${phoneId}-error`}>
          {errors.phone}
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
        {submitting ? "Sending…" : "Submit"}
      </button>
    </form>
  );
}
