// Hero + feature sections
window.Hero = function Hero() {
  return (
    <section style={{ background: "var(--nw-page)", padding: "80px 24px 60px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", textAlign: "center" }}>
        <span style={{ display: "inline-block", fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--nw-text-secondary)", fontWeight: 500, marginBottom: 16 }}>
          For Custom Home Builders
        </span>
        <h1 style={{ fontFamily: "var(--nw-display)", fontWeight: 400, fontSize: 64, lineHeight: 1.05, letterSpacing: "-0.02em", color: "var(--nw-text-primary)", margin: 0, maxWidth: 900, marginInline: "auto" }}>
          Nightwork makes building lightwork.
        </h1>
        <p style={{ fontSize: 17, color: "var(--nw-text-secondary)", margin: "20px auto 0", maxWidth: 620, lineHeight: 1.5 }}>
          Job cost accounting, AIA draws, and invoice parsing for custom home builders running $1.5M to $10M+ projects. Built for the jobsite and the back office.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 32, flexWrap: "wrap" }}>
          <a href="#" style={{ padding: "14px 28px", background: "var(--nw-teal)", color: "#fff", fontSize: 13, letterSpacing: ".08em", textTransform: "uppercase", fontWeight: 500, textDecoration: "none" }}>Start Free Trial</a>
          <a href="#" style={{ padding: "14px 4px", color: "var(--nw-text-primary)", fontSize: 13, letterSpacing: ".08em", textTransform: "uppercase", fontWeight: 500, textDecoration: "none", borderBottom: "1px solid rgba(63,88,98,.4)" }}>See how it works →</a>
        </div>
        <p style={{ fontSize: 12, color: "var(--nw-text-secondary)", marginTop: 20 }}>
          14-day free trial · no card required · set up in an afternoon
        </p>
      </div>
    </section>
  );
};

