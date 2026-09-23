import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title:
    "Stop renting! Victorian first home buyers are accessing new homes with $20k–$90k off and $0 deposit",
  description:
    "Answer a short survey to see what you could qualify for as a first home buyer in Victoria.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#eceef0",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU">
      <head>
        {/* Loaded by the browser at runtime rather than bundled at build time. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* The no-page-custom-font rule targets the Pages Router's _document;
            in an App Router root layout this link already covers every page. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700;800&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
