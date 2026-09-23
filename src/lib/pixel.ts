/** Meta (Facebook) pixel for this landing page. */
export const META_PIXEL_ID = "511196348754102";

type Fbq = (
  command: "track",
  event: string,
  params?: Record<string, unknown>,
  options?: { eventID?: string },
) => void;

/**
 * Reports a Lead to the Meta pixel. Called only once a lead has actually been
 * delivered, so disqualified visitors and failed submissions are never counted.
 * Does nothing if the pixel script has not loaded (e.g. blocked by an ad blocker).
 */
export function trackLead(eventId: string) {
  const fbq = (globalThis as { fbq?: Fbq }).fbq;
  if (typeof fbq !== "function") return;
  // The event id lets Meta de-duplicate if the same lead is ever reported twice.
  fbq("track", "Lead", {}, { eventID: eventId });
}
