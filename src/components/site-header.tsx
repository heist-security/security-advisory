export function SiteHeader() {
  return <header className="site-header container">
    <a className="brand" href="/" aria-label="Heist Feed home"><img src="/heist-logo.svg" width="92" height="24" alt="Heist" /><span>/ feed</span></a>
    <nav aria-label="Main navigation"><a href="/sources">Sources</a><a href="/docs">API docs</a><a href="https://github.com/heist-security/security-advisory">GitHub ↗</a></nav>
    <a className="button primary header-subscribe" href="/feed.xml">Subscribe via RSS ↗</a>
  </header>;
}
