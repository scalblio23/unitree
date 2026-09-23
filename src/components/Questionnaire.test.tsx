import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Questionnaire } from "./Questionnaire";
import { QualifiedScreen } from "./steps/OutcomeScreens";

type User = ReturnType<typeof userEvent.setup>;

/**
 * The visible counter in the card header. The card also renders the same text
 * in a visually hidden live region, so assertions target this one explicitly.
 */
async function expectStep(n: number) {
  await waitFor(() =>
    expect(document.querySelector(".step-count")).toHaveTextContent(`Step ${n} of 6`),
  );
}

function heading(name: string | RegExp, options?: { timeout: number }) {
  return screen.findByRole("heading", { name }, options);
}

function slider() {
  return screen.getByRole("slider", { name: "Amount to borrow" });
}

/** Drags the slider to a value and lets go, as a pointer user would. */
function dragTo(value: number) {
  const input = slider();
  fireEvent.pointerDown(input);
  fireEvent.change(input, { target: { value: String(value) } });
  fireEvent.pointerUp(input);
}

async function answerIndustry(user: User, industry = "Construction") {
  await user.type(await screen.findByPlaceholderText(/Construction, Retail/), industry);
  await user.click(screen.getByRole("button", { name: "Continue" }));
}

/** Answers every question down the qualifying path, leaving the contact step on screen. */
async function walkToContact(user: User) {
  dragTo(150_000);
  await user.click(await screen.findByRole("button", { name: "Yes" }));
  await answerIndustry(user);
  await user.click(
    await screen.findByRole("button", {
      name: "Equipment or vehicle purchase",
    }),
  );
  await user.click(await screen.findByRole("button", { name: "Good" }));
  return heading("Enter your details to finalise your application");
}

async function fillContact(user: User, name = "Sam Tester") {
  await user.type(screen.getByPlaceholderText("Full name"), name);
  await user.type(screen.getByPlaceholderText("Email"), "sam@example.com");
  await user.type(screen.getByPlaceholderText("Phone"), "0412 345 678");
}

/** The submit button, whose label changes to "Sending…" while a lead is in flight. */
function submitButton() {
  return screen.getByRole("button", { name: /^submit$|sending/i });
}

