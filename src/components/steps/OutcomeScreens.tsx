"use client";

import { CheckIcon } from "@/components/CheckIcon";

export function QualifiedScreen({
  firstName,
  headingId,
}: {
  firstName: string;
  headingId: string;
}) {
  const name = firstName.trim();

  return (
    <div className="outcome">
      <div className="badge">
        <CheckIcon size={32} strokeWidth={2.5} />
      </div>
      <h2 className="outcome-title" id={headingId} tabIndex={-1}>
        Thank you{name ? ` ${name}` : ""}! Your application has been received.
      </h2>
      <p className="outcome-hint">
        One of our lending specialists will be in touch with you shortly.
      </p>
    </div>
  );
}

export function DisqualifiedScreen({ headingId }: { headingId: string }) {
  return (
    <div className="outcome">
      <h2 className="outcome-title" id={headingId} tabIndex={-1}>
        Sorry, it doesn&apos;t look like we&apos;re able to help with your situation right now.
      </h2>
    </div>
  );
}
