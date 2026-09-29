/* Antibody console. React 18 UMD + Babel-standalone (localhost demo).
   Every color/space comes from tokens.css; this file is structure + behavior. */
const { useState, useEffect, useRef, useCallback, useMemo } = React;

/* ---- decision vocabulary (word is mandatory, never color alone) ---- */
const ACTION = {
  allow:   { label: "Allowed",           cls: "allow"   },
  verify:  { label: "Verification asked", cls: "verify"  },
  block:   { label: "Blocked",           cls: "block"   },
  sandbox: { label: "Sandboxed",         cls: "sandbox" },
};

/* ---- formatting ---- */
const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const fmtINR = (n) => "₹" + inr.format(n);
const nf = new Intl.NumberFormat("en-US");
const fmtNum = (n) => nf.format(n);
function timeAgo(ts) {
  const s = Math.max(0, Math.floor(Date.now() / 1000 - ts));
  if (s < 60) return s + "s";
  if (s < 3600) return Math.floor(s / 60) + "m";
  if (s < 86400) return Math.floor(s / 3600) + "h";
  return Math.floor(s / 86400) + "d";
}

/* ---- theme bridge: let third-party libs (vis-network, Chart.js) read our tokens ----
   Libraries paint to a canvas, so they can't use CSS vars directly. We resolve the
   token to its current value and rebuild whenever the theme flips. */
function cssVar(name) {
  try { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
  catch { return ""; }
}
function withAlpha(color, a) {
  const h = (color || "").replace("#", "");
  if (h.length >= 6) {
    const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }
  return color || `rgba(128,128,128,${a})`;
}
const actionHex = (a) =>
  cssVar(a === "sandbox" ? "--sandbox" : a === "block" ? "--block"
    : a === "verify" ? "--verify" : "--allow") || "#8E8E93";

/* bumps a counter on every appearance change so charts/graph recolor without a reload */
function useThemeVersion() {
  const [v, setV] = useState(0);
  useEffect(() => {
    const bump = () => setV((x) => x + 1);
    const mo = new MutationObserver(bump);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener && mq.addEventListener("change", bump);
    return () => { mo.disconnect(); mq.removeEventListener && mq.removeEventListener("change", bump); };
  }, []);
  return v;
}

/* Chart.js wrapper: builds a chart into a canvas, rebuilds on data/theme change, cleans up */
function ChartCanvas({ type, data, options, height = 240, label }) {
  const ref = useRef(null);
  const tv = useThemeVersion();
  const sig = JSON.stringify({ type, data, options });
  useEffect(() => {
    if (!ref.current || typeof Chart === "undefined") return;
    const chart = new Chart(ref.current, { type, data, options });
    return () => chart.destroy();
  }, [sig, tv]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="chart-box" style={{ height }}>
      <canvas ref={ref} role="img" aria-label={label || "chart"} />
    </div>
  );
}
/* shared axis/legend styling so every chart matches the tokens */
function chartBase() {
  const label = cssVar("--label-secondary"), grid = cssVar("--separator");
  return {
    responsive: true, maintainAspectRatio: false,
    animation: { duration: 220 },
    font: { family: cssVar("--font-sans") },
    plugins: {
      legend: { labels: { color: label, boxWidth: 10, boxHeight: 10, usePointStyle: true,
        font: { family: cssVar("--font-sans"), size: 12 } } },
      tooltip: {
        backgroundColor: cssVar("--bg-primary"), titleColor: cssVar("--label-primary"),
        bodyColor: label, borderColor: grid, borderWidth: 0.5, cornerRadius: 8, padding: 10,
        titleFont: { family: cssVar("--font-sans") }, bodyFont: { family: cssVar("--font-sans") },
      },
    },
    scales: {
      x: { ticks: { color: label, font: { family: cssVar("--font-sans") } }, grid: { display: false }, border: { color: grid } },
      y: { ticks: { color: label, font: { family: cssVar("--font-sans") } }, grid: { color: grid }, border: { display: false } },
    },
  };
}

/* ---- inline Lucide-style icons (1.75 stroke, currentColor) ---- */
const Svg = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
       strokeLinecap="round" strokeLinejoin="round" {...p} />
);
const I = {
  layers:   () => <Svg><path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/></Svg>,
  activity: () => <Svg><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></Svg>,
  inbox:    () => <Svg><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z"/></Svg>,
  shield:   () => <Svg><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/></Svg>,
  chart:    () => <Svg><path d="M3 3v18h18"/><rect x="7" y="10" width="3" height="7"/><rect x="13" y="6" width="3" height="11"/></Svg>,
  check:    () => <Svg><path d="M20 6 9 17l-5-5"/></Svg>,
  help:     () => <Svg><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></Svg>,
  x:        () => <Svg><path d="M18 6 6 18M6 6l12 12"/></Svg>,
  box:      () => <Svg><path d="m21 8-9-5-9 5 9 5 9-5Z"/><path d="M3 8v8l9 5 9-5V8"/></Svg>,
  dot:      () => <Svg><circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/></Svg>,
  link:     () => <Svg><path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 0 1 0 10h-2"/><path d="M8 12h8"/></Svg>,
  graph:    () => <Svg><circle cx="5" cy="6" r="2"/><circle cx="19" cy="9" r="2"/><circle cx="9" cy="18" r="2"/><path d="M7 6.7 17 8.4"/><path d="M8.4 16.1 17.6 10.6"/></Svg>,
  moon:     () => <Svg><path d="M12 3a6.5 6.5 0 1 0 9 9 8 8 0 1 1-9-9Z"/></Svg>,
  target:   () => <Svg><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/></Svg>,
  play:     () => <Svg><path d="m6 4 14 8-14 8V4Z" fill="currentColor" stroke="none"/></Svg>,
  eye:      () => <Svg><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></Svg>,
  menu:     () => <Svg><path d="M3 6h18M3 12h18M3 18h18"/></Svg>,
  chevron:  () => <Svg><path d="m15 18-6-6 6-6"/></Svg>,
};
const PILL_ICON = { allow: I.check, verify: I.help, block: I.x, sandbox: I.box };

