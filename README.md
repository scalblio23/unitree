# First home buyer survey landing page

A responsive single-page landing experience with a four-step qualifying survey, built for a
Victorian first home buyer offer.

A completed survey sends **exactly one lead** to a Make webhook, which appends a row to the
`74 - StopRent` worksheet. The webhook URL is server-only: it lives in the `MAKE_WEBHOOK_URL`
environment variable, is read only by `src/app/api/lead/route.ts`, and is never exposed to the
browser. No secret is committed. There is no CRM, SMS integration, tracking pixel or analytics.

## Stack

| Concern    | Choice                                             |
| ---------- | -------------------------------------------------- |
| Framework  | Next.js 16 (App Router) on React 19                |
| Language   | TypeScript, `strict`                               |
| Styling    | Plain CSS with custom properties (`globals.css`)   |
| Tests      | Vitest + Testing Library (jsdom)                   |
| Lint       | ESLint 9 with `eslint-config-next`                 |
| Deployment | Vercel (`MAKE_WEBHOOK_URL` is the only variable)    |

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

Headline → `T+C's Apply` → survey CTA → questionnaire card → social proof → footer.
Background `#eceef0`, Montserrat (500/600/700/800) from Google Fonts with an Arial fallback, single
centred column, no header or nav.

The Google Fonts stylesheet is the only remote request the page itself makes; the lead goes to
the app's own `/api/lead` route, which talks to Make server-side.

## The flow

| Step | Question | Input |
| ---- | -------- | ----- |
| 1 | Are you looking to buy your first home? | Yes / No, auto-advance |
| 2 | Describe your situation | Full time, Part time, Self employed, Government Assistance |
| 3 | What is your combined household income? (both partners) | Under $120k, $120k – $150k, $150k – $200k, $200k+ |
| 4 | Where should we send your offer? | Name + email + mobile, See My Offer |

**Branches.** Answering No at step 1 goes straight to the disqualified screen. Every situation and
income answer continues to the next step.

**Outcomes.** Qualified shows a green badge, personalised copy and a mock scheduler — a deliberately
inert stand-in for the live booking calendar that makes no network call and states plainly that
nothing is booked. Disqualified shows the apology message and no contact form. Both fill the
progress track and hide the step counter and Back button.

**Progress.** Step 1 starts the track empty; each step adds a quarter; both outcomes fill it.

**Back.** Every forward move pushes a history entry, and the card's Back button calls
`history.back()`, so the button and the browser control cannot drift apart. Answers are retained
when stepping back. Back is hidden on step 1 and on both outcome screens.

**Validation.** All on the contact step: `Please enter your name.` (trimmed),
`Please enter a valid email address.`, and `Please enter a valid Australian mobile number.` —
mobiles are stripped to digits, a leading `+61`/`61` becomes `0`, then `04` plus eight digits is
required. Errors are inline and announced, never browser alerts, and each clears as its field is
edited.

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
| `src/components/MockScheduler.tsx` | Inert stand-in for the booking calendar |
| `src/lib/funnel/steps.ts` | Step order, options, progress arithmetic |
| `src/lib/funnel/machine.ts` | Pure reducer: answers, branching, back stack |
| `src/lib/funnel/validation.ts` | Name, email and Australian mobile rules |
| `src/lib/lead/submission.ts` | Lead types, server-side validation, payload builder |
| `src/app/api/lead/route.ts` | The server route that posts the lead to Make |

The funnel logic is a pure reducer with no React or DOM dependency, so the sequencing and branching
are tested directly.

## The lead

The contact step posts to `/api/lead`; the route validates the body again, stamps a UTC timestamp
and posts one flat JSON object to `MAKE_WEBHOOK_URL`.

| Payload field | Sheet column | Notes |
| ------------- | ------------ | ----- |
| `submittedAt` | DATE | ISO 8601, UTC, from the server clock |
| `name` | NAME | Trimmed |
| `email` | EMAIL | Lower-cased |
| `mobile` | PHONE | Normalised to `04xxxxxxxx` |
| `income` | INCOME | The option's label, e.g. `$150k – $200k` |
| `situation` | SITUATION | The option's label, e.g. `Full time` |
| `firstHome` | FIRST HOME | `Yes` / `No` |
| `status` | STATUS | Always blank — filled in by hand |
| `notes` | S.IO NOTES | Always blank — filled in by hand |
| `pageUrl` | PAGE URL | `window.location.href` at submit time |
| `submissionId` | SUBMISSION ID | Unique per completed form, stable across retries |

**Exactly once.** The browser generates the submission id and keeps it across retries; the button
is disabled while a request is in flight and a synchronous ref guards a same-tick double click. The
route remembers delivered ids for ten minutes and shares one webhook call between racing requests,
so a retry of a lead whose response was lost cannot become a second row.

**Never a false success.** The congratulations screen is shown only after the route answers `2xx`.
A missing `MAKE_WEBHOOK_URL` is a `500`, a webhook that rejects or stays down is a `502`, and both
leave the visitor on the contact step with their details intact and an inline error. The route
retries timeouts, network errors, `429` and `5xx` three times with backoff; a `4xx` from Make is
not retried.

## Configuration

`MAKE_WEBHOOK_URL` — the Make webhook the lead is posted to. Set it in the Vercel project's
environment variables and, for local development, in `.env.local`. See `.env.example`.

## Tests

96 tests across five files. The funnel tests cover progression through all four steps, every option
on every question, Back and browser-history navigation, answer retention, the disqualification
branch, and name, email and mobile validation. The lead tests cover a successful submission and its
exact payload, server-side rejection of every invalid field, duplicate-submit protection in both
the browser and the route, and the failure behaviour above — including that no success screen is
ever shown for a lead that was not delivered.
