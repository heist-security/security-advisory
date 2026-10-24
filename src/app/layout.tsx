import type { Metadata } from "next";
import { Host_Grotesk, JetBrains_Mono } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import "./globals.css";
const sans = Host_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
});
export const metadata: Metadata = {
  title: {
    default: "Heist Feed — One open security feed",
    template: "%s · Heist Feed",
  },
  description:
    "Security advisories, patches and mitigations in one RSS and JSON feed. Filter by technology, event type, CVE or source.",
  alternates: { types: { "application/rss+xml": "/feed.xml" } },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={sans.variable + " " + mono.variable}>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