/* ---- small components ---- */
function Pill({ action }) {
  const meta = ACTION[action] || ACTION.block;
  const Icon = PILL_ICON[action] || I.x;
  return <span className={"pill " + meta.cls}><Icon />{meta.label}</span>;
}

function ScoreRing({ score }) {
  const r = 13, c = 2 * Math.PI * r, pct = Math.min(100, Math.max(0, score));
  const stroke = score >= 90 ? "var(--sandbox)" : score >= 70 ? "var(--block)"
    : score >= 40 ? "var(--verify)" : "var(--allow)";
  return (
    <span className="ring" style={{ width: 34, height: 34 }} aria-hidden="true">
      <svg width="34" height="34">
        <circle cx="17" cy="17" r={r} fill="none" stroke="var(--fill-tertiary)" strokeWidth="3"/>
        <circle cx="17" cy="17" r={r} fill="none" stroke={stroke} strokeWidth="3"
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)}/>
      </svg>
      <span className="val t-caption tnum">{score}</span>
    </span>
  );
}

/* ---- live event stream: seed from /feed, then stream /events over WS ---- */
function useEventStream() {
  const [events, setEvents] = useState([]);
  const [connected, setConnected] = useState(false);
  const seen = useRef(new Set());
  const merge = useCallback((incoming) => {
    setEvents((prev) => {
      const next = prev.slice();
      for (const e of incoming) {
        const key = `${e.type}:${e.session_id}:${e.ts}`;
        if (seen.current.has(key)) continue;
        seen.current.add(key);
        next.push(e);
      }
      next.sort((a, b) => (b.ts || 0) - (a.ts || 0));
      return next.slice(0, 500);
    });
  }, []);

  useEffect(() => {
    let ws, alive = true;
    fetch("/feed").then((r) => r.json()).then((d) => alive && merge(d.events || [])).catch(() => {});
    const proto = location.protocol === "https:" ? "wss" : "ws";
    function connect() {
      ws = new WebSocket(`${proto}://${location.host}/events`);
      ws.onopen = () => alive && setConnected(true);
      ws.onclose = () => { if (!alive) return; setConnected(false); setTimeout(connect, 1500); };
      ws.onerror = () => ws.close();
      ws.onmessage = (m) => { try { merge([JSON.parse(m.data)]); } catch {} };
    }
    connect();
    return () => { alive = false; if (ws) ws.close(); };
  }, [merge]);

  return { events, connected };
}

const decisions = (events) => events.filter((e) => e.type === "decision" && e.source !== "dream");

