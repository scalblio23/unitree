# Business funding survey landing page

A responsive single-page landing experience with a six-step qualifying survey for business
funding from $5k to $500k.

A completed survey sends **exactly one lead** to a Make webhook, which appends a row to the
`76 - Goal Finance - Business Funding` tab of CLIENT LEAD LIST - Tracker. The webhook URL is
built into `src/app/api/lead/route.ts`, is read only on the server and is never exposed to the
browser; no environment variable is needed. There is no CRM, SMS integration, tracking pixel or analytics.

## Stack

| Concern    | Choice                                             |
| ---------- | -------------------------------------------------- |
| Framework  | Next.js 16 (App Router) on React 19                |
| Language   | TypeScript, `strict`                               |
| Styling    | Plain CSS with custom properties (`globals.css`)   |
| Tests      | Vitest + Testing Library (jsdom)                   |
| Lint       | ESLint 9 with `eslint-config-next`                 |
| Deployment | Vercel, no environment variables required           |

## Running it

```bash
npm install
npm run dev        # http://localhost:3000
```

```bash
npm run build      # production build
npm start          # serve the production build
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm run test       # Vitest, single run
npm run test:watch # Vitest in watch mode
```

## Page structure

Navy brand bar → "Business Funding" label → headline → `T+C's Apply` → quiz CTA → questionnaire
card → social proof → footer. Navy (`#0f2a4a`) and green (`#0e9f6e`) on a soft grey gradient,
Montserrat (500/600/700/800) from Google Fonts with an Arial fallback, single centred column.

The Google Fonts stylesheet is the only remote request the page itself makes; the lead goes to
the app's own `/api/lead` route, which talks to Make server-side.

## The flow

| Step | Question | Input |
| ---- | -------- | ----- |
| 1 | How much are you looking to borrow? | Slider, $5,000 – $500,000 in $5,000 steps |
| 2 | Do you run a business? | Yes / No |
| 3 | What industry are you in? | Short text, Continue or Enter |
| 4 | What is the purpose of the loan? | Working capital / cash flow, Equipment or vehicle purchase, Business expansion, Stock / inventory, Refinance existing debt, Other |
| 5 | How would you rate your credit score? | Bad, OK, Good, Great |
| 6 | Enter your details to finalise your application | Full name + email + phone, Submit |

**Auto-advance.** Choice steps move on as soon as an option is clicked. The slider's figure updates
live while dragging and moves on by itself 450 ms after the slider is released; keyboard users
get 1.2 s after their last arrow-key nudge, and Enter or the Continue button advances immediately.
The free-text industry step needs Continue or Enter. Each new step slides in from the right.

**Branches.** Answering No at step 2 or Bad at step 5 goes straight to the disqualified screen
and no lead is sent. Every other answer continues to the next step.

**Outcomes.** Qualified shows a green badge and a personalised thank you. Disqualified shows the
apology message and no contact form. Both fill the progress track and hide the step counter and
Back button.

**Progress.** Step 1 starts the track empty; each step adds a sixth; both outcomes fill it.

**Back.** Every forward move pushes a history entry, and the card's Back button calls
`history.back()`, so the button and the browser control cannot drift apart. Answers, including the
slider amount and the industry text, are retained when stepping back. Back is hidden on step 1 and
on both outcome screens.

**Validation.** The industry step requires a non-blank answer. On the contact step:
`Please enter your full name.` (trimmed), `Please enter a valid email address.`, and
`Please enter a valid Australian phone number.` — numbers are stripped to digits, a leading
`+61`/`61` becomes `0`, then a mobile (`04`) or landline (`02`, `03`, `07`, `08`) plus eight digits
is required. Errors are inline and announced, never browser alerts, and each clears as its field
is edited.

## Accessibility

Semantic forms and buttons throughout; toggle options expose `aria-pressed`; inputs have real
labels (visually hidden, since the visible text is a placeholder); errors are wired up with
`aria-invalid` and `aria-describedby`; step changes go through a live region and move focus to the
new question; Enter submits on the contact step; a visible focus ring is kept on every control;
and all animation is disabled under `prefers-reduced-motion`.

## Layout

| Source | Purpose |
| ------ | ------- |
| `src/app/page.tsx` | Page content |
| `src/app/layout.tsx` | Document shell, metadata, Google Fonts link |
| `src/app/globals.css` | All styling |
| `src/components/Questionnaire.tsx` | The card: history, progress, step routing |
| `src/components/steps/` | One component per step and the outcome screens |
| `src/lib/funnel/steps.ts` | Step order, options, progress arithmetic |
| `src/lib/funnel/machine.ts` | Pure reducer: answers, branching, back stack |
| `src/lib/funnel/validation.ts` | Name, email, industry and Australian phone rules |
| `src/lib/lead/submission.ts` | Lead types, server-side validation, payload builder |
| `src/app/api/lead/route.ts` | The server route that posts the lead to Make |

The funnel logic is a pure reducer with no React or DOM dependency, so the sequencing and branching
are tested directly.

## The lead

The contact step posts to `/api/lead`; the route validates the body again, stamps a UTC timestamp
and posts one flat JSON object to the Make webhook.

| Payload field | Notes |
| ------------- | ----- |
| `submittedAt` | ISO 8601, UTC, from the server clock |
| `name` | Full name, trimmed |
| `email` | Lower-cased |
| `phone` | Normalised to 10 digits, e.g. `0412345678` |
| `amount` | Formatted, e.g. `$150,000` |
| `inBusiness` | `Yes` |
| `industry` | Free text, trimmed, up to 100 characters |
| `purpose` | The option's label, e.g. `Business expansion` |
| `creditScore` | `OK` / `Good` / `Great` |
| `status` | Always blank — filled in by hand |
| `notes` | Always blank — filled in by hand |
| `pageUrl` | `window.location.href` at submit time |
| `submissionId` | Unique per completed form, stable across retries |

**Exactly once.** The browser generates the submission id and keeps it across retries; the button
is disabled while a request is in flight and a synchronous ref guards a same-tick double click. The
route remembers delivered ids for ten minutes and shares one webhook call between racing requests,
so a retry of a lead whose response was lost cannot become a second row.

**Never a false success.** The thank you screen is shown only after the route answers `2xx`.
A webhook that rejects or stays down is a `502`, which leaves the visitor on the contact step
with their details intact and an inline error ending in a short reference such as
`(ref: delivery_failed-502)` so a failure can be diagnosed. The route
retries timeouts, network errors, `429` and `5xx` three times with backoff; a `4xx` from Make is
not retried.

## Configuration

None required. `MAKE_WEBHOOK_URL` is optional and, if set, overrides the built-in webhook.

## Tests

122 tests across five files. The funnel tests cover progression through all six steps, the slider
(live figure, range, auto-advance on release, no advance mid-drag, keyboard and Continue), every
option on every question, Back and browser-history navigation, answer retention, both
disqualification branches, and industry, name, email and phone validation. The lead tests cover a
successful submission and its exact payload, server-side rejection of every invalid field,
duplicate-submit protection in both the browser and the route, and the failure behaviour above —
including that no thank you screen is ever shown for a lead that was not delivered.
