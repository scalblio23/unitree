"use client";

import { CheckIcon } from "@/components/CheckIcon";
import { MockScheduler } from "@/components/MockScheduler";

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
        Congrats{name ? ` ${name}` : ""}, we can help! Book a time below to get started on your
        first home today!
      </h2>
      <p className="outcome-hint">No cost. No obligation.</p>
      <MockScheduler />
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
