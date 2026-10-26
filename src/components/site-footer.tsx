import { Button } from "./ui/button";

export function SiteFooter() {
  return (
    <footer className="mx-auto mt-auto flex w-full max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 border-t px-4 py-4 text-xs text-muted-foreground sm:px-8">
      <Button asChild variant="link" size="sm" className="h-auto p-0 text-xs">
        <a href="https://heist.security">Heist</a>
      </Button>
      <p>Verify original sources and affected versions.</p>
      <Button
        asChild
        variant="link"
        size="sm"
        className="h-auto p-0 text-xs sm:ml-auto"
      >
        <a href="https://github.com/heist-security/security-advisory/blob/main/SECURITY.md">
          Report a security issue
        </a>
      </Button>
    </footer>
  );
}