function accepted() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function rejected(status = 502) {
  return new Response(JSON.stringify({ ok: false, error: "delivery_failed" }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Stubs the lead endpoint and hands back the spy, so calls can be asserted. */
function stubLeadEndpoint(...responses: Array<Response | Error>) {
  const fetchMock = vi.fn(() => Promise.resolve(accepted()));
  for (const response of responses) {
    if (response instanceof Error) fetchMock.mockImplementationOnce(() => Promise.reject(response));
    else fetchMock.mockImplementationOnce(() => Promise.resolve(response));
  }
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** The JSON body of the nth POST to /api/lead. */
function sentLead(fetchMock: ReturnType<typeof stubLeadEndpoint>, call = 0) {
  const [url, init] = fetchMock.mock.calls[call] as unknown as [string, RequestInit];
  expect(url).toBe("/api/lead");
  return JSON.parse(init.body as string);
}

describe("Questionnaire", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe("progression", () => {
    it("opens on the borrowing amount with no Back button", async () => {
      render(<Questionnaire />);
      expect(
        screen.getByRole("heading", {
          name: "How much are you looking to borrow?",
        }),
      ).toBeInTheDocument();
      await expectStep(1);
      expect(screen.queryByRole("button", { name: /back/i })).not.toBeInTheDocument();
    });

    it("moves through every question and shows the counter", async () => {
      const user = userEvent.setup();
      render(<Questionnaire />);

      dragTo(100_000);
      await heading("Do you run a business?");
      await expectStep(2);

      await user.click(screen.getByRole("button", { name: "Yes" }));
      await heading("What industry are you in?");
      await expectStep(3);

      await answerIndustry(user);
      await heading("What is the purpose of the loan?");
      await expectStep(4);

      await user.click(screen.getByRole("button", { name: "Business expansion" }));
      await heading("How would you rate your credit score?");
      await expectStep(5);

      await user.click(screen.getByRole("button", { name: "Great" }));
      await heading("Enter your details to finalise your application");
      await expectStep(6);
    });

    it("offers every loan purpose", async () => {
      const user = userEvent.setup();
      render(<Questionnaire />);
      dragTo(50_000);
      await user.click(await screen.findByRole("button", { name: "Yes" }));
      await answerIndustry(user);
      await heading("What is the purpose of the loan?");

      for (const label of [
        "Working capital / cash flow",
        "Equipment or vehicle purchase",
        "Business expansion",
        "Stock / inventory",
        "Refinance existing debt",
        "Other",
      ]) {
        expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
      }
    });

    it("offers every credit score rating", async () => {
      const user = userEvent.setup();
      render(<Questionnaire />);
      dragTo(50_000);
      await user.click(await screen.findByRole("button", { name: "Yes" }));
      await answerIndustry(user);
      await user.click(await screen.findByRole("button", { name: "Other" }));
      await heading("How would you rate your credit score?");

      for (const label of ["Bad", "OK", "Good", "Great"]) {
        expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
      }
    });

    it("advances on selection without a Continue button", async () => {
      const user = userEvent.setup();
      render(<Questionnaire />);
      dragTo(50_000);
      await heading("Do you run a business?");
      expect(screen.queryByRole("button", { name: "Continue" })).not.toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Yes" }));
      await heading("What industry are you in?");
    });
  });

  describe("borrowing amount slider", () => {
    it("updates the amount live as it moves", () => {
      render(<Questionnaire />);
      expect(screen.getByText("$50,000")).toBeInTheDocument();

      fireEvent.change(slider(), { target: { value: "275000" } });
      expect(screen.getByText("$275,000")).toBeInTheDocument();
      expect(slider()).toHaveAttribute("aria-valuetext", "$275,000");
    });

    it("spans $5,000 to $500,000", () => {
      render(<Questionnaire />);
      expect(slider()).toHaveAttribute("min", "5000");
      expect(slider()).toHaveAttribute("max", "500000");
      expect(screen.getByText("$5,000")).toBeInTheDocument();
      expect(screen.getByText("$500,000+")).toBeInTheDocument();
    });

    it("moves to the next question on its own when the slider is released", async () => {
      render(<Questionnaire />);
      dragTo(320_000);
      // Still on the slider until the short pause after release has elapsed.
      expect(slider()).toBeInTheDocument();
      expect(await heading("Do you run a business?")).toBeInTheDocument();
    });

    it("does not advance while the slider is still being dragged", async () => {
      render(<Questionnaire />);
      fireEvent.pointerDown(slider());
      fireEvent.change(slider(), { target: { value: "120000" } });
      await new Promise((resolve) => setTimeout(resolve, 700));
      expect(slider()).toBeInTheDocument();
    });

    it("advances after keyboard users stop adjusting it", async () => {
      const user = userEvent.setup();
      render(<Questionnaire />);
      slider().focus();
      await user.keyboard("{ArrowRight}");
      expect(await heading("Do you run a business?", { timeout: 2500 })).toBeInTheDocument();
    });

    it("advances straight away on Continue", async () => {
      const user = userEvent.setup();
      render(<Questionnaire />);
      await user.click(screen.getByRole("button", { name: "Continue" }));
      expect(await heading("Do you run a business?")).toBeInTheDocument();
    });

    it("remembers the amount when stepping back", async () => {
      const user = userEvent.setup();
      render(<Questionnaire />);
      dragTo(420_000);
      await heading("Do you run a business?");
      await user.click(screen.getByRole("button", { name: /back/i }));
      await heading("How much are you looking to borrow?");
      expect(slider()).toHaveValue("420000");
    });
  });

  describe("industry", () => {
    it("requires an answer", async () => {
      const user = userEvent.setup();
      render(<Questionnaire />);
      dragTo(50_000);
      await user.click(await screen.findByRole("button", { name: "Yes" }));
      await heading("What industry are you in?");

      await user.type(screen.getByPlaceholderText(/Construction, Retail/), "   ");
      await user.click(screen.getByRole("button", { name: "Continue" }));
      expect(
        await screen.findByText("Please tell us what industry you're in."),
      ).toBeInTheDocument();
      await expectStep(3);
    });

    it("moves on with Enter", async () => {
      const user = userEvent.setup();
      render(<Questionnaire />);
      dragTo(50_000);
      await user.click(await screen.findByRole("button", { name: "Yes" }));
      await user.type(await screen.findByPlaceholderText(/Construction, Retail/), "Retail{Enter}");
      expect(await heading("What is the purpose of the loan?")).toBeInTheDocument();
    });
  });

  describe("back and history", () => {
    it("returns to the previous step and keeps the answer", async () => {
      const user = userEvent.setup();
      render(<Questionnaire />);
      dragTo(50_000);
      await user.click(await screen.findByRole("button", { name: "Yes" }));
      await heading("What industry are you in?");

      await user.click(screen.getByRole("button", { name: /back/i }));
      await heading("Do you run a business?");
      expect(screen.getByRole("button", { name: "Yes" })).toHaveAttribute("aria-pressed", "true");
    });

    it("responds to the browser back button", async () => {
      const user = userEvent.setup();
      render(<Questionnaire />);
      dragTo(50_000);
      await user.click(await screen.findByRole("button", { name: "Yes" }));
      await answerIndustry(user);
      await heading("What is the purpose of the loan?");

      window.history.back();
      expect(await heading("What industry are you in?")).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Construction, Retail/)).toHaveValue("Construction");
    });

    it("hides Back and the counter on the terminal screens", async () => {
      const user = userEvent.setup();
      render(<Questionnaire />);
      dragTo(50_000);
      await user.click(await screen.findByRole("button", { name: "No" }));

      await screen.findByText(/Sorry, it doesn't look like we're able to help/);
      expect(screen.queryByRole("button", { name: /back/i })).not.toBeInTheDocument();
      expect(screen.queryByText(/Step \d of 6/)).not.toBeInTheDocument();
    });
  });

  describe("validation", () => {
    it("requires all three contact fields and sends nothing", async () => {
      const fetchMock = stubLeadEndpoint();
      const user = userEvent.setup();
      render(<Questionnaire />);
      await walkToContact(user);

      await user.click(screen.getByRole("button", { name: "Submit" }));

      expect(fetchMock).not.toHaveBeenCalled();
      expect(await screen.findByText("Please enter your full name.")).toBeInTheDocument();
      expect(screen.getByText("Please enter a valid email address.")).toBeInTheDocument();
      expect(screen.getByText("Please enter a valid Australian phone number.")).toBeInTheDocument();
      await expectStep(6);
    });

    it("treats a whitespace-only name as empty", async () => {
      const user = userEvent.setup();
      render(<Questionnaire />);
      await walkToContact(user);

      await user.type(screen.getByPlaceholderText("Full name"), "   ");
      await user.click(screen.getByRole("button", { name: "Submit" }));
      expect(await screen.findByText("Please enter your full name.")).toBeInTheDocument();
    });

    it("rejects a bad email", async () => {
      const user = userEvent.setup();
      render(<Questionnaire />);
      await walkToContact(user);

      await user.type(screen.getByPlaceholderText("Full name"), "Sam");
      await user.type(screen.getByPlaceholderText("Email"), "sam@example");
      await user.type(screen.getByPlaceholderText("Phone"), "0412345678");
      await user.click(screen.getByRole("button", { name: "Submit" }));

      expect(await screen.findByText("Please enter a valid email address.")).toBeInTheDocument();
      expect(screen.queryByText("Please enter your full name.")).not.toBeInTheDocument();
    });

    it("rejects a phone number that is not Australian", async () => {
      const user = userEvent.setup();
      render(<Questionnaire />);
      await walkToContact(user);

      await user.type(screen.getByPlaceholderText("Full name"), "Sam");
      await user.type(screen.getByPlaceholderText("Email"), "sam@example.com");
      await user.type(screen.getByPlaceholderText("Phone"), "12345");
      await user.click(screen.getByRole("button", { name: "Submit" }));

      expect(
        await screen.findByText("Please enter a valid Australian phone number."),
      ).toBeInTheDocument();
    });

    it("clears a field error as soon as it is edited", async () => {
      const user = userEvent.setup();
      render(<Questionnaire />);
      await walkToContact(user);
      await user.click(screen.getByRole("button", { name: "Submit" }));
      await screen.findByText("Please enter your full name.");

      await user.type(screen.getByPlaceholderText("Full name"), "S");
      expect(screen.queryByText("Please enter your full name.")).not.toBeInTheDocument();
      expect(screen.getByText("Please enter a valid email address.")).toBeInTheDocument();
    });
  });

  describe("disqualification", () => {
    it("ends the flow when they do not run a business", async () => {
      const user = userEvent.setup();
      render(<Questionnaire />);
      dragTo(50_000);
      await user.click(await screen.findByRole("button", { name: "No" }));

      expect(
        await screen.findByText(
          "Sorry, it doesn't look like we're able to help with your situation right now.",
        ),
      ).toBeInTheDocument();
      expect(screen.queryByPlaceholderText("Email")).not.toBeInTheDocument();
    });

    it("ends the flow on a bad credit score", async () => {
      const fetchMock = stubLeadEndpoint();
      const user = userEvent.setup();
      render(<Questionnaire />);
      dragTo(50_000);
      await user.click(await screen.findByRole("button", { name: "Yes" }));
      await answerIndustry(user);
      await user.click(await screen.findByRole("button", { name: "Stock / inventory" }));
      await user.click(await screen.findByRole("button", { name: "Bad" }));

      expect(
        await screen.findByText(/Sorry, it doesn't look like we're able to help/),
      ).toBeInTheDocument();
      expect(screen.queryByPlaceholderText("Email")).not.toBeInTheDocument();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("fills the progress track on the disqualified screen", async () => {
      const user = userEvent.setup();
      const { container } = render(<Questionnaire />);
      dragTo(50_000);
      await user.click(await screen.findByRole("button", { name: "No" }));

      await screen.findByText(/Sorry, it doesn't look like we're able to help/);
      expect(container.querySelector<HTMLElement>(".track-fill")?.style.width).toBe("100%");
    });
  });

  describe("completion", () => {
    it("sends exactly one lead and then shows the thank you screen", async () => {
      const fetchMock = stubLeadEndpoint();
      const user = userEvent.setup();
      const { container } = render(<Questionnaire />);

      await walkToContact(user);
      await fillContact(user);
      await user.click(submitButton());

      expect(
        await heading("Thank you Sam! Your application has been received."),
      ).toBeInTheDocument();
      expect(
        screen.getByText("One of our lending specialists will be in touch with you shortly."),
      ).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(container.querySelector<HTMLElement>(".track-fill")?.style.width).toBe("100%");
      expect(screen.queryByText(/Step \d of 6/)).not.toBeInTheDocument();
    });

    it("sends the survey answers, the contact details and the tracking fields", async () => {
      const fetchMock = stubLeadEndpoint();
      const user = userEvent.setup();
      render(<Questionnaire />);

      await walkToContact(user);
      await fillContact(user);
      await user.click(submitButton());
      await heading(/Thank you Sam/);

      const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
      expect(init.method).toBe("POST");
      expect(sentLead(fetchMock)).toEqual({
        submissionId: expect.stringMatching(/^sr-/),
        name: "Sam Tester",
        email: "sam@example.com",
        phone: "0412 345 678",
        amount: 150_000,
        inBusiness: "yes",
        industry: "Construction",
        purpose: "equipment",
        creditScore: "good",
        pageUrl: window.location.href,
      });
    });

    it("accepts a landline", async () => {
      stubLeadEndpoint();
      const user = userEvent.setup();
      render(<Questionnaire />);
      await walkToContact(user);
      await user.type(screen.getByPlaceholderText("Full name"), "Sam");
      await user.type(screen.getByPlaceholderText("Email"), "sam@example.com");
      await user.type(screen.getByPlaceholderText("Phone"), "(02) 9876 5432");
      await user.click(submitButton());

      expect(await heading(/Thank you Sam/)).toBeInTheDocument();
    });

    it("does not keep the contact details after completing", async () => {
      stubLeadEndpoint();
      const user = userEvent.setup();
      render(<Questionnaire />);
      await walkToContact(user);
      await fillContact(user);
      await user.click(submitButton());
      await heading(/Thank you Sam/);

      // Going back lands on an empty form rather than a repopulated one.
      window.history.back();
      await waitFor(() => expect(screen.getByPlaceholderText("Email")).toHaveValue(""));
      expect(screen.getByPlaceholderText("Phone")).toHaveValue("");
      expect(screen.getByPlaceholderText("Full name")).toHaveValue("");
    });

    it("reads correctly when no name was captured", () => {
      render(<QualifiedScreen headingId="heading" firstName="  " />);
      expect(
        screen.getByRole("heading", { name: /^Thank you! Your application/ }),
      ).toBeInTheDocument();
    });
  });

  describe("duplicate submit protection", () => {
    it("ignores a second click while the lead is in flight", async () => {
      let release: (value: Response) => void = () => {};
      const fetchMock = vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            release = resolve;
          }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const user = userEvent.setup();
      render(<Questionnaire />);
      await walkToContact(user);
      await fillContact(user);

      await user.click(submitButton());
      const busy = submitButton();
      expect(busy).toBeDisabled();
      expect(busy).toHaveTextContent("Sending");

      await user.click(busy);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      release(accepted());
      expect(await screen.findByRole("heading", { name: /Thank you Sam/ })).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("reuses the submission id when a failed lead is retried", async () => {
      const fetchMock = stubLeadEndpoint(rejected());
      const user = userEvent.setup();
      render(<Questionnaire />);
      await walkToContact(user);
      await fillContact(user);

      await user.click(submitButton());
      await screen.findByRole("alert");

      await user.click(submitButton());
      await screen.findByRole("heading", { name: /Thank you Sam/ });

      expect(fetchMock).toHaveBeenCalledTimes(2);
      // The server de-duplicates on this id, so a retried lead cannot become
      // a second row in the spreadsheet.
      expect(sentLead(fetchMock, 1).submissionId).toBe(sentLead(fetchMock, 0).submissionId);
    });
  });

  describe("delivery failure", () => {
    it("keeps the visitor on the step and shows an error when the lead is rejected", async () => {
      stubLeadEndpoint(rejected());
      const user = userEvent.setup();
      render(<Questionnaire />);
      await walkToContact(user);
      await fillContact(user);

      await user.click(submitButton());

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("Sorry, we couldn't send your details. Please try again.");
      // The server's reason is shown so a failed submission can be diagnosed.
      expect(alert).toHaveTextContent("(ref: delivery_failed-502)");
      expect(screen.queryByRole("heading", { name: /Thank you/ })).not.toBeInTheDocument();
      expect(
        screen.getByRole("heading", {
          name: "Enter your details to finalise your application",
        }),
      ).toBeInTheDocument();
      await expectStep(6);
    });

    it("shows the same error when the request never reaches the server", async () => {
      stubLeadEndpoint(new Error("network down"));
      const user = userEvent.setup();
      render(<Questionnaire />);
      await walkToContact(user);
      await fillContact(user);

      await user.click(submitButton());

      expect(await screen.findByRole("alert")).toHaveTextContent("(ref: network)");
      expect(await screen.findByRole("alert")).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: /Thank you/ })).not.toBeInTheDocument();
    });

    it("keeps the typed details so the visitor can simply retry", async () => {
      stubLeadEndpoint(rejected(500));
      const user = userEvent.setup();
      render(<Questionnaire />);
      await walkToContact(user);
      await fillContact(user);

      await user.click(submitButton());
      await screen.findByRole("alert");

      expect(screen.getByPlaceholderText("Full name")).toHaveValue("Sam Tester");
      expect(screen.getByPlaceholderText("Email")).toHaveValue("sam@example.com");
      expect(screen.getByPlaceholderText("Phone")).toHaveValue("0412 345 678");
      expect(submitButton()).toBeEnabled();
    });

    it("clears the error on a successful retry", async () => {
      stubLeadEndpoint(rejected());
      const user = userEvent.setup();
      render(<Questionnaire />);
      await walkToContact(user);
      await fillContact(user);

      await user.click(submitButton());
      await screen.findByRole("alert");
      await user.click(submitButton());

      expect(await screen.findByRole("heading", { name: /Thank you Sam/ })).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });
});
