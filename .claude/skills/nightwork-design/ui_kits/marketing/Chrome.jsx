// Public marketing chrome — header + footer
window.PublicHeader = function PublicHeader() {
  return (
    <header style={{ borderBottom: "1px solid var(--nw-border)", background: "rgba(255,255,255,0.9)", backdropFilter: "blur(8px)", position: "sticky", top: 0, zIndex: 40 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <a href="#" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
          <img src="../../assets/nightwork-logo-light.svg" alt="Nightwork" style={{ height: 26 }} />
        </a>
        <nav style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <a href="#" style={{ padding: "6px 12px", fontSize: 13, color: "var(--nw-text-secondary)", textDecoration: "none" }}>Pricing</a>
          <a href="#" style={{ padding: "6px 12px", fontSize: 13, color: "var(--nw-text-secondary)", textDecoration: "none" }}>Sign In</a>
          <a href="#" style={{ padding: "8px 16px", background: "var(--nw-teal)", color: "#fff", fontSize: 12, letterSpacing: ".08em", textTransform: "uppercase", fontWeight: 500, textDecoration: "none" }}>Start Free Trial</a>
        </nav>
      </div>
    </header>
  );
};

window.PublicFooter = function PublicFooter() {
  return (
    <footer style={{ marginTop: "auto", padding: "40px 24px", borderTop: "1px solid var(--nw-border)", background: "#fff" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <p style={{ fontFamily: "var(--nw-display)", fontSize: 14, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--nw-text-primary)", margin: 0 }}>Nightwork</p>
          <p style={{ fontSize: 12, color: "var(--nw-text-secondary)", margin: "4px 0 0" }}>Nightwork makes building lightwork.</p>
          <p style={{ fontSize: 12, color: "var(--nw-text-secondary)", margin: "2px 0 0" }}>jake@nightwork.build</p>
        </div>
        <nav style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 13, color: "var(--nw-text-secondary)" }}>
          <a href="#" style={{ color: "inherit", textDecoration: "none" }}>Pricing</a>
          <a href="#" style={{ color: "inherit", textDecoration: "none" }}>Sign In</a>
          <a href="#" style={{ color: "inherit", textDecoration: "none" }}>Start Free Trial</a>
        </nav>
        <p style={{ fontSize: 11, color: "var(--nw-text-secondary)", margin: 0 }}>© 2026 Nightwork</p>
      </div>
    </footer>
  );
};