/* ---- evidence: what memory recalled, shown as sourced rows (never color alone) ---- */
function EvidenceList({ items }) {
  if (!items || items.length === 0) return null;
  return (
    <ul className="evidence">
      {items.map((v, i) => {
        const text = v.claim || v.text || v.summary || v.memory_id || "Recalled signal";
        const src = v.source || v.kind || (v.memory_id ? "memory" : null);
        return (
          <li key={i} className="evidence-item">
            <span className="evidence-mark"><I.link /></span>
            <div className="evidence-text">
              <span className="t-callout">{text}</span>
              {src && <span className="evidence-src t-caption mono">{src}</span>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ---- decision card (used inside the split) ---- */
function DecisionCard({ e, onSelect, selected }) {
  const ev = e.evidence || [];
  const memoryOn = !!e.memory_enabled;
  return (
    <div className="dcard" role="button" tabIndex="0"
      aria-selected={selected}
      onClick={() => onSelect(e)}
      onKeyDown={(k) => (k.key === "Enter" || k.key === " ") && (k.preventDefault(), onSelect(e))}
      style={selected ? { background: "var(--fill-quaternary)" } : null}>
      <p className="msg t-body">{e.message}</p>
      <div className="scorewrap">
        <Pill action={e.action} />
        <ScoreRing score={e.score} />
        {e.tactics && e.tactics.map((t) => <span key={t} className="chip">{t}</span>)}
      </div>
      {memoryOn && ev.length > 0 && <EvidenceList items={ev} />}
      {memoryOn && ev.length === 0 && (
        <p className="why t-callout">{e.explanation || "No prior signal recalled."}</p>
      )}
      {!memoryOn && (
        <p className="why t-callout">Decided blind — memory was off, so no history or antigen informed this.</p>
      )}
    </div>
  );
}

/* ---- THE split view: the same live stream, memory off vs memory on ---- */
function SplitView({ events, onSelect, selectedId }) {
  const ds = decisions(events);
  const off = ds.filter((e) => !e.memory_enabled);
  const on = ds.filter((e) => e.memory_enabled);
  const Col = ({ kind, title, sub, rows }) => (
    <div className={"col " + kind}>
      <div className="col-head">
        <span className="dot" />
        <span className="t-headline">{title}</span>
        {rows.length > 0 && <span className="hcount tnum">{rows.length}</span>}
        <span className="t-caption secondary" style={{ marginLeft: "auto" }}>{sub}</span>
      </div>
      <div className="col-body scroll" style={{ maxHeight: "calc(100vh - 160px)" }}>
        {rows.length === 0
          ? <div className="dcard secondary t-callout">No decisions yet.</div>
          : rows.map((e) => (
              <DecisionCard key={e.session_id + e.ts} e={e} onSelect={onSelect}
                selected={selectedId === e.session_id} />
            ))}
      </div>
    </div>
  );
  return (
    <div className="pane">
      <div className="split">
        <Col kind="off" title="Memory off" sub="decides blind" rows={off} />
        <Col kind="on"  title="Memory on"  sub="cites what it remembers" rows={on} />
      </div>
    </div>
  );
}

/* ---- threat feed table ---- */
function FeedView({ events, onSelect, selectedId }) {
  const ds = decisions(events);
  return (
    <div className="pane">
      <div className="surface" style={{ overflow: "hidden" }}>
        <table className="feed">
          <thead>
            <tr>
              <th>Time</th><th>Tenant</th><th>Identity</th><th>Message</th>
              <th className="num">Score</th><th>Decision</th><th>Source</th>
            </tr>
          </thead>
          <tbody>
            {ds.map((e) => (
              <tr key={e.session_id + e.ts} className="row-enter"
                aria-selected={selectedId === e.session_id}
                onClick={() => onSelect(e)}>
                <td className="tnum secondary">{timeAgo(e.ts)}</td>
                <td>{e.tenant}</td>
                <td className="mono">{e.identity_id?.slice(0, 10)}</td>
                <td style={{ maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.message}</td>
                <td className="num tnum">{e.score}</td>
                <td><Pill action={e.action} /></td>
                <td className="secondary">{e.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {ds.length === 0 && <div className="row secondary">Waiting for traffic…</div>}
      </div>
    </div>
  );
}

/* ---- fetch helper with manual refetch + optional polling ---- */
function useFetch(url, pollMs) {
  const [data, setData] = useState(null);
  const load = useCallback(() => {
    fetch(url).then((r) => r.json()).then(setData).catch(() => {});
  }, [url]);
  useEffect(() => {
    load();
    if (!pollMs) return;
    const t = setInterval(load, pollMs);
    return () => clearInterval(t);
  }, [load, pollMs]);
  return [data, load];
}

/* ---- analyst queue (Mail/Messages three-column feel) ---- */
function QueueView({ selectedId, onSelect, refreshKey }) {
  const [data, reload] = useFetch("/queue", 5000);
  useEffect(() => { reload(); }, [refreshKey, reload]);
  const sessions = (data && data.sessions) || [];
  return (
    <div className="pane">
      <div className="surface rows" style={{ overflow: "hidden" }}>
        {sessions.length === 0 && <div className="row secondary">Nothing flagged for review.</div>}
        {sessions.map((s) => (
          <div key={s.session_id} className="row" role="button" tabIndex="0"
            aria-selected={selectedId === s.session_id}
            onClick={() => onSelect({ session_id: s.session_id, ...s })}
            style={selectedId === s.session_id ? { background: "var(--fill-quaternary)" } : null}>
            <ScoreRing score={s.score} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="t-headline">{s.tenant}</span>
                <span className="mono t-caption secondary">{s.identity_id?.slice(0, 10)}</span>
                <span className="t-caption secondary" style={{ marginLeft: "auto" }}>{timeAgo(s.ts)}</span>
              </div>
              <div className="secondary t-callout" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.last_message}</div>
            </div>
            {s.verdict
              ? <span className="chip">{s.verdict}</span>
              : <Pill action={s.action} />}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---- active campaigns (confirmed antigens) ---- */
function CampaignsView() {
  const [data] = useFetch("/campaigns");
  const camps = (data && data.campaigns) || [];
  return (
    <div className="pane">
      {!data && <Note>Loading campaigns…</Note>}
      {data && camps.length === 0 && (
        <Note icon={I.shield} title="No confirmed campaigns yet">
          Confirm an attack in the analyst queue to retain it as an antigen — it then protects every tenant.
        </Note>
      )}
      <div className="stats" style={{ gridTemplateColumns: "1fr" }}>
        {camps.map((c) => (
          <div key={c.id} className="surface camp">
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span className="pill block"><I.shield />Confirmed antigen</span>
            </div>
            <p className="body t-body">{c.text}</p>
            {c.tactics && c.tactics.length > 0 && (
              <div className="tactics">{c.tactics.map((t) => <span key={t} className="chip">{t}</span>)}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---- metrics: memory on vs off is the headline comparison ---- */
function MetricsView() {
  const [m] = useFetch("/metrics", 5000);
  useThemeVersion(); // re-read tokens when the theme flips
  if (!m) return <div className="pane"><Note>Loading metrics…</Note></div>;
  const rate = (x) => x && x.n ? Math.round((x.cited / x.n) * 100) : 0;
  const onPct = rate(m.memory_on), offPct = rate(m.memory_off);

  const evidenceData = {
    labels: ["Memory on", "Memory off"],
    datasets: [{
      data: [onPct, offPct],
      backgroundColor: [withAlpha(cssVar("--accent-fill"), 0.85), cssVar("--fill-tertiary")],
      borderColor: [cssVar("--accent-fill"), cssVar("--separator")],
      borderWidth: 1, borderRadius: 6, barThickness: 26,
    }],
  };
  const evidenceOpts = {
    ...chartBase(), indexAxis: "y",
    plugins: { ...chartBase().plugins, legend: { display: false },
      tooltip: { ...chartBase().plugins.tooltip, callbacks: { label: (c) => c.parsed.x + "% of decisions cited a memory" } } },
    scales: {
      x: { ...chartBase().scales.x, min: 0, max: 100, grid: { color: cssVar("--separator") }, ticks: { ...chartBase().scales.x.ticks, callback: (v) => v + "%" } },
      y: chartBase().scales.y,
    },
  };

  const actions = Object.entries(m.by_action || {});
  const donutData = {
    labels: actions.map(([a]) => (ACTION[a] || { label: a }).label),
    datasets: [{
      data: actions.map(([, n]) => n),
      backgroundColor: actions.map(([a]) => withAlpha(actionHex(a), 0.85)),
      borderColor: cssVar("--bg-grouped-secondary"), borderWidth: 2,
    }],
  };
  const donutOpts = {
    ...chartBase(), cutout: "62%",
    plugins: { ...chartBase().plugins, legend: { ...chartBase().plugins.legend, position: "right" } },
    scales: {},
  };

  return (
    <div className="pane">
      <div className="stats">
        <div className="stat"><div className="k t-callout">Decisions</div><div className="v">{fmtNum(m.total)}</div></div>
        <div className="stat"><div className="k t-callout">Latency p50</div><div className="v tnum">{m.latency_p50}<small> ms</small></div></div>
        <div className="stat"><div className="k t-callout">Latency p95</div><div className="v tnum">{m.latency_p95}<small> ms</small></div></div>
        {actions.map(([a, n]) => (
          <div className="stat" key={a}>
            <div className="k t-callout">{(ACTION[a] || { label: a }).label}</div>
            <div className="v tnum">{fmtNum(n)}</div>
          </div>
        ))}
      </div>
      <div className="chart-grid">
        <div className="surface chart-card">
          <div className="t-headline">Evidence cited</div>
          <p className="secondary t-callout" style={{ margin: "2px 0 8px" }}>How often a decision pointed to a specific memory.</p>
          <ChartCanvas type="bar" data={evidenceData} options={evidenceOpts} height={160} label="Evidence cited, memory on vs off" />
        </div>
        <div className="surface chart-card">
          <div className="t-headline">Decision mix</div>
          <p className="secondary t-callout" style={{ margin: "2px 0 8px" }}>Every verdict this console has made, by outcome.</p>
          {actions.length > 0
            ? <ChartCanvas type="doughnut" data={donutData} options={donutOpts} height={200} label="Decisions by outcome" />
            : <p className="secondary t-callout">No decisions yet.</p>}
        </div>
      </div>
    </div>
  );
}

/* ---- inspector: evidence + the analyst verdict loop ---- */
function Inspector({ selected, onVerdict, open, onClose }) {
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const sid = selected && selected.session_id;

  useEffect(() => {
    setDetail(null); setDone(null);
    if (!sid) return;
    let alive = true;
    fetch(`/session/${encodeURIComponent(sid)}`).then((r) => r.ok ? r.json() : null)
      .then((d) => alive && setDetail(d)).catch(() => {});
    return () => { alive = false; };
  }, [sid]);

  async function submit(verdict) {
    if (!sid || busy) return;
    setBusy(true);
    const last = detail && detail.decisions && detail.decisions[detail.decisions.length - 1];
    const tactic = last && last.tactics && last.tactics[0];
    try {
      const r = await fetch("/verdict", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sid, verdict, tactic: tactic || null }),
      });
      const j = await r.json();
      if (j.ok) { setDone(verdict); onVerdict && onVerdict(); }
    } finally { setBusy(false); }
  }

  if (!selected) {
    return <aside className="inspector"><div className="insp-empty t-body">Select a decision to see why it was made.</div></aside>;
  }
  const last = detail && detail.decisions && detail.decisions[detail.decisions.length - 1];
  const ev = (last && last.evidence) || selected.evidence || [];
  const linked = (last && last.linked_identities) || [];
  const verdict = detail && detail.verdict || (done);

  return (
    <aside className={"inspector" + (open ? " open" : "")}>
      <div className="insp-head">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {last && <Pill action={last.action} />}
          {last && <ScoreRing score={last.score} />}
          <button className="icon-btn insp-close" aria-label="Close" onClick={onClose} style={{ marginLeft: "auto" }}><I.x /></button>
        </div>
        <div className="t-caption secondary" style={{ marginTop: 8 }}>
          <span className="mono">{sid}</span>
        </div>
      </div>
      <div className="insp-body">
        {last && last.explanation && (
          <>
            <div className="nav-section t-caption secondary" style={{ padding: "8px 0 4px" }}>Why</div>
            <p className="t-body">{last.explanation}</p>
          </>
        )}

        {ev.length > 0 && (
          <>
            <div className="nav-section t-caption secondary" style={{ padding: "14px 0 4px" }}>Evidence</div>
            <EvidenceList items={ev} />
          </>
        )}

        {linked.length > 0 && (
          <>
            <div className="nav-section t-caption secondary" style={{ padding: "14px 0 4px" }}>Linked identities</div>
            {linked.map((l, i) => (
              <div key={i} className="t-callout" style={{ display: "flex", gap: 6, color: "var(--label-secondary)" }}>
                <I.link /><span className="mono">{typeof l === "string" ? l : (l.identity_id || JSON.stringify(l))}</span>
              </div>
            ))}
          </>
        )}

        {detail && detail.turns && (
          <>
            <div className="nav-section t-caption secondary" style={{ padding: "14px 0 4px" }}>Transcript</div>
            <div className="surface" style={{ padding: 8 }}>
              {detail.turns.slice(-8).map((t, i) => (
                <div key={i} className="t-callout" style={{ padding: "4px 6px" }}>
                  <span className="secondary" style={{ textTransform: "capitalize" }}>{t.role}: </span>{t.content}
                </div>
              ))}
            </div>
          </>
        )}

        <div className="verdict-actions">
          {verdict
            ? <span className="chip">{verdict === "confirmed" ? "Confirmed attack — antigen retained" : verdict === "dismissed" ? "Dismissed — tolerance recorded" : verdict}</span>
            : <>
                <button className="btn destructive" disabled={busy} onClick={() => submit("confirmed")}>Confirm attack</button>
                <button className="btn tinted" disabled={busy} onClick={() => submit("dismissed")}>Dismiss</button>
              </>}
        </div>
      </div>
    </aside>
  );
}

/* ---- identity graph: same-actor links the risk engine drew (vis-network) ---- */
function GraphView() {
  const [data] = useFetch("/graph", 6000);
  const [selId, setSelId] = useState(null);
  const nodes = (data && data.nodes) || [];
  const edges = (data && data.edges) || [];
  const box = useRef(null);
  const net = useRef(null);
  const tv = useThemeVersion();

  /* rebuild the network on topology or theme change */
  const topo = useMemo(
    () => nodes.map((n) => [n.id, n.action, n.sessions, n.flagged].join(":")).sort().join(",") + "|" +
          edges.map((e) => e.source + "-" + e.target + "-" + e.weight).sort().join(","),
    [nodes, edges]);

  useEffect(() => {
    if (!box.current || typeof vis === "undefined" || nodes.length === 0) return;
    const font = cssVar("--font-sans");
    const dsNodes = new vis.DataSet(nodes.map((n) => {
      const col = actionHex(n.action);
      return {
        id: n.id,
        label: n.id.slice(0, 8),
        title: `${n.tenant || "unknown tenant"} · ${n.sessions} session(s) · score ${n.max_score}`,
        value: n.sessions || 1,
        shape: "dot",
        borderWidth: n.flagged ? 3 : 1.5,
        borderWidthSelected: 3,
        color: {
          background: withAlpha(col, 0.20), border: col,
          highlight: { background: withAlpha(col, 0.34), border: col },
          hover: { background: withAlpha(col, 0.30), border: col },
        },
        font: { color: cssVar("--label-tertiary"), size: 12, face: font },
      };
    }));
    const dsEdges = new vis.DataSet(edges.map((e, i) => ({
      id: i, from: e.source, to: e.target, value: e.weight || 1,
      color: { color: cssVar("--separator"), highlight: cssVar("--accent-fill"), hover: cssVar("--accent-fill") },
      smooth: { enabled: true, type: "continuous" },
    })));
    const network = new vis.Network(box.current, { nodes: dsNodes, edges: dsEdges }, {
      autoResize: true,
      nodes: { scaling: { min: 12, max: 34, label: { enabled: false } }, shadow: false },
      edges: { scaling: { min: 1, max: 5 }, width: 1, selectionWidth: 1 },
      physics: {
        stabilization: { iterations: 220 },
        barnesHut: { springLength: 130, gravitationalConstant: -3200, centralGravity: 0.35, damping: 0.6 },
      },
      interaction: { hover: true, tooltipDelay: 120, zoomView: true, dragView: true, navigationButtons: false },
      layout: { improvedLayout: true },
    });
    network.on("selectNode", (p) => setSelId(p.nodes[0] || null));
    network.on("deselectNode", () => setSelId(null));
    net.current = network;
    return () => { network.destroy(); net.current = null; };
  }, [topo, tv]); // eslint-disable-line react-hooks/exhaustive-deps

  const sel = nodes.find((n) => n.id === selId);

  return (
    <div className="pane">
      {!data && <Note>Loading graph…</Note>}
      {data && nodes.length === 0 && (
        <Note icon={I.graph} title="No links yet">
          As sessions arrive, the identities the risk engine ties to the same actor appear here — connected when it recognises account hopping.
        </Note>
      )}
      {nodes.length > 0 && (
        <>
          <div className="graph-wrap"><div ref={box} className="graph-net" /></div>
          <div className="legend t-caption">
            <span><span className="swatch" style={{ background: "var(--allow)" }} />allow</span>
            <span><span className="swatch" style={{ background: "var(--verify)" }} />verify</span>
            <span><span className="swatch" style={{ background: "var(--block)" }} />block</span>
            <span><span className="swatch" style={{ background: "var(--sandbox)" }} />sandbox</span>
            <span className="secondary">Size = sessions · line = same actor linked · drag to explore, scroll to zoom</span>
          </div>
          {sel && (
            <div className="surface node-detail">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Pill action={sel.action} />
                <ScoreRing score={sel.max_score} />
                <span className="mono t-caption secondary" style={{ marginLeft: "auto" }}>{sel.id}</span>
              </div>
              <div className="kv">
                <span className="chip">{sel.tenant || "unknown tenant"}</span>
                <span className="chip">{sel.sessions} {sel.sessions === 1 ? "session" : "sessions"}</span>
                {sel.flagged && <span className="pill block"><I.shield />Flagged</span>}
              </div>
              {sel.tactics && sel.tactics.length > 0 && (
                <div className="kv">{sel.tactics.map((t) => <span key={t} className="chip">{t}</span>)}</div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ---- dream cycle: memory consolidating confirmed attacks into campaigns ---- */
/* /dream (history) returns flat { id, text, tactics }; /dream/run returns the freshly
   consolidated { title, pattern, recommendation, tactics }. Normalize both to one shape. */
function normalizeInsight(ins, i) {
  const tactics = ins.tactics || [];
  if (ins.title || ins.pattern || ins.recommendation) {
    return {
      key: ins.id || "fresh-" + i,
      title: ins.title || "Emerging campaign",
      pattern: ins.pattern || "",
      watch: ins.recommendation || "",
      tactics,
    };
  }
  // flat history text: "statement | When: … | Involving: … | purpose"
  const parts = (ins.text || "").split("|").map((s) => s.trim()).filter(Boolean);
  const body = parts.filter((p) => !/^(when|involving)\s*:/i.test(p));
  return {
    key: ins.id || "hist-" + i,
    title: body[0] || "Emerging campaign",
    pattern: body.slice(1).join(" · "),
    watch: "",
    tactics,
  };
}

function DreamView() {
  const [data, reload] = useFetch("/dream");
  const [running, setRunning] = useState(false);
  const [source, setSource] = useState(null);
  const [fresh, setFresh] = useState(null);   // insights from the last run (richer shape)
  const [error, setError] = useState(null);

  const raw = fresh || (data && data.insights) || [];
  const insights = raw.map(normalizeInsight);

  async function run() {
    if (running) return;
    setRunning(true);
    setError(null);
    try {
      const r = await fetch("/dream/run", { method: "POST" });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const j = await r.json();
      setSource(j && j.source);
      if (j && Array.isArray(j.insights) && j.insights.length) {
        setFresh(j.insights);   // show what this pass just consolidated
      } else {
        reload();               // nothing returned — fall back to stored history
      }
    } catch {
      setError("Dream cycle didn't complete. Check the server and try again.");
    } finally {
      setRunning(false);
    }
  }

  const loading = !data && !fresh;

  return (
    <div className="pane">
      <div className="dream-head">
        <div style={{ minWidth: 0 }}>
          <div className="t-headline">Consolidated campaigns</div>
          <p className="secondary t-callout" style={{ margin: "2px 0 0", maxWidth: 520 }}>
            Between live traffic, memory reflects over every confirmed attack across tenants and
            groups single incidents into the higher-order campaigns agents should anticipate.
          </p>
        </div>
        <span className="spacer" />
        <button className="btn filled" disabled={running} onClick={run}>
          {running ? <><I.moon />Dreaming…</> : <><I.play />Run dream cycle</>}
        </button>
      </div>

      {source && !error && (
        <p className="t-caption secondary" style={{ margin: "0 0 12px" }}>
          Last pass used {source === "reflect" ? "Hindsight reflect" : "synthesis fallback"}.
        </p>
      )}
      {error && (
        <p className="t-caption" style={{ margin: "0 0 12px", color: "var(--block-text)" }}>{error}</p>
      )}

      {loading && <Note>Loading insights…</Note>}
      {!loading && insights.length === 0 && (
        <Note icon={I.moon} title="Nothing consolidated yet">
          Once a few attacks are confirmed, run a dream cycle to group them into higher-order campaigns.
        </Note>
      )}

      <div className="stats" style={{ gridTemplateColumns: "1fr" }}>
        {insights.map((ins) => (
          <div key={ins.key} className="surface dream">
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span className="pill sandbox"><I.moon />Emerging campaign</span>
            </div>
            <p className="title t-headline" style={{ marginTop: 10 }}>{ins.title}</p>
            {ins.pattern && <p className="pattern t-body">{ins.pattern}</p>}
            {ins.watch && (
              <div className="watch t-callout"><I.eye /><span>Watch for: {ins.watch}</span></div>
            )}
            {ins.tactics.length > 0 && (
              <div className="tactics" style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                {ins.tactics.map((t, ti) => <span key={t + ti} className="chip">{t}</span>)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---- eval harness: what memory buys, memory on vs off ---- */
function EvalView() {
  const [data, reload] = useFetch("/eval");
  useThemeVersion(); // re-read tokens when the theme flips
  if (!data) return <div className="pane"><Note>Loading eval report…</Note></div>;
  if (!data.available) {
    return (
      <div className="pane">
        <Note icon={I.target} title="No eval report yet">
          Run the labelled attack and benign set through both arms to generate one:
        </Note>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <code className="mono t-callout eval-cmd">./.venv/Scripts/python scripts/eval.py</code>
          <button className="btn tinted" onClick={reload}>Reload</button>
        </div>
      </div>
    );
  }
  const on = data.arms.memory_on, off = data.arms.memory_off;
  const pctRow = (label, key, hint) => ({
    label, hint,
    on: Math.round((on[key] || 0) * 100) + "%",
    off: Math.round((off[key] || 0) * 100) + "%",
  });
  const rows = [
    pctRow("Detection rate", "detection_rate", "attacks stopped at the money-moving turn — higher is better"),
    pctRow("False-positive rate", "false_positive_rate", "benign sessions wrongly stopped — lower is better"),
    { label: "Friction (verify asked)", hint: "benign sessions asked to verify", on: on.friction, off: off.friction },
    { label: "Latency p50", hint: "median per turn", on: on.latency_p50 + " ms", off: off.latency_p50 + " ms" },
    { label: "Latency p95", hint: "tail per turn", on: on.latency_p95 + " ms", off: off.latency_p95 + " ms" },
  ];

  const accent = cssVar("--accent-fill"), fill = cssVar("--fill-tertiary"), sep = cssVar("--separator");
  const pct = (x) => Math.round((x || 0) * 100);
  const pair = (onVals, offVals) => ({
    labels: onVals.labels,
    datasets: [
      { label: "Memory on", data: onVals.data, backgroundColor: withAlpha(accent, 0.85), borderColor: accent, borderWidth: 1, borderRadius: 6, maxBarThickness: 44 },
      { label: "Memory off", data: offVals, backgroundColor: fill, borderColor: sep, borderWidth: 1, borderRadius: 6, maxBarThickness: 44 },
    ],
  });
  const rateData = pair(
    { labels: ["Detection rate", "False-positive rate"], data: [pct(on.detection_rate), pct(on.false_positive_rate)] },
    [pct(off.detection_rate), pct(off.false_positive_rate)]);
  const rateOpts = {
    ...chartBase(),
    scales: {
      x: chartBase().scales.x,
      y: { ...chartBase().scales.y, min: 0, max: 100, ticks: { ...chartBase().scales.y.ticks, callback: (v) => v + "%" } },
    },
  };
  const latData = pair(
    { labels: ["p50", "p95"], data: [on.latency_p50, on.latency_p95] },
    [off.latency_p50, off.latency_p95]);
  const latOpts = {
    ...chartBase(),
    scales: {
      x: chartBase().scales.x,
      y: { ...chartBase().scales.y, ticks: { ...chartBase().scales.y.ticks, callback: (v) => v + " ms" } },
    },
  };

  return (
    <div className="pane">
      <div className="stats" style={{ marginBottom: 16 }}>
        <div className="stat"><div className="k t-callout">Sessions</div><div className="v tnum">{data.n_cases}</div></div>
        <div className="stat"><div className="k t-callout">Attacks</div><div className="v tnum">{on.attacks}</div></div>
        <div className="stat"><div className="k t-callout">Benign</div><div className="v tnum">{on.benign}</div></div>
        <div className="stat"><div className="k t-callout">Generated</div><div className="v tnum">{timeAgo(data.generated_at)}<small> ago</small></div></div>
      </div>
      <div className="chart-grid" style={{ marginBottom: 16 }}>
        <div className="surface chart-card">
          <div className="t-headline">Detection vs false positives</div>
          <p className="secondary t-callout" style={{ margin: "2px 0 8px" }}>Higher detection, lower false positives — memory on vs off.</p>
          <ChartCanvas type="bar" data={rateData} options={rateOpts} height={220} label="Detection and false-positive rate" />
        </div>
        <div className="surface chart-card">
          <div className="t-headline">Latency per turn</div>
          <p className="secondary t-callout" style={{ margin: "2px 0 8px" }}>Recall and retain cost — the price memory pays for context.</p>
          <ChartCanvas type="bar" data={latData} options={latOpts} height={220} label="Latency per turn" />
        </div>
      </div>
      <div className="surface" style={{ overflow: "hidden" }}>
        <table className="cmp">
          <thead>
            <tr><th>Metric</th><th className="num">Memory on</th><th className="num">Memory off</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <td>
                  <div className="t-body">{r.label}</div>
                  {r.hint && <div className="t-caption secondary">{r.hint}</div>}
                </td>
                <td className="num on">{r.on}</td>
                <td className="num off">{r.off}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="t-caption secondary" style={{ marginTop: 12 }}>
        Memory on cites prior history and confirmed antigens; memory off decides each turn blind. The gap is what the immune layer buys.
      </p>
    </div>
  );
}

/* ---- appearance: Light / Dark / Auto (tokens.css handles the rest) ---- */
function applyTheme(theme) {
  const el = document.documentElement;
  if (theme === "light" || theme === "dark") el.setAttribute("data-theme", theme);
  else el.removeAttribute("data-theme");
}
function useTheme() {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem("antibody-theme") || "auto"; } catch { return "auto"; }
  });
  const set = useCallback((t) => {
    setTheme(t);
    try {
      if (t === "auto") localStorage.removeItem("antibody-theme");
      else localStorage.setItem("antibody-theme", t);
    } catch { /* private mode — theme still applies for this session */ }
    applyTheme(t);
  }, []);
  return [theme, set];
}
function ThemeControl() {
  const [theme, setTheme] = useTheme();
  const opts = [["auto", "Auto"], ["light", "Light"], ["dark", "Dark"]];
  return (
    <div className="seg theme-seg" role="tablist" aria-label="Appearance">
      {opts.map(([id, label]) => (
        <button key={id} role="tab" aria-selected={theme === id} onClick={() => setTheme(id)}>{label}</button>
      ))}
    </div>
  );
}

/* ---- shared empty / loading note (explain, never just alarm) ---- */
function Note({ icon: Icon, title, children }) {
  return (
    <div className="note">
      {Icon && <span className="note-mark"><Icon /></span>}
      {title && <div className="t-headline">{title}</div>}
      {children && <p className="secondary t-callout" style={{ margin: "4px 0 0", maxWidth: 440 }}>{children}</p>}
    </div>
  );
}

/* ---- app shell ---- */
const NAV_GROUPS = [
  { section: "Live", items: [
    { id: "split",     label: "Split view",     icon: I.layers,   inspector: true  },
    { id: "feed",      label: "Threat feed",    icon: I.activity, inspector: true  },
    { id: "queue",     label: "Analyst queue",  icon: I.inbox,    inspector: true  },
  ] },
  { section: "Intelligence", items: [
    { id: "graph",     label: "Identity graph", icon: I.graph,    inspector: false },
    { id: "campaigns", label: "Campaigns",      icon: I.shield,   inspector: false },
    { id: "dream",     label: "Dream cycle",    icon: I.moon,     inspector: false },
  ] },
  { section: "Measure", items: [
    { id: "metrics",   label: "Metrics",        icon: I.chart,    inspector: false },
    { id: "eval",      label: "Eval",           icon: I.target,   inspector: false },
  ] },
];
const NAV = NAV_GROUPS.flatMap((g) => g.items);

function App() {
  const { events, connected } = useEventStream();
  const [view, setView] = useState("split");
  const [selected, setSelected] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [navOpen, setNavOpen] = useState(false);
  const [queueData] = useFetch("/queue", 5000);
  const pending = ((queueData && queueData.sessions) || []).filter((s) => !s.verdict).length;

  const active = NAV.find((n) => n.id === view);
  const showInspector = active.inspector;
  const onSelect = useCallback((e) => setSelected(e), []);
  const onVerdict = useCallback(() => setRefreshKey((k) => k + 1), []);
  const openView = useCallback((id) => { setView(id); setNavOpen(false); }, []);

  return (
    <div className={"shell" + (showInspector ? "" : " no-inspector")}>
      <nav className={"sidebar chrome" + (navOpen ? " open" : "")}>
        <div className="brand">
          <span className="mark"><I.shield /></span>
          <span className="t-headline">Antibody</span>
        </div>
        <div className="nav scroll">
          {NAV_GROUPS.map((g) => (
            <div className="nav-group" key={g.section}>
              <div className="nav-section t-caption secondary">{g.section}</div>
              {g.items.map((n) => (
                <button key={n.id} className="nav-item" aria-current={view === n.id}
                  onClick={() => openView(n.id)}>
                  <n.icon />{n.label}
                  {n.id === "queue" && pending > 0 && <span className="count tnum">{pending}</span>}
                </button>
              ))}
            </div>
          ))}
        </div>
        <div className="side-foot">
          <ThemeControl />
        </div>
      </nav>
      {navOpen && <button className="scrim" aria-label="Close menu" onClick={() => setNavOpen(false)} />}

      <div className="content">
        <div className="toolbar chrome">
          <button className="icon-btn menu-btn" aria-label="Open menu" onClick={() => setNavOpen(true)}><I.menu /></button>
          <span className="t-headline">{active.label}</span>
          <span className="spacer" />
          <span className={"conn t-caption" + (connected ? "" : " down")}>
            <span className="dot" />{connected ? "Live" : "Reconnecting"}
          </span>
        </div>
        <div className="content-body">
          {view === "split" && <SplitView events={events} onSelect={onSelect} selectedId={selected && selected.session_id} />}
          {view === "feed" && <FeedView events={events} onSelect={onSelect} selectedId={selected && selected.session_id} />}
          {view === "queue" && <QueueView selectedId={selected && selected.session_id} onSelect={onSelect} refreshKey={refreshKey} />}
          {view === "graph" && <GraphView />}
          {view === "campaigns" && <CampaignsView />}
          {view === "dream" && <DreamView />}
          {view === "metrics" && <MetricsView />}
          {view === "eval" && <EvalView />}
        </div>
      </div>

      {showInspector && (
        <Inspector selected={selected} onVerdict={onVerdict}
          open={!!selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