window.Features = function Features() {
  const features = [
    { kicker: "AIA Draws", title: "Submit G702/G703 packages in minutes, not afternoons.", body: "Pull invoices, apply retainage, generate sign-ready PDFs. Every cost code reconciled to actuals." },
    { kicker: "Invoice Parsing", title: "Drag in any format — PDF, Word, photo from the field.", body: "Vendor, amount, cost code, and GL mapping extracted automatically. You review; we route." },
    { kicker: "Job Cost Accounting", title: "Real margins, not estimates. Per job, per cost code.", body: "Budget vs actual every night. Flagged overages surface on the dashboard before they become write-offs." },
    { kicker: "Built for the Field", title: "Works on the phone in the truck, not just at the desk.", body: "Tap targets sized for work gloves. High contrast for sunlight. No app to install." },
  ];
  return (
    <section style={{ background: "#fff", padding: "80px 24px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ maxWidth: 640, marginBottom: 48 }}>
          <span style={{ display: "inline-block", fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--nw-text-secondary)", fontWeight: 500, marginBottom: 12 }}>Capabilities</span>
          <h2 style={{ fontFamily: "var(--nw-display)", fontWeight: 400, fontSize: 40, lineHeight: 1.1, letterSpacing: "-0.02em", color: "var(--nw-text-primary)", margin: 0 }}>
            The software your bookkeeper wishes you'd already bought.
          </h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "var(--nw-border)", border: "1px solid var(--nw-border)" }}>
          {features.map(f => (
            <div key={f.kicker} style={{ background: "#fff", padding: 32 }}>
              <div style={{ fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--nw-teal)", fontWeight: 700, marginBottom: 10 }}>{f.kicker}</div>
              <h3 style={{ fontFamily: "var(--nw-display)", fontWeight: 500, fontSize: 22, lineHeight: 1.25, color: "var(--nw-text-primary)", margin: "0 0 8px", letterSpacing: "-0.01em" }}>{f.title}</h3>
              <p style={{ fontSize: 14, lineHeight: 1.5, color: "var(--nw-text-secondary)", margin: 0 }}>{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

window.Pricing = function Pricing() {
  const tiers = [
    { name: "Solo", price: "$149", unit: "/mo", desc: "For a single builder running 1–3 jobs.", features: ["Up to 3 active jobs", "Unlimited invoices", "AIA draws & G702/G703", "Email support"], cta: "Start Free Trial", highlight: false },
    { name: "Team", price: "$349", unit: "/mo", desc: "Most builders running 5–15 projects.", features: ["Up to 15 active jobs", "3 seats included", "Role-based access (PM, Accounting)", "QuickBooks export", "Priority support"], cta: "Start Free Trial", highlight: true },
    { name: "Firm", price: "Talk to us", unit: "", desc: "Multi-entity, high-volume operations.", features: ["Unlimited jobs & seats", "Multi-entity consolidation", "Custom integrations", "Dedicated onboarding"], cta: "Book a Call", highlight: false },
  ];
  return (
    <section style={{ background: "var(--nw-page)", padding: "80px 24px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <span style={{ display: "inline-block", fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--nw-text-secondary)", fontWeight: 500, marginBottom: 12 }}>Pricing</span>
          <h2 style={{ fontFamily: "var(--nw-display)", fontWeight: 400, fontSize: 40, lineHeight: 1.1, letterSpacing: "-0.02em", color: "var(--nw-text-primary)", margin: 0 }}>
            One price per month. No per-invoice surprises.
          </h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {tiers.map(t => (
            <div key={t.name} style={{
              background: "#fff",
              border: `1px solid ${t.highlight ? "var(--nw-teal)" : "var(--nw-border)"}`,
              padding: 28,
              position: "relative",
              boxShadow: t.highlight ? "0 8px 24px -12px rgba(63,88,98,0.25)" : "none"
            }}>
              {t.highlight && <span style={{ position: "absolute", top: -10, left: 28, background: "var(--nw-teal)", color: "#fff", fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", padding: "3px 8px", fontWeight: 700 }}>Most Popular</span>}
              <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--nw-text-secondary)", fontWeight: 500, marginBottom: 8 }}>{t.name}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 2, marginBottom: 10 }}>
                <span style={{ fontFamily: "var(--nw-display)", fontSize: 38, color: "var(--nw-text-primary)", letterSpacing: "-0.02em" }}>{t.price}</span>
                <span style={{ fontSize: 13, color: "var(--nw-text-secondary)" }}>{t.unit}</span>
              </div>
              <p style={{ fontSize: 13, color: "var(--nw-text-secondary)", margin: "0 0 20px", minHeight: 38 }}>{t.desc}</p>
              <a href="#" style={{
                display: "block", textAlign: "center", padding: "10px 0",
                background: t.highlight ? "var(--nw-teal)" : "#fff",
                color: t.highlight ? "#fff" : "var(--nw-text-primary)",
                border: t.highlight ? "none" : "1px solid var(--nw-border)",
                fontSize: 12, letterSpacing: ".08em", textTransform: "uppercase", fontWeight: 500, textDecoration: "none", marginBottom: 20
              }}>{t.cta}</a>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, borderTop: "1px solid var(--nw-border)" }}>
                {t.features.map(f => (
                  <li key={f} style={{ padding: "10px 0", borderBottom: "1px solid var(--nw-border)", fontSize: 13, color: "var(--nw-text-primary)", display: "flex", gap: 8 }}>
                    <span style={{ color: "var(--nw-status-success)", flexShrink: 0 }}>✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

window.CallToAction = function CallToAction() {
  return (
    <section style={{ background: "var(--nw-teal)", padding: "64px 24px", color: "#fff" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", textAlign: "center" }}>
        <h2 style={{ fontFamily: "var(--nw-display)", fontWeight: 400, fontSize: 40, lineHeight: 1.1, margin: 0, letterSpacing: "-0.02em" }}>
          Close the books before the framing is up.
        </h2>
        <p style={{ fontSize: 15, color: "rgba(255,255,255,0.8)", margin: "16px auto 0", maxWidth: 540 }}>
          Set up in an afternoon. First draw out the door in a week.
        </p>
        <a href="#" style={{ display: "inline-block", marginTop: 28, padding: "14px 28px", background: "#fff", color: "var(--nw-teal)", fontSize: 13, letterSpacing: ".08em", textTransform: "uppercase", fontWeight: 700, textDecoration: "none" }}>Start Free Trial</a>
      </div>
    </section>
  );
};
