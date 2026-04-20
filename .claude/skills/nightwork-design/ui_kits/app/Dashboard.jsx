// Dashboard page: hero metrics + needs-attention + recent activity
window.Dashboard = function Dashboard() {
  const metrics = [
    { label: "Active Jobs", value: "14", chip: null },
    { label: "Invoices Pending Review", value: "23", chip: { text: "7d old", color: "var(--nw-status-danger)" } },
    { label: "Draws in Progress", value: "3", chip: { text: "1 overdue", color: "var(--nw-brass)" } },
    { label: "Payments Due", value: "$184,250", chip: null, danger: true },
  ];
  const attention = [
    { sev: "danger", title: "Invoice #INV-04821 over budget", age: "12d", desc: "Florida Sunshine Carpentry · Drummond Residence · $4,200 over cost code 06101" },
    { sev: "warning", title: "Draw #7 awaiting approval", age: "5d", desc: "Bay Isles · submitted Mar 14 · $218,450.00" },
    { sev: "info", title: "2 lien releases missing", age: null, desc: "Doug Naeher Drywall, Acme Concrete · Drummond Draw #8" },
    { sev: "warning", title: "Change order #CO-0014 needs sign-off", age: "3d", desc: "Carrick Bend House · scope: kitchen cabinets · $7,825" },
  ];
  const activity = [
    { who: "Jake Ross", action: "approved", thing: "Draw #6 — Bay Isles Estate", amount: "$154,220.00", when: "2:41 PM" },
    { who: "Sara K.", action: "uploaded", thing: "5 invoices via AI parser", amount: null, when: "1:08 PM" },
    { who: "System", action: "reconciled", thing: "Chase OpsAcct · Feb 2026", amount: null, when: "11:30 AM" },
    { who: "Matt L.", action: "submitted", thing: "Draw #7 — Carrick Bend", amount: "$68,190.00", when: "Yesterday" },
  ];

  const sevColor = { danger: "var(--nw-status-danger)", warning: "var(--nw-status-warning)", info: "var(--nw-brass)" };

  return (
    <div style={{ padding: 24, maxWidth: 1600, margin: "0 auto" }}>
      {/* Breadcrumb + H1 */}
      <nav style={{ marginBottom: 12, fontSize: 13, color: "var(--nw-text-secondary)" }}>
        <span>Home</span> <span style={{ opacity: .5 }}>›</span> <span style={{ color: "var(--nw-text-primary)", fontWeight: 500 }}>Dashboard</span>
      </nav>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: "var(--nw-display)", fontWeight: 400, fontSize: 30, color: "var(--nw-text-primary)", margin: 0, letterSpacing: "-0.02em" }}>Good morning, Jake</h1>
          <p style={{ fontSize: 13, color: "var(--nw-text-secondary)", margin: "4px 0 0" }}>7 items need your attention across 14 active jobs</p>
        </div>
        <button style={{ background: "var(--nw-teal)", color: "#fff", padding: "10px 20px", fontSize: 13, letterSpacing: ".08em", textTransform: "uppercase", fontWeight: 500, border: "none", cursor: "pointer" }}>+ New Draw</button>
      </div>

      {/* Metric row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        {metrics.map(m => (
          <div key={m.label} style={{ background: "#fff", border: "1px solid var(--nw-border)", padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <span style={{ fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--nw-text-secondary)", lineHeight: 1.2, fontWeight: 500 }}>{m.label}</span>
              {m.chip && <span style={{ fontSize: 10, padding: "2px 6px", border: `1px solid ${m.chip.color}`, color: m.chip.color, fontWeight: 700 }}>{m.chip.text}</span>}
            </div>
            <div style={{ marginTop: 12, fontFamily: "var(--nw-display)", fontSize: 32, lineHeight: 1, color: m.danger ? "var(--nw-status-danger)" : "var(--nw-text-primary)", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Two-column */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20 }}>
        <section>
          <h2 style={{ fontSize: 14, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--nw-text-secondary)", paddingBottom: 8, borderBottom: "1px solid var(--nw-border)", margin: "0 0 0" }}>Needs Attention</h2>
          <div style={{ background: "#fff", border: "1px solid var(--nw-border)", borderTop: "none" }}>
            {attention.map((a, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: i < attention.length - 1 ? "1px solid var(--nw-border)" : "none", cursor: "pointer" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: sevColor[a.sev], flexShrink: 0 }}></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, color: "var(--nw-text-primary)", fontWeight: 500 }}>
                    {a.title}
                    {a.age && <span style={{ fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", marginLeft: 8, color: sevColor[a.sev] }}>{a.age}</span>}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--nw-text-secondary)", marginTop: 2 }}>{a.desc}</div>
                </div>
                <span style={{ color: "var(--nw-text-secondary)" }}>›</span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 style={{ fontSize: 14, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--nw-text-secondary)", paddingBottom: 8, borderBottom: "1px solid var(--nw-border)", margin: "0 0 0" }}>Recent Activity</h2>
          <div style={{ background: "#fff", border: "1px solid var(--nw-border)", borderTop: "none" }}>
            {activity.map((a, i) => (
              <div key={i} style={{ padding: "12px 16px", borderBottom: i < activity.length - 1 ? "1px solid var(--nw-border)" : "none" }}>
                <div style={{ fontSize: 13, color: "var(--nw-text-primary)" }}>
                  <span style={{ fontWeight: 500 }}>{a.who}</span>
                  <span style={{ color: "var(--nw-text-secondary)" }}> {a.action} </span>
                  <span>{a.thing}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 2 }}>
                  <span style={{ fontSize: 11, color: "var(--nw-text-secondary)" }}>{a.when}</span>
                  {a.amount && <span style={{ fontSize: 11, fontFamily: "var(--nw-mono)", color: "var(--nw-text-primary)", fontWeight: 700 }}>{a.amount}</span>}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
