// Shared chrome: NavBar + JobSidebar mock
window.NavBar = function NavBar({ active = "Dashboard", user = "Jake", role = "Admin" }) {
  const items = ["Dashboard", "Financial", "Admin"];
  const useState = React.useState;
  return (
    <header style={{ borderTop: "3px solid var(--nw-teal)", background: "var(--nw-teal)", position: "sticky", top: 0, zIndex: 40 }}>
      <div style={{ maxWidth: 1600, margin: "0 auto", padding: "10px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <img src="../../assets/nightwork-logo-dark.svg" alt="Nightwork" style={{ height: 30 }} />
        </div>
        <nav style={{ display: "flex", gap: 4, flex: 1, justifyContent: "center" }}>
          {items.map(n => (
            <span key={n} style={{
              color: n === active ? "#fff" : "rgba(255,255,255,.7)",
              padding: "6px 12px", fontSize: 14, fontWeight: 500, position: "relative",
              borderBottom: n === active ? "1px solid #fff" : "1px solid transparent", cursor: "pointer"
            }}>{n}</span>
          ))}
          <span style={{ color: "rgba(255,255,255,.3)", padding: "6px 12px", fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
            Operations
            <span style={{ fontSize: 9, letterSpacing: ".08em", textTransform: "uppercase", border: "1px solid rgba(255,255,255,.2)", padding: "1px 5px" }}>Soon</span>
          </span>
        </nav>
        <div style={{ display: "flex", alignItems: "center", gap: 12, color: "#fff", fontSize: 13 }}>
          <span>🔔</span>
          <span>{user}</span>
          <span style={{ opacity: .6 }}>·</span>
          <span style={{ fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", padding: "2px 6px", border: "1px solid #fff", fontWeight: 700 }}>{role}</span>
          <span style={{ opacity: .8, fontSize: 13 }}>Sign Out</span>
        </div>
      </div>
    </header>
  );
};

window.JobSidebar = function JobSidebar({ selectedId = "1", onSelect }) {
  const [search, setSearch] = React.useState("");
  const jobs = [
    { id: "1", name: "Drummond Residence", addr: "1421 S Bay Blvd", status: "active", client: "Mark Drummond" },
    { id: "2", name: "Bay Isles Estate", addr: "88 Harbor Dr", status: "active" },
    { id: "3", name: "Carrick Bend House", addr: "12 Carrick Bend Ln", status: "active" },
    { id: "4", name: "Harbor Point", addr: "3104 Harbor Pt", status: "warranty" },
    { id: "5", name: "Vanderbilt Residence", addr: "601 Vanderbilt Rd", status: "complete" },
    { id: "6", name: "Key Royale Build", addr: "701 Key Royale Dr", status: "active" },
    { id: "7", name: "Longboat Estate", addr: "2455 Longboat Rd", status: "active" },
  ];
  const filtered = jobs.filter(j => j.name.toLowerCase().includes(search.toLowerCase()));
  const selected = jobs.find(j => j.id === selectedId);
  const others = filtered.filter(j => j.id !== selectedId);
  const dot = (s) => s === "active" ? "var(--nw-status-success)" : s === "warranty" ? "var(--nw-brass)" : "var(--nw-text-secondary)";
  const lbl = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  return (
    <aside style={{ width: 220, flexShrink: 0, borderRight: "1px solid var(--nw-border)", background: "#fff", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: 12, borderBottom: "1px solid var(--nw-border)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--nw-text-secondary)", fontWeight: 500 }}>Jobs</span>
          <span style={{ fontSize: 12, color: "var(--nw-text-secondary)", cursor: "pointer" }}>‹</span>
        </div>
        <button style={{ width: "100%", padding: "6px 0", fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", fontWeight: 500, border: "1px solid var(--nw-teal)", color: "var(--nw-teal)", background: "#fff", cursor: "pointer", marginBottom: 8 }}>+ New Job</button>
        <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ width: "100%", padding: "6px 8px", fontSize: 12, border: "1px solid var(--nw-border)", background: "#fff", boxSizing: "border-box", marginBottom: 6 }} />
        <select style={{ width: "100%", padding: "4px 8px", fontSize: 10, border: "1px solid var(--nw-border)", background: "#fff", color: "var(--nw-text-secondary)" }}>
          <option>A-Z</option><option>Status</option><option>Recent</option>
        </select>
      </div>
      {selected && (
        <div style={{ padding: 12, borderBottom: "1px solid var(--nw-border)", background: "rgba(63,88,98,0.05)" }}>
          <p style={{ margin: 0, fontSize: 14, color: "var(--nw-text-primary)", fontWeight: 500 }}>{selected.name}</p>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: dot(selected.status) }}></span>
            <span style={{ fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--nw-text-secondary)" }}>{lbl(selected.status)}</span>
          </div>
          {selected.client && <p style={{ margin: "6px 0 0", fontSize: 11, color: "var(--nw-text-secondary)" }}>{selected.client}</p>}
          {selected.addr && <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--nw-text-secondary)" }}>{selected.addr}</p>}
        </div>
      )}
      <div style={{ flex: 1, overflowY: "auto" }}>
        <div style={{ padding: "8px 12px", fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--nw-text-secondary)", borderBottom: "1px solid var(--nw-border)" }}>
          All {filtered.length} Jobs
        </div>
        {others.map(j => (
          <div key={j.id} onClick={() => onSelect && onSelect(j.id)}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid rgba(232,232,232,.5)" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: dot(j.status), flexShrink: 0 }}></span>
            <span style={{ fontSize: 13, color: "var(--nw-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{j.name}</span>
          </div>
        ))}
      </div>
    </aside>
  );
};
