/* ============ climate/firm.js — firm profile and firm search ============ */
(async () => {
  const { TOPICS, TOPIC_KEYS, TOPIC_COLORS, METRICS, METRIC_KEYS, METRIC_COLORS, esc, num } = App;
  const REF_COLOR = "#8a877f";
  const SUB = ["op", "rg", "ph"];
  const ord = (n) => { const s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
  const rank = (p) => (p == null ? "–" : ord(Math.min(99, Math.max(1, Math.floor(p)))));

  const [meta] = await Promise.all([App.getMeta(), App.lookups()]);
  const id = App.param("id");
  const firm = id ? await App.getFirm(id) : null;
  const goFirm = (it) => { window.location.href = App.link("firm.html", { id: it.id }); };

  if (!firm) { await renderSearchView(id); return; }

  /* ================= Profile ================= */
  document.getElementById("firm-view").hidden = false;
  document.title = `${firm.name} | Firm-Level Climate Change Exposure`;
  App.rememberFirm(firm.id);
  App.combobox({ input: document.getElementById("firm-search"), list: document.getElementById("firm-search-list"),
                 getItems: (q) => App.searchFirms(q, 15), onSelect: goFirm });

  const rec = await App.loadFirm(firm.id, "annual");
  const periods = App.firmToPeriods(rec, "annual");
  const years = rec ? rec.years.map(String) : [];
  const global = await App.loadAgg("global");
  const gmean = (y, k) => App.aggVal(global[String(y)], k, "mean");

  document.getElementById("firm-name").textContent = firm.name;
  document.getElementById("firm-meta").innerHTML = [
    firm.country ? `<span><strong>Country</strong><a href="${App.link("explore.html", { country: firm.country })}">${esc(App.countryName(firm.country))}</a></span>` : "",
    firm.industry ? `<span><strong>Industry</strong><a href="${App.link("explore.html", { industry: firm.industry })}">${esc(App.industryName(firm.industry))}</a></span>` : "",
    `<span><strong>ISIN</strong>${esc(firm.id)}</span>`,
    firm.gvkey ? `<span><strong>GVKEY</strong>${esc(firm.gvkey)}</span>` : "",
    `<span><strong>Coverage</strong>${firm.first}–${firm.last}${rec ? ` (${rec.years.length} years)` : ""}</span>`,
  ].join("");

  const peerIds = rec && rec.peers ? rec.peers.map((p) => p[0]) : [];
  document.getElementById("act-explore").href = App.link("explore.html", { firm: firm.id, peers: 1 });
  document.getElementById("act-compare").href = App.link("compare.html", { entity_type: "firm", firm: [firm.id, ...peerIds].slice(0, 6) });
  document.getElementById("act-link").onclick = () => App.copy(window.location.href, "Link copied");
  linkSocialProfile();

  if (!rec) {
    document.getElementById("kpis").innerHTML = `<div class="notice notice-info" style="grid-column:1/-1">
      This firm has quarterly data only (${firm.first}). Switch the chart to Quarterly.</div>`;
  } else {
    renderKPIs();
    renderMultiples();
    renderPercentiles();
    renderPeers();
  }

  /** Link to the same company in the Social Exposure section when its GVKEY is there too. */
  async function linkSocialProfile() {
    const a = document.getElementById("act-social");
    if (!firm.gvkey) return;
    try {
      const root = App.BASE_PATH.replace(/\/climate$/, "");
      const idx = await fetch(`${root}/data/firm/index.json`).then((r) => (r.ok ? r.json() : {}));
      if (idx[firm.gvkey] !== undefined) { a.href = `${App.ROOT}firm.html?id=${encodeURIComponent(firm.gvkey)}`; a.hidden = false; }
    } catch { /* social data unavailable: keep the link hidden */ }
  }

  /* ---------- KPIs ---------- */
  function renderKPIs() {
    const i = rec.years.length - 1, y = rec.years[i];
    const v = rec.cc_expo[i];
    const gm = gmean(y, "cc_expo");
    const nPos = rec.cc_expo.filter((x) => x > 0).length;
    const tot = Object.fromEntries(SUB.map((t) => [t, rec[`${t}_expo`].reduce((a, b) => a + (b || 0), 0)]));
    const sum = SUB.reduce((a, t) => a + tot[t], 0);
    const dom = sum > 0 ? SUB.reduce((a, t) => (tot[t] > tot[a] ? t : a), SUB[0]) : null;
    const tiles = [
      { label: `Exposure in ${y}`, value: App.dec(v), sub: gm == null ? "" : `All-firm mean ${App.dec(gm)} per 1,000 bigrams` },
      { label: `Percentile in ${y}`, value: rank(rec.pct[i]), sub: `${rank(rec.pct_ctry[i])} in its country · ${rank(rec.pct_ind[i])} in its industry` },
      { label: "Years with climate talk", value: `${nPos} <span style="font-size:1rem;color:var(--muted);font-weight:500">of ${rec.years.length}</span>`,
        sub: `Average exposure ${App.dec(rec.avg)} across all years` },
      { label: "Main topic", value: dom ? `<span class="measure-dot" style="background:${TOPIC_COLORS[dom]};width:12px;height:12px"></span><span style="font-size:1.1rem">${esc(TOPICS[dom])}</span>` : "–",
        sub: dom ? `${Math.round((tot[dom] / sum) * 100)}% of its topic exposure` : "No topic exposure yet" },
    ];
    document.getElementById("kpis").innerHTML = tiles.map((t) => `
      <div class="kpi"><div class="k-label">${esc(t.label)}</div><div class="k-value">${t.value}</div><div class="k-sub">${esc(t.sub)}</div></div>`).join("");
  }

  /* ---------- Main chart: firm vs industry, country, all firms ---------- */
  const state = {
    topic: TOPICS[App.param("topic")] ? App.param("topic") : "cc",
    metric: METRICS[App.param("metric")] ? App.param("metric") : "expo",
    freq: App.param("freq") === "quarterly" || !rec ? "quarterly" : "annual",
  };
  const tSel = document.getElementById("ctrl-topic");
  tSel.innerHTML = TOPIC_KEYS.map((k) => `<option value="${k}">${esc(k === "cc" ? "Climate change (overall)" : TOPICS[k])}</option>`).join("");
  tSel.value = state.topic;
  tSel.onchange = () => { state.topic = tSel.value; renderMain(); };
  const mSel = document.getElementById("ctrl-metric");
  mSel.innerHTML = METRIC_KEYS.map((k) => `<option value="${k}">${esc(METRICS[k])}</option>`).join("");
  mSel.value = state.metric;
  mSel.onchange = () => { state.metric = mSel.value; renderMain(); };
  const freqCtrl = App.segmented(document.getElementById("ctrl-freq"), {
    name: "freq", label: "Frequency", value: state.freq, options: [["annual", "Annual"], ["quarterly", "Quarterly"]],
    onChange: (v) => { state.freq = v; renderMain(); },
  });
  if (!rec) freqCtrl.setDisabled("annual", true);

  const body = document.getElementById("main-body");
  let token = 0;
  async function renderMain() {
    App.setParams({ topic: state.topic === "cc" ? null : state.topic, metric: state.metric === "expo" ? null : state.metric,
                    freq: state.freq === "annual" ? null : state.freq });
    const my = ++token;
    App.busy(body, true);
    try {
      const k = `${state.topic}_${state.metric}`, freq = state.freq;
      const [own, ind, ctry, all] = await Promise.all([
        App.loadFirm(firm.id, freq),
        firm.industry ? App.loadAgg("industry", firm.industry, freq).catch(() => null) : null,
        firm.country ? App.loadAgg("country", firm.country, freq).catch(() => null) : null,
        App.loadAgg("global", null, freq),
      ]);
      if (my !== token) return;
      const map = App.firmToPeriods(own, freq);
      const ps = Object.keys(map).sort();
      const agg = (d) => ps.map((p) => (d ? App.aggVal(d[p], k, "mean") : null));
      const datasets = [{ label: firm.name, data: ps.map((p) => map[p][k]), color: state.topic === "cc" ? METRIC_COLORS[state.metric] : TOPIC_COLORS[state.topic], width: 2.8 }];
      if (ind) datasets.push({ label: `Industry mean (${App.industryShort(firm.industry)})`, data: agg(ind), color: REF_COLOR, width: 1.6, order: 1 });
      if (ctry) datasets.push({ label: `Country mean (${App.countryName(firm.country)})`, data: agg(ctry), color: REF_COLOR, width: 1.6, dash: [6, 4], order: 1 });
      datasets.push({ label: "All-firm mean", data: agg(all), color: REF_COLOR, width: 1.6, dash: [2, 3], order: 1 });
      const label = App.measureLabel(state.topic, state.metric);
      document.getElementById("main-title").textContent = `${firm.name} against its industry, country and all firms`;
      document.getElementById("main-sub").textContent = `${label} · ${freq} · per 1,000 bigrams`;
      document.getElementById("main-caption").textContent =
        "Grey lines show the mean for the firm's industry (Fama-French 48), its headquarters country and all firms." +
        (state.metric === "neg" ? " Negative sentiment is shown as a positive count." : "");
      Charts.line("firm-chart", { labels: ps, datasets }, {
        yLabel: `${METRICS[state.metric]} (per 1,000 bigrams)`, title: `${firm.name}: ${label}`,
        valueFmt: (v) => App.dec(v), filename: `climate_firm_${firm.id}_${k}`,
      });
    } catch (e) { console.error(e); App.toast("Could not load data: " + e.message); }
    if (my === token) App.busy(body, false);
  }
  renderMain();

  /* ---------- Small multiples: topics, then risk and tone ---------- */
  function multiples(boxId, items) {
    const series = items.map(([k]) => years.map((y) => periods[y] ? periods[y][k] : null));
    const top = Math.max(0.05, ...series.flat().filter((v) => v != null));
    document.getElementById(boxId).innerHTML = items.map(([k, label, color], i) => {
      const vals = series[i];
      const ref = years.map((y) => gmean(y, k));
      const valid = vals.filter((v) => v != null);
      const avg = valid.reduce((a, b) => a + b, 0) / Math.max(1, valid.length);
      return `<div class="dm">
        <div class="dm-name"><span class="measure-dot" style="background:${color}"></span>${esc(label)}</div>
        ${Charts.spark(vals, { color, ref, yMax: top * 1.05, h: 70, fill: true })}
        <div class="dm-val"><strong>${App.dec(vals[vals.length - 1] ?? 0)}</strong> in ${years[years.length - 1]} · avg ${App.dec(avg)}</div>
      </div>`;
    }).join("");
  }
  function renderMultiples() {
    const span = `${rec.years[0]}–${rec.years[rec.years.length - 1]}`;
    document.getElementById("dm-sub").textContent = `Annual exposure per 1,000 bigrams, ${span}. All panels share one scale. Grey shows the all-firm mean.`;
    multiples("domains", SUB.map((t) => [`${t}_expo`, TOPICS[t], TOPIC_COLORS[t]]));
    document.getElementById("tone-sub").textContent = `Climate change risk and sentiment per 1,000 bigrams, ${span}. All panels share one scale. Grey shows the all-firm mean.`;
    multiples("tone", [["cc_risk", "Risk", METRIC_COLORS.risk], ["cc_pos", "Positive sentiment", METRIC_COLORS.pos],
                       ["cc_neg", "Negative sentiment", METRIC_COLORS.neg]]);
  }

  /* ---------- Percentile chart ---------- */
  function renderPercentiles() {
    Charts.line("pct-chart", {
      labels: years,
      datasets: [
        { label: "All firms", data: rec.pct, color: TOPIC_COLORS.cc, width: 2.6 },
        { label: "Within country", data: rec.pct_ctry, color: REF_COLOR, width: 1.6 },
        { label: "Within industry", data: rec.pct_ind, color: REF_COLOR, width: 1.6, dash: [6, 4] },
      ],
    }, { yLabel: "Percentile", yMax: 100, title: `${firm.name}: percentile rank`, filename: `climate_firm_${firm.id}_percentile`,
         valueFmt: (v) => (v == null ? "–" : Math.round(v) + "") });
  }

  /* ---------- Peers ---------- */
  async function renderPeers() {
    const box = document.getElementById("peers");
    if (!rec.peers || !rec.peers.length) { box.innerHTML = `<p class="chart-caption" style="padding:16px 20px">No other firm in this industry has five or more years of data.</p>`; return; }
    const rows = [[firm.id, rec.avg, true], ...rec.peers.map(([pid, avg]) => [pid, avg, false])];
    const maxV = Math.max(...rows.map((r) => r[1] || 0), 1e-9);
    const parts = await Promise.all(rows.map(async ([pid, avg, self]) => {
      const f = await App.getFirm(pid);
      const name = f ? f.name : `Firm ${pid}`;
      const inner = `<span class="domain-name"><span>${esc(name)}${self ? " (this firm)" : ""}
          <small>${esc(f ? [App.countryName(f.country), `${f.first}–${f.last}`].join(" · ") : "")}</small></span></span>
        <span class="valbar"><span class="bar"><i style="width:${((avg || 0) / maxV) * 100}%;background:${self ? TOPIC_COLORS.cc : REF_COLOR}"></i></span></span>
        <span class="domain-val"><strong>${App.dec(avg)}</strong><span>average</span></span>`;
      return self ? `<div class="domain-row" style="background:#fcfbf8">${inner}</div>`
                  : `<a class="domain-row" href="${App.link("firm.html", { id: pid })}">${inner}</a>`;
    }));
    box.innerHTML = parts.join("");
  }

  /* ================= Search view ================= */
  async function renderSearchView(missingId) {
    document.getElementById("firm-search-view").hidden = false;
    document.getElementById("search-sub").textContent = missingId
      ? `No firm with ISIN ${missingId} in the data. Search by company name, ISIN or GVKEY.`
      : `${num(meta.dataset.firms)} firms in ${meta.dataset.countries} countries. Search by company name, ISIN or GVKEY.`;
    App.combobox({ input: document.getElementById("firm-search-big"), list: document.getElementById("firm-search-big-list"),
                   getItems: (q) => App.searchFirms(q, 20), onSelect: goFirm });
    const featured = await App.loadJSON("featured.json");
    const ref = featured.global_3y;
    document.getElementById("pool").innerHTML = featured.pool.map((p) => {
      const top = Math.max(...p.spark.filter((v) => v != null), ...ref.filter((v) => v != null));
      return App.firmCard(p, { ref, yMax: top * 1.05 });
    }).join("");
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
