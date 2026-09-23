import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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
    expect(document.querySelector(".step-count")).toHaveTextContent(`Step ${n} of 4`),
  );
}

/** Answers steps 1-3 down the qualifying path, leaving step 4 on screen. */
async function walkToContact(user: User) {
  await user.click(await screen.findByRole("button", { name: "Yes" }));
  await user.click(await screen.findByRole("button", { name: "Full time" }));
  await user.click(await screen.findByRole("button", { name: "$150k – $200k" }));
  return screen.findByRole("heading", { name: "Where should we send your offer?" });
}

async function fillContact(user: User, name = "Sam") {
  await user.type(screen.getByPlaceholderText("Your name"), name);
  await user.type(screen.getByPlaceholderText("Email address"), "sam@example.com");
  await user.type(screen.getByPlaceholderText("Mobile number"), "0412 345 678");
}

/** The submit button, whose label changes to "Sending…" while a lead is in flight. */
function submitButton() {
  return screen.getByRole("button", { name: /see my offer|sending/i });
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
    it("opens on the first home question with no Back button", async () => {
      render(<Questionnaire />);
      expect(
        screen.getByRole("heading", { name: "Are you looking to buy your first home?" }),
      ).toBeInTheDocument();
      await expectStep(1);
      expect(screen.queryByRole("button", { name: /back/i })).not.toBeInTheDocument();
    });

    it("moves through all four steps and shows the counter", async () => {
      const user = userEvent.setup();
      render(<Questionnaire />);

      await user.click(screen.getByRole("button", { name: "Yes" }));
      expect(
        await screen.findByRole("heading", { name: "Describe your situation" }),
      ).toBeInTheDocument();
      await expectStep(2);

      await user.click(screen.getByRole("button", { name: "Part time" }));
      expect(
        await screen.findByRole("heading", {
          name: "What is your combined household income? (both partners)",
        }),
      ).toBeInTheDocument();
      await expectStep(3);

      await user.click(screen.getByRole("button", { name: "Under $120k" }));
      expect(
        await screen.findByRole("heading", { name: "Where should we send your offer?" }),
      ).toBeInTheDocument();
      await expectStep(4);
    });

    it("offers every situation option", async () => {
      const user = userEvent.setup();
      render(<Questionnaire />);
      await user.click(screen.getByRole("button", { name: "Yes" }));
      await screen.findByRole("heading", { name: "Describe your situation" });

      for (const label of ["Full time", "Part time", "Self employed", "Government Assistance"]) {
        expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
      }
    });

    it("offers every income band", async () => {
      const user = userEvent.setup();
      render(<Questionnaire />);
      await user.click(screen.getByRole("button", { name: "Yes" }));
      await user.click(await screen.findByRole("button", { name: "Self employed" }));
      await screen.findByRole("heading", { name: /combined household income/ });

      for (const label of ["Under $120k", "$120k – $150k", "$150k – $200k", "$200k+"]) {
        expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
      }
    });

    it("advances on selection without a Continue button", async () => {
      const user = userEvent.setup();
      render(<Questionnaire />);
      expect(screen.queryByRole("button", { name: "Continue" })).not.toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Yes" }));
      await screen.findByRole("heading", { name: "Describe your situation" });
      expect(screen.queryByRole("button", { name: "Continue" })).not.toBeInTheDocument();
    });
  });

  describe("back and history", () => {
    it("returns to the previous step and keeps the answer", async () => {
      const user = userEvent.setup();
      render(<Questionnaire />);
      await user.click(screen.getByRole("button", { name: "Yes" }));
      await screen.findByRole("heading", { name: "Describe your situation" });

      await user.click(screen.getByRole("button", { name: /back/i }));
      await screen.findByRole("heading", { name: "Are you looking to buy your first home?" });
      expect(screen.getByRole("button", { name: "Yes" })).toHaveAttribute("aria-pressed", "true");
    });

    it("responds to the browser back button", async () => {
      const user = userEvent.setup();
      render(<Questionnaire />);
      await user.click(screen.getByRole("button", { name: "Yes" }));
      await user.click(await screen.findByRole("button", { name: "Full time" }));
      await screen.findByRole("heading", { name: /combined household income/ });

      window.history.back();
      expect(
        await screen.findByRole("heading", { name: "Describe your situation" }),
      ).toBeInTheDocument();
    });

    it("hides Back and the counter on the terminal screens", async () => {
      const user = userEvent.setup();
      render(<Questionnaire />);
      await user.click(screen.getByRole("button", { name: "No" }));

      await screen.findByText(/Sorry, it doesn't look like we're able to help/);
      expect(screen.queryByRole("button", { name: /back/i })).not.toBeInTheDocument();
      expect(screen.queryByText(/Step \d of 4/)).not.toBeInTheDocument();
    });
  });

  describe("validation", () => {
    it("requires all three contact fields and sends nothing", async () => {
      const fetchMock = stubLeadEndpoint();
      const user = userEvent.setup();
      render(<Questionnaire />);
      await walkToContact(user);

      await user.click(screen.getByRole("button", { name: "See My Offer" }));

      expect(fetchMock).not.toHaveBeenCalled();
      expect(await screen.findByText("Please enter your name.")).toBeInTheDocument();
      expect(screen.getByText("Please enter a valid email address.")).toBeInTheDocument();
      expect(
        screen.getByText("Please enter a valid Australian mobile number."),
      ).toBeInTheDocument();
      await expectStep(4);
    });

    it("treats a whitespace-only name as empty", async () => {
      const user = userEvent.setup();
      render(<Questionnaire />);
      await walkToContact(user);

      await user.type(screen.getByPlaceholderText("Your name"), "   ");
      await user.click(screen.getByRole("button", { name: "See My Offer" }));
      expect(await screen.findByText("Please enter your name.")).toBeInTheDocument();
    });

    it("rejects a bad email", async () => {
      const user = userEvent.setup();
      render(<Questionnaire />);
      await walkToContact(user);

      await user.type(screen.getByPlaceholderText("Your name"), "Sam");
      await user.type(screen.getByPlaceholderText("Email address"), "sam@example");
      await user.type(screen.getByPlaceholderText("Mobile number"), "0412345678");
      await user.click(screen.getByRole("button", { name: "See My Offer" }));

      expect(await screen.findByText("Please enter a valid email address.")).toBeInTheDocument();
      expect(screen.queryByText("Please enter your name.")).not.toBeInTheDocument();
    });

    it("rejects a landline number", async () => {
      const user = userEvent.setup();
      render(<Questionnaire />);
      await walkToContact(user);

      await user.type(screen.getByPlaceholderText("Your name"), "Sam");
      await user.type(screen.getByPlaceholderText("Email address"), "sam@example.com");
      await user.type(screen.getByPlaceholderText("Mobile number"), "0298765432");
      await user.click(screen.getByRole("button", { name: "See My Offer" }));

      expect(
        await screen.findByText("Please enter a valid Australian mobile number."),
      ).toBeInTheDocument();
    });

    it("clears a field error as soon as it is edited", async () => {
      const user = userEvent.setup();
      render(<Questionnaire />);
      await walkToContact(user);
      await user.click(screen.getByRole("button", { name: "See My Offer" }));
      await screen.findByText("Please enter your name.");

      await user.type(screen.getByPlaceholderText("Your name"), "S");
      expect(screen.queryByText("Please enter your name.")).not.toBeInTheDocument();
      expect(screen.getByText("Please enter a valid email address.")).toBeInTheDocument();
    });
  });

  describe("disqualification", () => {
    it("ends the flow on No", async () => {
      const user = userEvent.setup();
      render(<Questionnaire />);
      await user.click(screen.getByRole("button", { name: "No" }));

      expect(
        await screen.findByText(
          "Sorry, it doesn't look like we're able to help with your situation right now.",
        ),
      ).toBeInTheDocument();
      expect(screen.queryByPlaceholderText("Email address")).not.toBeInTheDocument();
    });

    it("fills the progress track on the disqualified screen", async () => {
      const user = userEvent.setup();
      const { container } = render(<Questionnaire />);
      await user.click(screen.getByRole("button", { name: "No" }));

      await screen.findByText(/Sorry, it doesn't look like we're able to help/);
      expect(container.querySelector<HTMLElement>(".track-fill")?.style.width).toBe("100%");
    });
  });


  describe("completion", () => {
    it("sends exactly one lead and then shows the success screen", async () => {
      const fetchMock = stubLeadEndpoint();
      const user = userEvent.setup();
      const { container } = render(<Questionnaire />);

      await user.click(screen.getByRole("button", { name: "Yes" }));
      await user.click(await screen.findByRole("button", { name: "Self employed" }));
      await user.click(await screen.findByRole("button", { name: "$200k+" }));
      await screen.findByRole("heading", { name: "Where should we send your offer?" });
      await fillContact(user, "Sam");
      await user.click(submitButton());

      expect(
        await screen.findByRole("heading", { name: /Congrats Sam, we can help!/ }),
      ).toBeInTheDocument();
      expect(screen.getByText("No cost. No obligation.")).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(container.querySelector<HTMLElement>(".track-fill")?.style.width).toBe("100%");
      expect(screen.queryByText(/Step \d of 4/)).not.toBeInTheDocument();
    });

    it("sends the survey answers, the contact details and the tracking fields", async () => {
      const fetchMock = stubLeadEndpoint();
      const user = userEvent.setup();
      render(<Questionnaire />);

      await walkToContact(user);
      await fillContact(user, "Sam");
      await user.click(submitButton());
      await screen.findByRole("heading", { name: /Congrats Sam/ });

      const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
      expect(init.method).toBe("POST");
      expect(sentLead(fetchMock)).toEqual({
        submissionId: expect.stringMatching(/^sr-/),
        name: "Sam",
        email: "sam@example.com",
        mobile: "0412 345 678",
        firstHome: "yes",
        situation: "full-time",
        income: "150k-200k",
        pageUrl: window.location.href,
      });
    });

    it("accepts a +61 mobile", async () => {
      stubLeadEndpoint();
      const user = userEvent.setup();
      render(<Questionnaire />);
      await walkToContact(user);
      await user.type(screen.getByPlaceholderText("Your name"), "Sam");
      await user.type(screen.getByPlaceholderText("Email address"), "sam@example.com");
      await user.type(screen.getByPlaceholderText("Mobile number"), "+61 412 345 678");
      await user.click(submitButton());

      expect(await screen.findByRole("heading", { name: /Congrats Sam/ })).toBeInTheDocument();
    });

    it("does not keep the contact details after completing", async () => {
      stubLeadEndpoint();
      const user = userEvent.setup();
      render(<Questionnaire />);
      await walkToContact(user);
      await fillContact(user);
      await user.click(submitButton());
      await screen.findByRole("heading", { name: /Congrats Sam/ });

      // Going back lands on an empty form rather than a repopulated one.
      window.history.back();
      await waitFor(() => expect(screen.getByPlaceholderText("Email address")).toHaveValue(""));
      expect(screen.getByPlaceholderText("Mobile number")).toHaveValue("");
      expect(screen.getByPlaceholderText("Your name")).toHaveValue("");
    });

    it("offers a mock scheduler that books nothing", async () => {
      const fetchMock = stubLeadEndpoint();
      const user = userEvent.setup();
      render(<Questionnaire />);

      await walkToContact(user);
      await fillContact(user);
      await user.click(submitButton());
      await screen.findByRole("heading", { name: /Congrats Sam/ });
      expect(fetchMock).toHaveBeenCalledTimes(1);

      await user.click(screen.getByRole("button", { name: /9:30 am/ }));
      await user.click(screen.getByRole("button", { name: "Confirm time" }));

      expect(await screen.findByText(/was not booked/)).toBeInTheDocument();
      // The lead is the page's only network call; the scheduler adds none.
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("reads correctly when no name was captured", () => {
      render(<QualifiedScreen headingId="heading" firstName="  " />);
      expect(screen.getByRole("heading", { name: /^Congrats, we can help!/ })).toBeInTheDocument();
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
      expect(await screen.findByRole("heading", { name: /Congrats Sam/ })).toBeInTheDocument();
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
      await screen.findByRole("heading", { name: /Congrats Sam/ });

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

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Sorry, we couldn't send your details. Please try again.",
      );
      expect(screen.queryByRole("heading", { name: /Congrats/ })).not.toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: "Where should we send your offer?" }),
      ).toBeInTheDocument();
      await expectStep(4);
    });

    it("shows the same error when the request never reaches the server", async () => {
      stubLeadEndpoint(new Error("network down"));
      const user = userEvent.setup();
      render(<Questionnaire />);
      await walkToContact(user);
      await fillContact(user);

      await user.click(submitButton());

      expect(await screen.findByRole("alert")).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: /Congrats/ })).not.toBeInTheDocument();
    });

    it("keeps the typed details so the visitor can simply retry", async () => {
      stubLeadEndpoint(rejected(500));
      const user = userEvent.setup();
      render(<Questionnaire />);
      await walkToContact(user);
      await fillContact(user);

      await user.click(submitButton());
      await screen.findByRole("alert");

      expect(screen.getByPlaceholderText("Your name")).toHaveValue("Sam");
      expect(screen.getByPlaceholderText("Email address")).toHaveValue("sam@example.com");
      expect(screen.getByPlaceholderText("Mobile number")).toHaveValue("0412 345 678");
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

      expect(await screen.findByRole("heading", { name: /Congrats Sam/ })).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });
});
