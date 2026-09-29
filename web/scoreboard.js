/* Big-screen scoreboard. Vanilla JS, polls /scoreboard-data. Dark, kiosk-grade. */
(function () {
  const ACTION = {
    allow:   { label: "Delivered",           cls: "allow"   },
    verify:  { label: "Verification asked",   cls: "verify"  },
    block:   { label: "Blocked",              cls: "block"   },
    sandbox: { label: "Delivered",            cls: "allow"   }, // decoy stays hidden
  };
  const ICON = {
    allow:  '<path d="M20 6 9 17l-5-5"/>',
    verify: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
    block:  '<path d="M18 6 6 18M6 6l12 12"/>',
  };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function pill(action) {
    const m = ACTION[action] || ACTION.block;
    const path = ICON[m.cls] || ICON.block;
    return `<span class="pill ${m.cls}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" `
      + `stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${path}</svg>${m.label}</span>`;
  }

  const $ = (id) => document.getElementById(id);

  function render(d) {
    $("s-att").textContent = d.attempts;
    $("s-blk").textContent = d.blocked;
    $("s-brc").textContent = d.breached;

    const leaders = d.leaders || [];
    $("leaders").innerHTML = leaders.length
      ? leaders.map((p, i) => `
          <div class="lrow">
            <span class="rank">${i + 1}</span>
            <span class="name">${esc(p.nickname)}</span>
            ${p.breached ? pill("allow").replace("Delivered", "Got through")
                         : `<span class="pill block"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${ICON.block}</svg>Held off</span>`}
            <span class="tries">${p.attempts} ${p.attempts === 1 ? "try" : "tries"}</span>
          </div>`).join("")
      : '<div class="empty">No players yet.</div>';

    const recent = d.recent || [];
    $("recent").innerHTML = recent.length
      ? recent.map((a) => `
          <div class="frow">
            <span class="name">${esc(a.nickname)}</span>
            <span class="msg">${esc(a.text)}</span>
            ${pill(a.action)}
          </div>`).join("")
      : '<div class="empty">Waiting for the first message…</div>';
  }

  async function tick() {
    try {
      const r = await fetch("/scoreboard-data");
      render(await r.json());
      $("conn").textContent = "Live";
      document.querySelector(".live .dot").style.background = "var(--allow)";
    } catch (e) {
      $("conn").textContent = "Reconnecting";
      document.querySelector(".live .dot").style.background = "var(--label-tertiary)";
    }
  }

  tick();
  setInterval(tick, 2500);
})();
