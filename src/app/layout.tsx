import type { Metadata } from "next";
import { Host_Grotesk, JetBrains_Mono } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import "./globals.css";
const sans = Host_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-host-grotesk",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains-mono",
});
export const metadata: Metadata = {
  title: {
    default: "Heist Feed",
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
      <body className="flex min-h-screen flex-col antialiased">
        <a
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-background focus:p-3 focus:ring-2 focus:ring-ring"
          href="#main"
        >
          Skip to content
        </a>
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
