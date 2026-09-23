import { Questionnaire } from "@/components/Questionnaire";

export default function Page() {
  return (
    <main className="page">
      <header className="brand-bar">
        <span className="brand-name">Unitree Finance</span>
      </header>

      <div className="column">
        <p className="eyebrow">Business Funding</p>

        <h1 className="headline">
          Need business funding? Get access from{" "}
          <span className="headline-accent">$5k&nbsp;-&nbsp;$500k</span> from unique lenders.
        </h1>

        <p className="terms">T+C&apos;s Apply</p>

        <p className="cta">Complete the short quiz now to qualify.</p>

        <Questionnaire />

        <p className="social-proof">
          We&apos;ve helped 100&apos;s of Aussies get their finances back on track!
        </p>

        <p className="footer">© Goal Finance. All Rights Reserved.</p>
      </div>
    </main>
  );
}
