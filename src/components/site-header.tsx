export function SiteHeader() {
  return (
    <header className="site-header site-container">
      <a className="brand" href="/" aria-label="Heist Feed home">
        <img src="/heist-logo.svg" width="77" height="20" alt="Heist" />
        <span>/ feed</span>
      </a>
      <nav aria-label="Main navigation">
        <a href="/">Feed</a>
        <a href="/sources">Sources</a>
        <a href="/docs">API docs</a>
        <a href="https://github.com/heist-security/security-advisory">GitHub</a>
      </nav>
    </header>
  );
}
