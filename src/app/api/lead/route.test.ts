// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const WEBHOOK = "https://hook.example.com/abc123";

const VALID = {
  submissionId: "sr-11111111-2222-3333-4444-555555555555",
  name: "Sam Tester",
  email: "Sam@Example.com",
  phone: "0412 345 678",
  amount: 150_000,
  inBusiness: "yes",
  industry: "Construction",
  purpose: "equipment",
  creditScore: "good",
  pageUrl: "https://stoprent.scalbl.io/",
};

type Route = typeof import("./route");

let POST: Route["POST"];
let fetchMock: ReturnType<typeof vi.fn>;

function request(body: unknown, raw?: string) {
  return new Request("https://stoprent.scalbl.io/api/lead", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: raw ?? JSON.stringify(body),
  });
}

/** The JSON body of the nth webhook call the route made. */
function webhookPayload(call = 0) {
  return JSON.parse(fetchMock.mock.calls[call][1].body as string);
}

function ok() {
  return new Response("Accepted", { status: 200 });
}

/** Runs a POST with the retry backoff fast-forwarded. */
async function postWithRetries(body: unknown) {
  vi.useFakeTimers();
  try {
    const pending = POST(request(body));
    await vi.runAllTimersAsync();
    return await pending;
  } finally {
    vi.useRealTimers();
  }
}

describe("POST /api/lead", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.stubEnv("MAKE_WEBHOOK_URL", WEBHOOK);
    fetchMock = vi.fn().mockResolvedValue(ok());
    vi.stubGlobal("fetch", fetchMock);
    // Fresh module state, so the de-duplication cache starts empty per test.
    ({ POST } = await import("./route"));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("success", () => {
    it("sends exactly one webhook call and reports success", async () => {
      const response = await POST(request(VALID));

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        ok: true,
        submissionId: VALID.submissionId,
        duplicate: false,
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][0]).toBe(WEBHOOK);
      expect(fetchMock.mock.calls[0][1].method).toBe("POST");
    });

    it("sends every field the spreadsheet needs, with readable answers", async () => {
      await POST(request(VALID));

      expect(webhookPayload()).toEqual({
        submissionId: VALID.submissionId,
        submittedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
        name: "Sam Tester",
        email: "sam@example.com",
        phone: "0412345678",
        amount: "$150,000",
        inBusiness: "Yes",
        industry: "Construction",
        purpose: "Equipment or vehicle purchase",
        creditScore: "Good",
        pageUrl: "https://stoprent.scalbl.io/",
        status: "",
        notes: "",
      });
    });

    it("stamps the timestamp in UTC from the server clock", async () => {
      const before = Date.now();
      await POST(request(VALID));
      const after = Date.now();

      const submittedAt = Date.parse(webhookPayload().submittedAt);
      expect(submittedAt).toBeGreaterThanOrEqual(before);
      expect(submittedAt).toBeLessThanOrEqual(after);
      expect(webhookPayload().submittedAt.endsWith("Z")).toBe(true);
    });

    it("normalises an international number", async () => {
      await POST(request({ ...VALID, phone: "+61 412 345 678" }));
      expect(webhookPayload().phone).toBe("0412345678");
    });

    it("accepts a landline", async () => {
      await POST(request({ ...VALID, phone: "(02) 9876 5432" }));
      expect(webhookPayload().phone).toBe("0298765432");
    });
  });

  describe("validation", () => {
    it("rejects a malformed email without calling the webhook", async () => {
      const response = await POST(request({ ...VALID, email: "sam@example" }));

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        ok: false,
        error: "invalid_submission",
        errors: { email: "Please enter a valid email address." },
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("rejects a blank name and a bad phone number", async () => {
      const response = await POST(request({ ...VALID, name: "   ", phone: "12345" }));

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.errors.name).toBe("Please enter your full name.");
      expect(body.errors.phone).toBe("Please enter a valid Australian phone number.");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("rejects survey answers that are not offered options", async () => {
      const response = await POST(request({ ...VALID, purpose: "yacht" }));

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        errors: { purpose: "Unknown loan purpose." },
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("rejects an amount outside the slider range", async () => {
      const response = await POST(request({ ...VALID, amount: 1_000_000 }));

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        errors: { amount: "Invalid borrowing amount." },
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("rejects a missing submission id", async () => {
      const withoutId: Record<string, unknown> = { ...VALID };
      delete withoutId.submissionId;
      const response = await POST(request(withoutId));

      expect(response.status).toBe(400);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("rejects a page URL that is not http(s)", async () => {
      const response = await POST(request({ ...VALID, pageUrl: "javascript:alert(1)" }));

      expect(response.status).toBe(400);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("rejects a body that is not JSON", async () => {
      const response = await POST(request(null, "not json"));

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        error: "invalid_json",
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("duplicate submissions", () => {
    it("sends one lead when the same submission id is posted twice", async () => {
      const first = await POST(request(VALID));
      const second = await POST(request(VALID));

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      await expect(second.json()).resolves.toMatchObject({
        ok: true,
        duplicate: true,
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("sends one lead when two posts race", async () => {
      const [first, second] = await Promise.all([POST(request(VALID)), POST(request(VALID))]);

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("still sends a different submission id", async () => {
      await POST(request(VALID));
      await POST(
        request({
          ...VALID,
          submissionId: "sr-99999999-8888-7777-6666-555555555555",
        }),
      );

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("lets a failed submission be retried", async () => {
      fetchMock.mockResolvedValue(new Response("nope", { status: 500 }));
      const failed = await postWithRetries(VALID);
      expect(failed.status).toBe(502);

      fetchMock.mockResolvedValue(ok());
      const retried = await POST(request(VALID));
      expect(retried.status).toBe(200);
      await expect(retried.json()).resolves.toMatchObject({ duplicate: false });
    });
  });

  describe("delivery failure", () => {
    it("retries a 5xx and reports failure once attempts are exhausted", async () => {
      fetchMock.mockResolvedValue(new Response("boom", { status: 503 }));

      const response = await postWithRetries(VALID);

      expect(response.status).toBe(502);
      await expect(response.json()).resolves.toMatchObject({
        ok: false,
        error: "delivery_failed",
      });
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it("retries a network error and succeeds on a later attempt", async () => {
      fetchMock.mockRejectedValueOnce(new Error("socket hang up")).mockResolvedValueOnce(ok());

      const response = await postWithRetries(VALID);

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({ ok: true });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("does not retry a 4xx from the webhook", async () => {
      fetchMock.mockResolvedValue(new Response("bad request", { status: 400 }));

      const response = await POST(request(VALID));

      expect(response.status).toBe(502);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("fails loudly when the webhook URL is not configured", async () => {
      vi.resetModules();
      vi.stubEnv("MAKE_WEBHOOK_URL", "");
      ({ POST } = await import("./route"));

      const response = await POST(request(VALID));

      expect(response.status).toBe(500);
      await expect(response.json()).resolves.toMatchObject({
        ok: false,
        error: "not_configured",
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
