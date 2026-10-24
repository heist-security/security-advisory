export function SiteFooter() {
  return (
    <footer className="site-footer container">
      <div>
        <a href="https://heist.security">Built by Heist ↗</a>
        <p>
          Machine extraction can make mistakes.
          <br />
          Original publishers remain authoritative.
        </p>
      </div>
      <div>
        <a href="/feed">Browse the feed</a>
        <a href="/docs">API documentation</a>
        <a href="/sources">Source coverage</a>
      </div>
      <div>
        <a href="https://github.com/heist-security/security-advisory">
          Source code · MIT
        </a>
        <a href="https://github.com/heist-security/security-advisory/blob/main/SECURITY.md">
          Report a security issue
        </a>
      </div>
    </footer>
  );
}
