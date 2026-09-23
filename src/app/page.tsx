import { Questionnaire } from "@/components/Questionnaire";

export default function Page() {
  return (
    <main className="page">
      <div className="column">
        <h1 className="headline">
          Stop renting! Victorian first home buyers are accessing new homes with $20k–$90k off and
          $0 deposit
        </h1>

        <p className="terms">T+C&apos;s Apply</p>

        <p className="cta">
          Complete the short survey below to see if you qualify for your first home now.
        </p>

        <Questionnaire />

        <p className="social-proof">
          We&apos;ve helped 100&apos;s of Aussies get their finances back on track!
        </p>

        <p className="footer">© Goal Finance. All Rights Reserved.</p>
      </div>
    </main>
  );
}
