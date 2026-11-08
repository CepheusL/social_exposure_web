/* ============ climate/explore.js — time trends for global / country / industry / firm ============ */
(async () => {
  const { TOPICS, TOPIC_KEYS, TOPIC_COLORS, METRICS, METRIC_KEYS, STATS, esc } = App;
  const meta = await App.getMeta();
  await App.lookups();

  const LAST_YEAR = meta.year_max;
  const MIX_PERIODS = [[2001, 2005], [2006, 2010], [2011, 2015], [2016, 2019], [2020, 2022], [2023, 2024]];
  const SUB = ["op", "rg", "ph"];
  const OTHER = { key: "other", label: "Other climate change talk", color: "#c9c7bf" };
  const REF_COLOR = "#8a877f";
  const NO_SHARE = new Set(["share", "mean_pos"]);   // not defined for net sentiment, which can be negative
  const SHARE_DESC = {
    expo: "mention the topic", risk: "mention the topic in a sentence with risk or uncertainty words",
    pos: "mention the topic in a sentence with positive tone words", neg: "mention the topic in a sentence with negative tone words",
  };
  const FIRM_DESC = {
    expo: "Climate change bigrams on each topic per 1,000 bigrams of the firm's earnings calls",
    risk: "Topic bigrams in sentences with risk or uncertainty words, per 1,000 bigrams of the firm's earnings calls",
    pos: "Topic bigrams weighted by the positive tone words in their sentence, per 1,000 bigrams of the firm's earnings calls",
    neg: "Topic bigrams weighted by the negative tone words in their sentence, per 1,000 bigrams of the firm's earnings calls",
    sent: "Positive minus negative sentiment, per 1,000 bigrams of the firm's earnings calls",
  };

  /* ---------- State from URL ---------- */
  const lists = { country: App.paramList("country"), industry: App.paramList("industry"), firm: App.paramList("firm") };
  const scope = lists.firm.length ? "firm" : lists.country.length ? "country" : lists.industry.length ? "industry" : "global";
  const totalEntities = lists.country.length + lists.industry.length + lists.firm.length;
  const state = {
    scope,
    entity: scope === "global" ? null : lists[scope][0],
    measures: App.paramList("measures").filter((m) => TOPICS[m]),
    metric: METRICS[App.param("metric")] ? App.param("metric") : "expo",
    stat: STATS[App.param("stat")] ? App.param("stat") : "mean",
    freq: App.param("freq") === "quarterly" ? "quarterly" : "annual",
    scale: App.param("scale") === "yoy" ? "yoy" : "level",
    view: App.param("view") === "mix" ? "mix" : "trend",
    peers: App.param("peers") === "1",
    ymin: App.clamp(App.paramInt("year_min", meta.year_min), meta.year_min, LAST_YEAR),
    ymax: App.clamp(App.paramInt("year_max", LAST_YEAR), meta.year_min, LAST_YEAR),
  };
  if (!state.measures.length) state.measures = ["cc"];
  if (state.ymin > state.ymax) [state.ymin, state.ymax] = [state.ymax, state.ymin];
  if (state.metric === "sent" && NO_SHARE.has(state.stat)) state.stat = "mean";

  if (totalEntities > 1) {
    const ids = lists[scope];
    App.notice(document.getElementById("notice"),
      `Explore shows one ${scope} at a time.
       <a class="btn btn-sm" href="${App.link("compare.html", { entity_type: scope, [scope]: ids, topic: state.measures[0], metric: state.metric === "expo" ? null : state.metric })}">Open all ${ids.length} in Compare →</a>`);
  }

  function syncURL() {
    App.setParams({
      country: state.scope === "country" ? state.entity : null,
      industry: state.scope === "industry" ? state.entity : null,
      firm: state.scope === "firm" ? state.entity : null,
      measures: state.measures.length === 1 && state.measures[0] === "cc" ? null : state.measures,
      metric: state.metric === "expo" ? null : state.metric,
      stat: state.stat === "mean" ? null : state.stat,
      freq: state.freq === "annual" ? null : state.freq,
      scale: state.scale === "level" ? null : state.scale,
      view: state.view === "trend" ? null : state.view,
      peers: state.peers ? "1" : null,
      year_min: state.ymin === meta.year_min ? null : state.ymin,
      year_max: state.ymax === LAST_YEAR ? null : state.ymax,
    });
  }

  /* ---------- Sidebar ---------- */
  App.segmented(document.getElementById("scope-ctrl"), {
    name: "scope", label: "Scope", value: state.scope,
    options: [["global", "All firms"], ["country", "Country"], ["industry", "Industry"], ["firm", "Firm"]],
    onChange: (v) => { state.scope = v; state.entity = null; renderEntity(); if (v === "global") update(); else document.getElementById("entity-input").focus(); },
  });

  const entityInput = document.getElementById("entity-input");
  App.combobox({
    input: entityInput, list: document.getElementById("entity-list"),
    getItems: (q) => state.scope === "country" ? App.searchCountries(q) : state.scope === "industry" ? App.searchIndustries(q) : App.searchFirms(q),
    onSelect: (it) => { state.entity = it.id; entityInput.value = ""; renderEntity(); update(); },
  });

  async function entityName(sc, id) {
    if (sc === "country") return App.countryName(id);
    if (sc === "industry") return App.industryName(id);
    if (sc === "firm") { const f = await App.getFirm(id); return f ? f.name : `Firm ${id}`; }
    return "All firms";
  }

  async function renderEntity() {
    document.getElementById("entity-group").hidden = state.scope === "global";
    document.getElementById("entity-label").textContent = { country: "Country", industry: "Industry (FF48)", firm: "Firm" }[state.scope] || "";
    entityInput.placeholder = { country: "Search countries…", industry: "Search industries…", firm: "Search by name, ISIN or GVKEY…" }[state.scope] || "";
    const chip = document.getElementById("entity-chip");
    if (state.entity) {
      const name = await entityName(state.scope, state.entity);
      chip.innerHTML = `<span class="chip"><span class="chip-text">${esc(name)}</span>
        <button type="button" aria-label="Remove ${esc(name)}">&times;</button></span>`;
      chip.querySelector("button").onclick = () => { state.entity = null; renderEntity(); update(); };
    } else chip.innerHTML = "";
  }

  const mList = document.getElementById("measure-list");
  mList.innerHTML = TOPIC_KEYS.map((k) => `
    <label class="measure-item"><input type="checkbox" value="${k}" ${state.measures.includes(k) ? "checked" : ""}>
      <span class="measure-dot" style="background:${TOPIC_COLORS[k]}"></span>${esc(k === "cc" ? "Climate change (overall)" : TOPICS[k])}</label>`).join("");
  const guardMeasures = () => {
    const boxes = [...mList.querySelectorAll("input")];
    const checked = boxes.filter((b) => b.checked);
    boxes.forEach((b) => { b.disabled = checked.length === 1 && b.checked; b.title = b.disabled ? "At least one topic stays selected" : ""; });
  };
  mList.addEventListener("change", () => {
    state.measures = [...mList.querySelectorAll("input:checked")].map((b) => b.value);
    guardMeasures(); update();
  });
  guardMeasures();

  App.yearRange(document.getElementById("year-ctrl"), {
    min: meta.year_min, max: LAST_YEAR, from: state.ymin, to: state.ymax,
    onChange: (a, b) => { state.ymin = a; state.ymax = b; update(); },
  });
  document.getElementById("copy-link").onclick = () => App.copy(window.location.href, "Link copied");
  App.initDrawer("drawer-toggle", "sidebar");

  /* ---------- View controls ---------- */
  const metricSel = document.getElementById("ctrl-metric");
  metricSel.innerHTML = METRIC_KEYS.map((k) => `<option value="${k}">${esc(METRICS[k])}</option>`).join("");
  metricSel.value = state.metric;
  metricSel.onchange = () => { state.metric = metricSel.value; if (state.metric === "sent" && NO_SHARE.has(state.stat)) state.stat = "mean"; update(); };
  const statSel = document.getElementById("ctrl-stat");
  statSel.innerHTML = Object.entries(STATS).map(([k, s]) => `<option value="${k}">${esc(s.label)}</option>`).join("");
  statSel.onchange = () => { state.stat = statSel.value; update(); };
  const freqCtrl = App.segmented(document.getElementById("ctrl-freq"), {
    name: "freq", label: "Frequency", value: state.freq, options: [["annual", "Annual"], ["quarterly", "Quarterly"]],
    onChange: (v) => { state.freq = v; update(); },
  });
  App.segmented(document.getElementById("ctrl-view"), {
    name: "view", label: "View", value: state.view, options: [["trend", "Trend"], ["mix", "Topic mix"]],
    onChange: (v) => { state.view = v; update(); },
  });
  const scaleSel = document.getElementById("ctrl-scale");
  scaleSel.value = state.scale;
  scaleSel.onchange = () => { state.scale = scaleSel.value; update(); };
  const peersBox = document.getElementById("ctrl-peers");
  peersBox.checked = state.peers;
  peersBox.onchange = () => { state.peers = peersBox.checked; update(); };

  function syncControls() {
    const isFirm = state.scope === "firm" && state.entity;
    const isMix = state.view === "mix";
    statSel.value = state.stat;
    metricSel.value = state.metric;
    [...statSel.options].forEach((o) => { o.disabled = state.metric === "sent" && NO_SHARE.has(o.value); });
    statSel.disabled = isFirm || isMix;
    statSel.title = isFirm ? "A firm has one value per period" : isMix ? "The topic mix uses means" : "";
    metricSel.disabled = isMix;
    metricSel.title = isMix ? "The topic mix splits exposure" : "";
    scaleSel.disabled = isMix;
    freqCtrl.setDisabled("quarterly", isMix);
    const peersOk = isFirm && !isMix && state.measures.length === 1;
    peersBox.disabled = !peersOk;
    document.getElementById("peers-wrap").title = !isFirm ? "Select a firm first" : state.measures.length !== 1 ? "Select one topic first" : "";
  }

  /* ---------- Data ---------- */
  async function getSeries(sc, id, freq) {
    if (sc === "firm") {
      const rec = await App.loadFirm(id, freq);
      const map = App.firmToPeriods(rec, freq);
      return { periods: Object.keys(map).sort(), value: (p, k) => (map[p] ? map[p][k] : null), nfirm: () => null, firm: true };
    }
    const data = await App.loadAgg(sc, id, freq);
    return {
      periods: Object.keys(data).sort(),
      value: (p, k, stat) => App.aggVal(data[p], k, stat),
      nfirm: (p) => (data[p] ? data[p].nfirm : null),
      firm: false,
    };
  }

  function applyScale(vals) {
    if (state.scale !== "yoy") return vals;
    const lag = state.freq === "quarterly" ? 4 : 1;
    return vals.map((v, i) => (i < lag || v == null || vals[i - lag] == null ? null : v - vals[i - lag]));
  }

  /* ---------- Render ---------- */
  const body = document.getElementById("chart-body");
  let token = 0;

  async function update() {
    syncControls();
    syncURL();
    const my = ++token;
    App.busy(body, true);
    try {
      const scopeKey = state.scope !== "global" && state.entity ? state.scope : "global";
      const id = scopeKey === "global" ? null : state.entity;
      const name = await entityName(scopeKey, id);
      if (state.view === "mix") await renderMix(scopeKey, id, name, my);
      else await renderTrend(scopeKey, id, name, my);
    } catch (e) {
      console.error(e);
      App.toast("Could not load data: " + e.message);
    }
    if (my === token) App.busy(body, false);
  }

  async function renderTrend(scopeKey, id, name, my) {
    const s = await getSeries(scopeKey, id, state.freq);
    if (my !== token) return;
    const periods = s.periods.filter((p) => { const y = App.periodYear(p); return y >= state.ymin && y <= state.ymax; });
    const stat = s.firm ? "mean" : state.stat;
    const pct = !s.firm && STATS[stat].pct;
    const toVal = (v) => (v == null ? null : pct ? v * 100 : v);
    const statLabel = s.firm ? "Firm value" : STATS[stat].label;
    const metric = state.metric;
    const key = (t) => `${t}_${metric}`;

    const datasets = state.measures.map((t) => ({
      label: t === "cc" ? "Climate change (overall)" : TOPICS[t], color: TOPIC_COLORS[t], width: t === "cc" ? 2.8 : 2,
      data: applyScale(periods.map((p) => toVal(s.value(p, key(t), stat)))),
      meta: s.firm ? null : periods.map((p) => ({ nfirm: s.nfirm(p) })),
    }));

    const peersOn = s.firm && state.peers && state.measures.length === 1;
    if (peersOn) {
      const firm = await App.getFirm(id);
      const k = key(state.measures[0]);
      const refs = [];
      if (firm && firm.industry) refs.push(["industry", firm.industry, `Industry mean (${App.industryShort(firm.industry)})`, []]);
      if (firm && firm.country) refs.push(["country", firm.country, `Country mean (${App.countryName(firm.country)})`, [6, 4]]);
      refs.push(["global", null, "All-firm mean", [2, 3]]);
      const series = await Promise.all(refs.map(([kind, rid]) => getSeries(kind, rid, state.freq)));
      if (my !== token) return;
      series.forEach((rs, i) => datasets.push({
        label: refs[i][2], color: REF_COLOR, width: 1.6, dash: refs[i][3], order: 1,
        data: applyScale(periods.map((p) => rs.value(p, k, "mean"))),
      }));
      datasets[0].label = name;
    }

    document.getElementById("chart-title").textContent = name;
    const mLabel = state.measures.length === 1 ? App.measureLabel(state.measures[0], metric) : `${state.measures.length} topics · ${METRICS[metric]}`;
    document.getElementById("chart-sub").textContent =
      `${mLabel} · ${statLabel}${state.scale === "yoy" ? " · change from a year earlier" : ""} · ${state.freq}${periods.length ? `, ${periods[0]}–${periods[periods.length - 1]}` : ""}`;

    const unit = pct ? "% of firms" : "per 1,000 bigrams";
    const yLabel = state.scale === "yoy" ? `Change (${pct ? "percentage points" : unit})`
      : s.firm ? `${METRICS[metric]} (${unit})` : pct ? "% of firms discussing" : `${statLabel} ${METRICS[metric].toLowerCase()} (${unit})`;
    const who = scopeKey === "global" ? "all firms" : scopeKey === "country" ? `firms headquartered in ${name}` : `firms in ${name}`;
    document.getElementById("chart-caption").textContent = s.firm
      ? `${FIRM_DESC[metric]} in the ${state.freq === "quarterly" ? "quarter" : "year"}.` +
        (metric === "neg" ? " Negative sentiment is shown as a positive count." : "") +
        (peersOn ? " Grey lines show the mean for the firm's industry, its country and all firms." : "")
      : (pct ? `Share of ${who} whose calls ${SHARE_DESC[metric]}.` : `${statLabel} across ${who}, per 1,000 bigrams.`) +
        (metric === "neg" && !pct ? " Negative sentiment is shown as a positive count." : "") + " Hover to see the number of firms.";

    if (!periods.length) {
      showEmpty("No data for this selection and year range.");
      Charts.line("explore-chart", { labels: [], datasets: [] }, {});
      renderCoverage(null, []);
      return;
    }
    clearEmpty();
    Charts.line("explore-chart", { labels: periods, datasets }, {
      yLabel, percent: pct && state.scale !== "yoy", zeroBase: state.scale !== "yoy",
      title: name,
      valueFmt: (v) => (v == null ? "–" : pct ? v.toFixed(1) + (state.scale === "yoy" ? " pp" : "%") : App.dec(v)),
      filename: `climate_explore_${(name || "global").replace(/\W+/g, "_")}`,
    });
    renderCoverage(s, periods);
  }

  async function renderMix(scopeKey, id, name, my) {
    const s = await getSeries(scopeKey, id, "annual");
    if (my !== token) return;
    const rows = [];
    for (const [a, b] of MIX_PERIODS) {
      const lo = Math.max(a, state.ymin), hi = Math.min(b, state.ymax);
      if (lo > hi) continue;
      const yrs = s.periods.filter((p) => +p >= lo && +p <= hi);
      const sumOf = (k) => yrs.reduce((acc, p) => acc + (s.value(p, k, "mean") || 0), 0);
      const total = sumOf("cc_expo");
      const tot = Object.fromEntries(SUB.map((t) => [t, sumOf(`${t}_expo`)]));
      tot.other = Math.max(0, total - SUB.reduce((acc, t) => acc + tot[t], 0));
      const label = lo === hi ? String(lo) : `${lo}–${String(hi).slice(2)}`;
      rows.push({
        label,
        values: total > 0 ? Object.fromEntries([...SUB, "other"].map((k) => [k, (tot[k] / total) * 100])) : null,
        note: !yrs.length ? "No data" : total > 0 ? `${yrs.length} year${yrs.length > 1 ? "s" : ""}` : "No climate change talk in this period",
      });
    }
    document.getElementById("chart-title").textContent = name;
    const inRange = s.periods.filter((p) => +p >= state.ymin && +p <= state.ymax);
    document.getElementById("chart-sub").textContent =
      `Climate change exposure by topic${inRange.length ? `, ${inRange[0]}–${inRange[inRange.length - 1]}` : ""}`;
    document.getElementById("chart-caption").textContent =
      "Each bar splits a period's climate change exposure into the three topics and other climate change talk. The topic bigram lists do not overlap.";
    if (!rows.length) { showEmpty("No data for this year range."); return; }
    clearEmpty();
    Charts.stackRows("explore-chart", {
      rows,
      keys: [...SUB.map((t) => ({ key: t, label: TOPICS[t], color: TOPIC_COLORS[t], ink: t === "rg" ? "#ffffff" : Charts.INK })),
             { key: OTHER.key, label: OTHER.label, color: OTHER.color, ink: Charts.INK }],
    }, { title: `${name}: topic mix by period`, part: "topic", filename: `climate_mix_${(name || "global").replace(/\W+/g, "_")}` });
    renderCoverage(s.firm ? null : s, inRange);
  }

  function renderCoverage(s, periods) {
    const card = document.getElementById("coverage-card");
    if (!s || s.firm || !periods.length) { card.hidden = true; return; }
    card.hidden = false;
    Charts.bars("coverage-chart", { labels: periods, values: periods.map((p) => s.nfirm(p)), label: "Firms" }, { title: "Number of firms per period" });
  }

  function showEmpty(msg) {
    clearEmpty();
    const el = document.createElement("div");
    el.className = "empty-state"; el.id = "chart-empty";
    el.innerHTML = `<div class="empty-state-title">No data to display</div><p>${esc(msg)}</p>`;
    body.appendChild(el);
    document.getElementById("explore-chart").style.visibility = "hidden";
  }
  function clearEmpty() {
    const el = document.getElementById("chart-empty");
    if (el) el.remove();
    document.getElementById("explore-chart").style.visibility = "";
  }

  await renderEntity();
  update();
})();
