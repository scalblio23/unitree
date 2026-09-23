import {
  buildLeadPayload,
  validateLeadRequest,
  type LeadPayload,
} from "@/lib/lead/submission";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The Make webhook for the "76 - Goal Finance - Business Funding" tab. Only ever
 * read here on the server, never sent to the browser. MAKE_WEBHOOK_URL, if set,
 * overrides it.
 */
const WEBHOOK_URL = "https://hook.eu1.make.com/8z59ph5q2wbwfopyqs1hbcicsqukd8u1";

/** How long a single delivery attempt may take before it is abandoned. */
const ATTEMPT_TIMEOUT_MS = 8_000;

/** Backoff before the 2nd and 3rd attempts. Three attempts in total. */
const RETRY_DELAYS_MS = [400, 1_200];

/** How long a delivered submission id is remembered, to absorb client retries. */
const DEDUPE_TTL_MS = 10 * 60 * 1_000;

/**
 * Submission ids already delivered, mapped to the time they can be forgotten.
 *
 * Module state, so it is per serverless instance and best-effort only. The
 * browser is the primary guard against double submits; this catches the retry
 * of a request whose response was lost, which is exactly the case the browser
 * cannot distinguish from a failure.
 */
const delivered = new Map<string, number>();

/** Deliveries currently in flight, so two racing posts share one webhook call. */
const inFlight = new Map<string, Promise<DeliveryResult>>();

type DeliveryResult = { ok: true } | { ok: false; detail: string };

function prune(now: number) {
  for (const [id, expiry] of delivered) {
    if (expiry <= now) delivered.delete(id);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

/**
 * POSTs the lead to Make, retrying timeouts, network errors and 5xx/429
 * responses. A 4xx is the webhook rejecting the payload, which a retry cannot
 * fix, so it fails immediately.
 */
async function deliver(payload: LeadPayload, webhookUrl: string): Promise<DeliveryResult> {
  let lastDetail = "no attempt was made";

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    if (attempt > 0) await sleep(RETRY_DELAYS_MS[attempt - 1]);

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
      });

      if (response.ok) return { ok: true };

      lastDetail = `webhook responded ${response.status}`;
      const retryable = response.status >= 500 || response.status === 429;
      if (!retryable) return { ok: false, detail: lastDetail };
    } catch (error) {
      lastDetail = error instanceof Error ? error.message : "webhook request failed";
    }
  }

  return { ok: false, detail: lastDetail };
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const validated = validateLeadRequest(body);
  if (!validated.ok) {
    return json({ ok: false, error: "invalid_submission", errors: validated.errors }, 400);
  }

  const webhookUrl = process.env.MAKE_WEBHOOK_URL?.trim() || WEBHOOK_URL;

  const { submissionId } = validated.value;
  const now = Date.now();
  prune(now);

  if (delivered.has(submissionId)) {
    return json({ ok: true, submissionId, duplicate: true }, 200);
  }

  let delivery = inFlight.get(submissionId);
  let duplicate = true;

  if (!delivery) {
    duplicate = false;
    const payload = buildLeadPayload(validated.value, new Date(now));
    delivery = deliver(payload, webhookUrl).finally(() => inFlight.delete(submissionId));
    inFlight.set(submissionId, delivery);
  }

  const result = await delivery;

  if (!result.ok) {
    console.error(`[lead] delivery failed for ${submissionId}: ${result.detail}`);
    return json({ ok: false, error: "delivery_failed" }, 502);
  }

  delivered.set(submissionId, Date.now() + DEDUPE_TTL_MS);
  return json({ ok: true, submissionId, duplicate }, 200);
}
