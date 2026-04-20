// Draw wizard — 4 step flow: Select Job → Period → Line Items → Review
window.DrawWizard = function DrawWizard({ onExit }) {
  const [step, setStep] = React.useState(1);
  const [job, setJob] = React.useState("1");
  const [period, setPeriod] = React.useState({ start: "2026-03-01", end: "2026-03-31", num: "8" });
  const steps = ["Select Job", "Period", "Review Line Items", "Summary & Submit"];

  return (
    <div style={{ minHeight: "calc(100vh - 54px)", background: "var(--nw-page)" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px" }}>
        {/* Breadcrumb */}
        <nav style={{ marginBottom: 12, fontSize: 13, color: "var(--nw-text-secondary)" }}>
          <span style={{ cursor: "pointer" }} onClick={onExit}>Home</span>
          <span style={{ opacity: .5 }}> › </span>
          <span style={{ cursor: "pointer" }}>Draws</span>
          <span style={{ opacity: .5 }}> › </span>
          <span style={{ color: "var(--nw-text-primary)", fontWeight: 500 }}>New Draw</span>
        </nav>

        {/* Title */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
          <div>
            <h1 style={{ fontFamily: "var(--nw-display)", fontWeight: 400, fontSize: 32, color: "var(--nw-text-primary)", margin: 0, letterSpacing: "-0.02em" }}>Create New Draw</h1>
            <p style={{ fontSize: 13, color: "var(--nw-text-secondary)", margin: "4px 0 0" }}>Generate a G702/G703 package from posted invoices.</p>
          </div>
          <button onClick={onExit} style={{ fontSize: 13, color: "var(--nw-text-secondary)", background: "transparent", border: "none", cursor: "pointer", padding: "8px 12px" }}>Cancel</button>
        </div>

        {/* Step bar */}
        <div style={{ display: "flex", gap: 4, marginBottom: 24, flexWrap: "wrap" }}>
          {steps.map((s, i) => {
            const n = i + 1;
            const state = n < step ? "done" : n === step ? "active" : "todo";
            const bg = state === "active" ? "var(--nw-teal)" : state === "done" ? "#E8E8E8" : "#F5F5F5";
            const fg = state === "active" ? "#fff" : state === "done" ? "var(--nw-text-primary)" : "var(--nw-text-secondary)";
            return (
              <div key={s} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", fontSize: 12, fontWeight: 500, background: bg, color: fg }}>
                <span style={{ fontFamily: "var(--nw-mono)" }}>Step {n} of 4</span>
                <span>·</span>
                <span>{s}</span>
              </div>
            );
          })}
        </div>

        {/* Step content */}
        <div style={{ background: "#fff", border: "1px solid var(--nw-border)", padding: 28 }}>
          {step === 1 && <StepSelectJob value={job} onChange={setJob} />}
          {step === 2 && <StepPeriod value={period} onChange={setPeriod} />}
          {step === 3 && <StepLineItems />}
          {step === 4 && <StepReview job={job} period={period} />}
        </div>

        {/* Footer nav */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
          <button onClick={() => step > 1 ? setStep(step - 1) : onExit()}
            style={{ padding: "10px 20px", fontSize: 13, letterSpacing: ".08em", textTransform: "uppercase", fontWeight: 500, background: "#fff", color: "var(--nw-text-primary)", border: "1px solid var(--nw-border)", cursor: "pointer" }}>
            {step === 1 ? "Cancel" : "← Back"}
          </button>
          <button onClick={() => step < 4 ? setStep(step + 1) : onExit()}
            style={{ padding: "10px 24px", fontSize: 13, letterSpacing: ".08em", textTransform: "uppercase", fontWeight: 500, background: "var(--nw-teal)", color: "#fff", border: "none", cursor: "pointer" }}>
            {step < 4 ? "Continue →" : "Submit Draw"}
          </button>
        </div>
      </div>
    </div>
  );
};

function StepSelectJob({ value, onChange }) {
  const jobs = [
    { id: "1", name: "Drummond Residence", addr: "1421 S Bay Blvd, Anna Maria, FL", contract: "$2,485,000", drawn: "62%", client: "Mark Drummond" },
    { id: "2", name: "Bay Isles Estate", addr: "88 Harbor Dr, Longboat Key", contract: "$4,120,000", drawn: "28%", client: "Joanna & Peter Shaw" },
    { id: "3", name: "Carrick Bend House", addr: "12 Carrick Bend Ln", contract: "$1,875,000", drawn: "85%", client: "Linda Harper" },
  ];
  return (
    <div>
      <h2 style={{ fontFamily: "var(--nw-display)", fontWeight: 500, fontSize: 20, color: "var(--nw-text-primary)", margin: "0 0 4px" }}>Select a job</h2>
      <p style={{ fontSize: 13, color: "var(--nw-text-secondary)", margin: "0 0 20px" }}>Only active jobs with posted invoices this period are shown.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {jobs.map(j => {
          const selected = value === j.id;
          return (
            <label key={j.id} style={{ display: "flex", gap: 12, padding: 16, border: `1px solid ${selected ? "var(--nw-teal)" : "var(--nw-border)"}`, background: selected ? "rgba(63,88,98,0.04)" : "#fff", cursor: "pointer" }}>
              <input type="radio" checked={selected} onChange={() => onChange(j.id)} style={{ marginTop: 4, accentColor: "var(--nw-teal)" }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 15, color: "var(--nw-text-primary)", fontWeight: 500 }}>{j.name}</div>
                    <div style={{ fontSize: 12, color: "var(--nw-text-secondary)", marginTop: 2 }}>{j.addr}</div>
                    <div style={{ fontSize: 12, color: "var(--nw-text-secondary)", marginTop: 2 }}>Client: {j.client}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: "var(--nw-mono)", fontSize: 13, color: "var(--nw-text-primary)", fontWeight: 700 }}>{j.contract}</div>
                    <div style={{ fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--nw-text-secondary)", marginTop: 2 }}>{j.drawn} drawn</div>
                  </div>
                </div>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function StepPeriod({ value, onChange }) {
  const F = (k, v) => onChange({ ...value, [k]: v });
  return (
    <div>
      <h2 style={{ fontFamily: "var(--nw-display)", fontWeight: 500, fontSize: 20, color: "var(--nw-text-primary)", margin: "0 0 4px" }}>Billing period</h2>
      <p style={{ fontSize: 13, color: "var(--nw-text-secondary)", margin: "0 0 20px" }}>We'll include all invoices posted within this range.</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, maxWidth: 700 }}>
        <Field label="Draw number">
          <input value={value.num} onChange={e => F("num", e.target.value)} style={fieldStyle} />
        </Field>
        <Field label="Period start">
          <input type="date" value={value.start} onChange={e => F("start", e.target.value)} style={{ ...fieldStyle, borderColor: "var(--nw-teal)" }} />
        </Field>
        <Field label="Period end">
          <input type="date" value={value.end} onChange={e => F("end", e.target.value)} style={fieldStyle} />
        </Field>
      </div>
      <div style={{ marginTop: 24, padding: 14, background: "var(--nw-subtle)", border: "1px solid var(--nw-border)", fontSize: 13, color: "var(--nw-text-secondary)" }}>
        <span style={{ fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--nw-text-primary)", fontWeight: 700, marginRight: 8 }}>Detected</span>
        18 invoices posted between {value.start} and {value.end}, totaling <span style={{ fontFamily: "var(--nw-mono)", color: "var(--nw-text-primary)", fontWeight: 700 }}>$284,712.40</span>
      </div>
    </div>
  );
}

function StepLineItems() {
  const rows = [
    { code: "03101", desc: "Foundation & concrete", sched: 62400, period: 0, balance: 0, ret: 0 },
    { code: "06101", desc: "Rough carpentry", sched: 184500, period: 48250, balance: 72400, ret: 4825, flag: true },
    { code: "09101", desc: "Electrical", sched: 48250, period: 12400, balance: 14850, ret: 1240 },
    { code: "10101", desc: "Plumbing", sched: 32000, period: 8500, balance: 5200, ret: 850 },
    { code: "15101", desc: "Drywall", sched: 21400, period: 0, balance: 0, ret: 0 },
    { code: "18101", desc: "Finish carpentry & trim", sched: 86200, period: 22800, balance: 18400, ret: 2280 },
  ];
  const m = (n) => n === 0 ? "$0.00" : "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16 }}>
        <div>
          <h2 style={{ fontFamily: "var(--nw-display)", fontWeight: 500, fontSize: 20, color: "var(--nw-text-primary)", margin: "0 0 4px" }}>Review line items</h2>
          <p style={{ fontSize: 13, color: "var(--nw-text-secondary)", margin: 0 }}>G703 schedule of values — edit any row or attach supporting invoices.</p>
        </div>
        <span style={{ fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--nw-status-danger)", border: "1px solid var(--nw-status-danger)", padding: "3px 8px", fontWeight: 700 }}>1 over budget</span>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontVariantNumeric: "tabular-nums" }}>
        <thead>
          <tr>
            {["Code", "Description", "Scheduled", "This period", "Balance", "Retainage"].map((h, i) => (
              <th key={h} style={{ fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--nw-text-secondary)", textAlign: i >= 2 ? "right" : "left", padding: "8px 10px", background: "var(--nw-subtle)", fontWeight: 700, borderBottom: "1px solid var(--nw-border)" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.code} style={r.flag ? { background: "rgba(192,57,43,0.04)" } : {}}>
              <td style={{ padding: 10, borderBottom: "1px solid var(--nw-border)", fontFamily: "var(--nw-mono)", fontSize: 12, color: "var(--nw-text-primary)", fontWeight: 700 }}>{r.code}</td>
              <td style={{ padding: 10, borderBottom: "1px solid var(--nw-border)", fontSize: 13, color: "var(--nw-text-primary)" }}>
                {r.desc}
                {r.flag && <span style={{ fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--nw-status-danger)", border: "1px solid var(--nw-status-danger)", padding: "1px 5px", marginLeft: 8, fontWeight: 700 }}>Over</span>}
              </td>
              <td style={{ padding: 10, borderBottom: "1px solid var(--nw-border)", fontFamily: "var(--nw-mono)", fontSize: 12, color: "var(--nw-text-primary)", textAlign: "right" }}>{m(r.sched)}</td>
              <td style={{ padding: 10, borderBottom: "1px solid var(--nw-border)", fontFamily: "var(--nw-mono)", fontSize: 12, color: "var(--nw-text-primary)", textAlign: "right" }}>{m(r.period)}</td>
              <td style={{ padding: 10, borderBottom: "1px solid var(--nw-border)", fontFamily: "var(--nw-mono)", fontSize: 12, color: r.flag ? "var(--nw-status-danger)" : "var(--nw-text-primary)", textAlign: "right" }}>{m(r.balance)}</td>
              <td style={{ padding: 10, borderBottom: "1px solid var(--nw-border)", fontFamily: "var(--nw-mono)", fontSize: 12, color: "var(--nw-brass)", textAlign: "right" }}>{m(r.ret)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StepReview({ period }) {
  return (
    <div>
      <h2 style={{ fontFamily: "var(--nw-display)", fontWeight: 500, fontSize: 20, color: "var(--nw-text-primary)", margin: "0 0 4px" }}>Summary & submit</h2>
      <p style={{ fontSize: 13, color: "var(--nw-text-secondary)", margin: "0 0 20px" }}>Review the package below. Once submitted, the draw is routed for approval and locked.</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        <Summary label="Job" value="Drummond Residence" sub="1421 S Bay Blvd, Anna Maria, FL" />
        <Summary label="Period" value={`${period.start} → ${period.end}`} sub={`Draw #${period.num}`} />
        <Summary label="Total this period" value="$91,950.00" mono />
        <Summary label="Retainage" value="$9,195.00" mono brass />
      </div>
      <div style={{ background: "var(--nw-subtle)", border: "1px solid var(--nw-border)", padding: 16 }}>
        <div style={{ fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--nw-text-secondary)", fontWeight: 700, marginBottom: 8 }}>Attachments</div>
        <div style={{ fontSize: 13, color: "var(--nw-text-primary)", lineHeight: 1.8 }}>
          · G702_Drummond_Draw8.pdf<br/>
          · G703_ScheduleOfValues.pdf<br/>
          · 18 posted invoices (bundled)<br/>
          · 12 of 14 lien releases <span style={{ color: "var(--nw-status-warning)" }}>(2 missing)</span>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--nw-text-secondary)", fontWeight: 500, marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}
function Summary({ label, value, sub, mono, brass }) {
  return (
    <div style={{ background: "#fff", border: "1px solid var(--nw-border)", padding: 14 }}>
      <div style={{ fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--nw-text-secondary)", fontWeight: 500 }}>{label}</div>
      <div style={{ marginTop: 4, fontFamily: mono ? "var(--nw-mono)" : "inherit", fontSize: mono ? 18 : 15, color: brass ? "var(--nw-brass)" : "var(--nw-text-primary)", fontWeight: mono ? 700 : 500 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--nw-text-secondary)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

const fieldStyle = { width: "100%", boxSizing: "border-box", padding: "10px 12px", border: "1px solid var(--nw-border)", background: "#fff", fontSize: 14, color: "var(--nw-text-primary)", fontFamily: "inherit" };
