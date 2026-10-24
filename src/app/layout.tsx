import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Heist Feed — Security changes, in one place",
  description: "An open feed of security advisories, patches and mitigations, with original sources.",
  alternates: { types: { "application/rss+xml": "/feed.xml" } },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
