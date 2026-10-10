import type { Metadata } from "next";
import { Instrument_Serif, Inter } from "next/font/google";
import { SiteShell } from "@/components/layout/SiteShell";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const instrument = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument",
  display: "swap",
});

export const metadata: Metadata = {
  title: "KORIA — Private Travel, Simplified.",
  description:
    "The smarter way to discover, coordinate, and experience private aviation. KORIA is the consumer layer for private travel.",
  keywords: ["private aviation", "private jet", "KORIA", "charter", "concierge"],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${instrument.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-ink font-sans text-ivory">
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}
