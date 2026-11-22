import Link from "next/link";

export function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 32 32" fill="none">
        <path d="M16 3 27 8v6c0 7.1-4.4 12.2-11 15-6.6-2.8-11-7.9-11-15V8l11-5Z" fill="currentColor" />
        <path d="M16 8v15M10 11h12M9 14h14M11 21h10" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export default function SiteHeader({ active = "registry" }: { active?: "registry" | "manage" | "explore" | "globe" }) {
  return (
    <header className="site-header">
      <div className="masthead">
        <div className="shell masthead-inner">
          <Link href="/" className="brand" aria-label="GovAPI Registry home">
            <BrandMark />
            <span>
              <strong>GovAPI</strong>
              <small>Public Sector Registry</small>
            </span>
          </Link>
          <nav className="primary-nav" aria-label="Primary navigation">
            <Link href="/" className={active === "registry" ? "active" : ""}>Registry</Link>
            <Link href="/globe" className={active === "globe" ? "active" : ""}>Globe</Link>
            <Link href="/explore" className={active === "explore" ? "active" : ""}>Data explorer</Link>
            <Link href="/manage" className={active === "manage" ? "active" : ""}>Manage data</Link>
            <a href="#about">About</a>
          </nav>
        </div>
      </div>
      <div className="service-strip">
        <div className="shell">
          <span className="status-dot" />
          Registry service available
        </div>
      </div>
    </header>
  );
}
