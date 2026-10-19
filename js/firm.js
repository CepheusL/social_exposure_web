/* ============ firm.js — firm profile and firm search ============ */
(async () => {
  const { MEASURES, MEASURE_KEYS, DOMAIN_KEYS, MEASURE_COLORS, esc, num } = App;
  const REF_COLOR = "#8a877f";
  const ord = (n) => { const s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };

  const [meta] = await Promise.all([App.getMeta(), App.lookups()]);
  const id = App.param("id");
  const firm = id ? await App.getFirm(id) : null;
  const goFirm = (it) => { window.location.href = App.link("firm.html", { id: it.id }); };

  if (!firm) { await renderSearchView(id); return; }

  /* ================= Profile ================= */
  document.getElementById("firm-view").hidden = false;
  document.title = `${firm.name} — Unpacking Social Exposure`;
  App.rememberFirm(firm.id);
  App.combobox({ input: document.getElementById("firm-search"), list: document.getElementById("firm-search-list"),
                 getItems: (q) => App.searchFirms(q, 15), onSelect: goFirm });

  const rec = await App.loadFirm(firm.id, "annual");
  const years = rec ? rec.years.map(String) : [];
  const global = await App.loadAgg("global");

  document.getElementById("firm-name").textContent = firm.name;
  document.getElementById("firm-meta").innerHTML = [
    firm.country ? `<span><strong>Country</strong><a href="${App.link("explore.html", { country: firm.country })}">${esc(App.countryName(firm.country))}</a></span>` : "",
    firm.industry ? `<span><strong>Industry</strong><a href="${App.link("explore.html", { industry: firm.industry })}">${esc(App.industryName(firm.industry))}</a></span>` : "",
    `<span><strong>GVKEY</strong>${esc(firm.id)}</span>`,
    `<span><strong>Coverage</strong>${firm.first}–${firm.last}${rec ? ` (${rec.years.length} years)` : ""}</span>`,
  ].join("");

  const peerIds = rec && rec.peers ? rec.peers.map((p) => p[0]) : [];
  document.getElementById("act-explore").href = App.link("explore.html", { firm: firm.id, measures: "social", peers: 1 });
  document.getElementById("act-compare").href = App.link("compare.html", { entity_type: "firm", firm: [firm.id, ...peerIds].slice(0, 6), measure: "social" });
  document.getElementById("act-link").onclick = () => App.copy(window.location.href, "Link copied");

  if (!rec) {
    document.getElementById("kpis").innerHTML = `<div class="notice notice-info" style="grid-column:1/-1">
      This firm only has quarterly data (${firm.first}). Annual views start once a full year is available; switch the chart to Quarterly.</div>`;
  } else {
    renderKPIs();
    renderDomains();
    renderPercentiles();
    renderPeers();
  }

  /* ---------- KPIs ---------- */
  function renderKPIs() {
    const i = rec.years.length - 1, y = rec.years[i];
    const v = rec.social[i];
    const gm = global[String(y)] ? global[String(y)].social.mean : null;
    const nPos = rec.social.filter((x) => x > 0).length;
    const tot = Object.fromEntries(DOMAIN_KEYS.map((m) => [m, rec[m].reduce((a, b) => a + (b || 0), 0)]));
    const sum = DOMAIN_KEYS.reduce((a, m) => a + tot[m], 0);
    const dom = sum > 0 ? DOMAIN_KEYS.reduce((a, m) => (tot[m] > tot[a] ? m : a), DOMAIN_KEYS[0]) : null;
    const tiles = [
      { label: `Exposure in ${y}`, value: v == null ? "–" : v.toFixed(2), sub: gm == null ? "" : `All-firm mean: ${gm.toFixed(2)} sentences per 1,000` },
      { label: `Percentile in ${y}`, value: rec.pct[i] == null ? "–" : ord(Math.min(99, Math.max(1, Math.floor(rec.pct[i])))),
        sub: `Within country: ${rec.pct_ctry[i] == null ? "–" : ord(Math.min(99, Math.max(1, Math.floor(rec.pct_ctry[i]))))} · within industry: ${rec.pct_ind[i] == null ? "–" : ord(Math.min(99, Math.max(1, Math.floor(rec.pct_ind[i]))))}` },
      { label: "Years with social discussion", value: `${nPos} <span style="font-size:1rem;color:var(--muted);font-weight:500">of ${rec.years.length}</span>`,
        sub: `Average exposure ${rec.avg == null ? "–" : rec.avg.toFixed(2)} across all years` },
      { label: "Most-discussed domain", value: dom ? `<span class="measure-dot" style="background:${MEASURE_COLORS[dom]};width:12px;height:12px"></span><span style="font-size:1.1rem">${esc(MEASURES[dom])}</span>` : "–",
        sub: dom ? `${Math.round((tot[dom] / sum) * 100)}% of its domain exposure, all years` : "No domain exposure recorded" },
    ];
    document.getElementById("kpis").innerHTML = tiles.map((t) => `
      <div class="kpi"><div class="k-label">${esc(t.label)}</div><div class="k-value">${t.value}</div><div class="k-sub">${esc(t.sub)}</div></div>`).join("");
  }

  /* ---------- Main chart: firm vs industry, country, all firms ---------- */
  const state = {
    measure: MEASURES[App.param("measure")] ? App.param("measure") : "social",
    freq: App.param("freq") === "quarterly" || !rec ? "quarterly" : "annual",
  };
  const mSel = document.getElementById("ctrl-measure");
  mSel.innerHTML = MEASURE_KEYS.map((k) => `<option value="${k}">${esc(MEASURES[k])}</option>`).join("");
  mSel.value = state.measure;
  mSel.onchange = () => { state.measure = mSel.value; renderMain(); };
  const freqCtrl = App.segmented(document.getElementById("ctrl-freq"), {
    name: "freq", label: "Frequency", value: state.freq, options: [["annual", "Annual"], ["quarterly", "Quarterly"]],
    onChange: (v) => { state.freq = v; renderMain(); },
  });
  if (!rec) freqCtrl.setDisabled("annual", true);

  const body = document.getElementById("main-body");
  let token = 0;
  async function renderMain() {
    App.setParams({ measure: state.measure === "social" ? null : state.measure, freq: state.freq === "annual" ? null : state.freq });
    const my = ++token;
    App.busy(body, true);
    try {
      const m = state.measure, freq = state.freq;
      const [own, ind, ctry, all] = await Promise.all([
        App.loadFirm(firm.id, freq),
        firm.industry ? App.loadAgg("industry", firm.industry, freq).catch(() => null) : null,
        firm.country ? App.loadAgg("country", firm.country, freq).catch(() => null) : null,
        App.loadAgg("global", null, freq),
      ]);
      if (my !== token) return;
      const map = App.firmToPeriods(own, freq);
      const periods = Object.keys(map).sort();
      const agg = (d) => periods.map((p) => (d && d[p] && d[p][m] ? d[p][m].mean : null));
      const datasets = [{ label: firm.name, data: periods.map((p) => map[p][m]), color: MEASURE_COLORS[m], width: 2.8 }];
      if (ind) datasets.push({ label: `Industry: ${App.industryShort(firm.industry)}`, data: agg(ind), color: REF_COLOR, width: 1.6, order: 1 });
      if (ctry) datasets.push({ label: `Country: ${App.countryName(firm.country)}`, data: agg(ctry), color: REF_COLOR, width: 1.6, dash: [6, 4], order: 1 });
      datasets.push({ label: "All firms", data: agg(all), color: REF_COLOR, width: 1.6, dash: [2, 3], order: 1 });
      document.getElementById("main-title").textContent = `${MEASURES[m]}: ${firm.name} and its context`;
      document.getElementById("main-sub").textContent = `${freq === "quarterly" ? "Quarterly" : "Annual"} · sentences per 1,000 · grey lines are means across firms`;
      document.getElementById("main-caption").textContent =
        `Firm-level exposure compared with the mean across firms in its industry (Fama-French 48), its headquarters country, and the full sample.`;
      Charts.line("firm-chart", { labels: periods, datasets }, {
        yLabel: "Exposure (sentences per 1,000)", title: `${firm.name}: ${MEASURES[m]}`,
        filename: `firm_${firm.id}_${m}`,
      });
    } catch (e) { console.error(e); App.toast("Could not load data: " + e.message); }
    if (my === token) App.busy(body, false);
  }
  renderMain();

  /* ---------- Domain small multiples ---------- */
  function renderDomains() {
    const yMax = Math.max(0.5, ...DOMAIN_KEYS.flatMap((m) => rec[m].filter((v) => v != null)));
    const top = Math.ceil(yMax);
    document.getElementById("dm-sub").textContent = `Annual exposure, ${rec.years[0]}–${rec.years[rec.years.length - 1]}; same scale (0–${top}) in every panel; grey = all-firm mean`;
    document.getElementById("domains").innerHTML = DOMAIN_KEYS.map((m) => {
      const vals = rec[m];
      const ref = rec.years.map((y) => (global[String(y)] && global[String(y)][m] ? global[String(y)][m].mean : null));
      const avg = vals.reduce((a, b) => a + (b || 0), 0) / vals.length;
      return `<div class="dm">
        <div class="dm-name"><span class="measure-dot" style="background:${MEASURE_COLORS[m]}"></span>${esc(MEASURES[m])}</div>
        ${Charts.spark(vals, { color: MEASURE_COLORS[m], ref, yMax: top, h: 70, fill: true })}
        <div class="dm-val"><strong>${(vals[vals.length - 1] ?? 0).toFixed(2)}</strong> in ${rec.years[rec.years.length - 1]} · avg ${avg.toFixed(2)}</div>
      </div>`;
    }).join("");
  }

  /* ---------- Percentile chart ---------- */
  function renderPercentiles() {
    Charts.line("pct-chart", {
      labels: years,
      datasets: [
        { label: "All firms", data: rec.pct, color: MEASURE_COLORS.social, width: 2.6 },
        { label: "Within country", data: rec.pct_ctry, color: REF_COLOR, width: 1.6 },
        { label: "Within industry", data: rec.pct_ind, color: REF_COLOR, width: 1.6, dash: [6, 4] },
      ],
    }, { yLabel: "Percentile", yMax: 100, title: `${firm.name}: percentile rank`, filename: `firm_${firm.id}_percentile`,
         valueFmt: (v) => (v == null ? "–" : Math.round(v) + "") });
  }

  /* ---------- Peers ---------- */
  async function renderPeers() {
    const box = document.getElementById("peers");
    if (!rec.peers || !rec.peers.length) { box.innerHTML = `<p class="chart-caption" style="padding:16px 20px">No comparable firms with enough data in this industry.</p>`; return; }
    const rows = [[firm.id, rec.avg, true], ...rec.peers.map(([pid, avg]) => [pid, avg, false])];
    const maxV = Math.max(...rows.map((r) => r[1] || 0), 1e-9);
    const parts = await Promise.all(rows.map(async ([pid, avg, self]) => {
      const f = await App.getFirm(pid);
      const name = f ? f.name : `Firm ${pid}`;
      const inner = `<span class="domain-name"><span>${esc(name)}${self ? " (this firm)" : ""}
          <small>${esc(f ? [App.countryName(f.country), `${f.first}–${f.last}`].join(" · ") : "")}</small></span></span>
        <span class="valbar"><span class="bar"><i style="width:${((avg || 0) / maxV) * 100}%;background:${self ? MEASURE_COLORS.social : REF_COLOR}"></i></span></span>
        <span class="domain-val"><strong>${avg == null ? "–" : avg.toFixed(2)}</strong><span>average</span></span>`;
      return self ? `<div class="domain-row" style="background:#fcfbf8">${inner}</div>`
                  : `<a class="domain-row" href="${App.link("firm.html", { id: pid })}">${inner}</a>`;
    }));
    box.innerHTML = parts.join("");
  }

  /* ================= Search view ================= */
  async function renderSearchView(missingId) {
    document.getElementById("firm-search-view").hidden = false;
    document.getElementById("search-sub").textContent = missingId
      ? `No firm with GVKEY ${missingId} in the data. Search by company name or GVKEY.`
      : `${num(meta.dataset.firms)} firms in ${meta.dataset.countries} countries. Search by company name or GVKEY.`;
    App.combobox({ input: document.getElementById("firm-search-big"), list: document.getElementById("firm-search-big-list"),
                   getItems: (q) => App.searchFirms(q, 20), onSelect: goFirm });
    const featured = await App.loadJSON("featured.json");
    const yMax = Math.ceil(Math.max(...featured.pool.flatMap((p) => p.social_3y.filter((v) => v != null))) / 2) * 2;
    document.getElementById("pool").innerHTML = featured.pool.map((p) => App.firmCard(p, { ref: featured.global_3y, yMax })).join("");
    const recent = App.recentFirms();
    if (recent.length) {
      const firms = (await Promise.all(recent.map((r) => App.getFirm(r)))).filter(Boolean);
      if (firms.length) {
        document.getElementById("recent-wrap").hidden = false;
        document.getElementById("recent").innerHTML = firms.map((f) => `
          <a class="card" href="${App.link("firm.html", { id: f.id })}"><h3>${esc(f.name)}</h3>
            <p>${esc([App.countryName(f.country), App.industryShort(f.industry), `${f.first}–${f.last}`].join(" · "))}</p></a>`).join("");
      }
    }
  }
})().catch((e) => { console.error(e); App.toast("Could not load data: " + e.message); });
