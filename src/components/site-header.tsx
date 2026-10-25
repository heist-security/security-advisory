import Image from "next/image";
import Link from "next/link";
import { Button } from "./ui/button";

export function SiteHeader() {
  return (
    <header className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-8">
      <Link
        className="flex items-center gap-3"
        href="/"
        aria-label="Heist Feed home"
      >
        <Image src="/heist-logo.svg" width={77} height={20} alt="Heist" />
        <span className="text-sm text-muted-foreground">/ feed</span>
      </Link>
      <nav
        className="flex flex-wrap items-center gap-1"
        aria-label="Main navigation"
      >
        <Button asChild variant="ghost" size="sm">
          <Link href="/">Feed</Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href="/sources">Sources</Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href="/docs">API docs</Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <a href="https://github.com/heist-security/security-advisory">
            GitHub
          </a>
        </Button>
      </nav>
    </header>
  );
}
