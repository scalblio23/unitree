import { describe, expect, it } from "vitest";
import {
  buildLeadPayload,
  createSubmissionId,
  validateLeadRequest,
  type LeadRequest,
} from "./submission";

const REQUEST: LeadRequest = {
  submissionId: "sr-abcdef01-2345-6789-abcd-ef0123456789",
  name: "Sam Tester",
  email: "Sam@Example.com",
  phone: "+61 412 345 678",
  amount: 250_000,
  inBusiness: "yes",
  industry: "  Hospitality ",
  purpose: "working-capital",
  creditScore: "ok",
  pageUrl: "https://stoprent.scalbl.io/",
};

describe("createSubmissionId", () => {
  it("is prefixed and unique", () => {
    const ids = new Set(Array.from({ length: 200 }, createSubmissionId));
    expect(ids.size).toBe(200);
    for (const id of ids) expect(id).toMatch(/^sr-[A-Za-z0-9-]{8,}$/);
  });
});

describe("validateLeadRequest", () => {
  it("accepts a complete submission", () => {
    const result = validateLeadRequest(REQUEST);
    expect(result.ok).toBe(true);
  });

  it("trims the free text and keeps the option values", () => {
    const result = validateLeadRequest({ ...REQUEST, name: "  Sam  " });
    expect(result.ok && result.value.name).toBe("Sam");
    expect(result.ok && result.value.industry).toBe("Hospitality");
    expect(result.ok && result.value.purpose).toBe("working-capital");
  });

  it("collects every field error at once", () => {
    const result = validateLeadRequest({
      submissionId: "!",
      name: "",
      email: "nope",
      phone: "123",
      amount: "lots",
      inBusiness: "maybe",
      industry: "   ",
      purpose: "yacht",
      creditScore: "amazing",
      pageUrl: "not-a-url",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors).sort()).toEqual([
      "amount",
      "creditScore",
      "email",
      "inBusiness",
      "industry",
      "name",
      "pageUrl",
      "phone",
      "purpose",
      "submissionId",
    ]);
  });

  it("rejects a non-object body", () => {
    expect(validateLeadRequest(null).ok).toBe(false);
    expect(validateLeadRequest("lead").ok).toBe(false);
  });
});

describe("buildLeadPayload", () => {
  it("maps option values to the labels the spreadsheet shows", () => {
    const validated = validateLeadRequest(REQUEST);
    if (!validated.ok) throw new Error("expected a valid request");
    const payload = buildLeadPayload(validated.value, new Date("2026-09-18T04:05:06.000Z"));

    expect(payload).toEqual({
      submissionId: REQUEST.submissionId,
      submittedAt: "2026-09-18T04:05:06.000Z",
      name: "Sam Tester",
      email: "sam@example.com",
      phone: "0412345678",
      amount: "$250,000",
      inBusiness: "Yes",
      industry: "Hospitality",
      purpose: "Working capital / cash flow",
      creditScore: "OK",
      pageUrl: "https://stoprent.scalbl.io/",
      status: "",
      notes: "",
    });
  });

  it("stamps the timestamp as UTC whatever the local clock offset", () => {
    const payload = buildLeadPayload(REQUEST, new Date(Date.UTC(2026, 0, 2, 3, 4, 5)));
    expect(payload.submittedAt).toBe("2026-01-02T03:04:05.000Z");
  });

  it("leaves STATUS and S.IO NOTES blank for a human to fill in", () => {
    const payload = buildLeadPayload(REQUEST);
    expect(payload.status).toBe("");
    expect(payload.notes).toBe("");
  });
});
