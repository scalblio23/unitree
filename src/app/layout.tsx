import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Need business funding? Get access from $5k - $500k from unique lenders.",
  description:
    "Answer a short quiz to see what business funding you could qualify for, from $5k to $500k.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0f2a4a",
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
