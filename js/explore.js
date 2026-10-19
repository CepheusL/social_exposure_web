/* ============ explore.js — time trends for global / country / industry / firm ============ */
(async () => {
  const { MEASURES, MEASURE_KEYS, DOMAIN_KEYS, MEASURE_COLORS, STATS, esc } = App;
  const meta = await App.getMeta();
  await App.lookups();

  // Year filters run to the last quarter's year (2025): quarterly views reach 2025Q1, annual data simply ends at 2024
  const LAST_YEAR = +meta.quarter_max.slice(0, 4);
  const MIX_PERIODS = [[2003, 2007], [2008, 2012], [2013, 2017], [2018, 2019], [2020, 2021], [2022, 2024]];
  const REF_COLOR = "#8a877f";

  /* ---------- State from URL (with legacy multi-entity handling) ---------- */
  const lists = { country: App.paramList("country"), industry: App.paramList("industry"), firm: App.paramList("firm") };
  let scope = lists.firm.length ? "firm" : lists.country.length ? "country" : lists.industry.length ? "industry" : "global";
  const totalEntities = lists.country.length + lists.industry.length + lists.firm.length;
  const state = {
    scope,
    entity: scope === "global" ? null : lists[scope][0],
    measures: (App.paramList("measures").length ? App.paramList("measures") : [App.param("measure", "social")])
      .filter((m) => MEASURES[m]),
    stat: STATS[App.param("stat")] ? App.param("stat") : "mean",
    freq: App.param("freq") === "quarterly" ? "quarterly" : "annual",
    scale: App.param("scale") === "yoy" ? "yoy" : "level",
    view: App.param("view") === "mix" ? "mix" : "trend",
    peers: App.param("peers") === "1",
    ymin: App.clamp(App.paramInt("year_min", meta.year_min), meta.year_min, LAST_YEAR),
    ymax: App.clamp(App.paramInt("year_max", LAST_YEAR), meta.year_min, LAST_YEAR),
  };
  if (!state.measures.length) state.measures = ["social"];
  if (state.ymin > state.ymax) [state.ymin, state.ymax] = [state.ymax, state.ymin];

  if (totalEntities > 1) {
    const type = scope;
    const ids = lists[type];
    App.notice(document.getElementById("notice"),
      `Explore shows one ${type} at a time.
       <a class="btn btn-sm" href="${App.link("compare.html", { entity_type: type, [type]: ids, measure: state.measures[0] })}">Open all ${ids.length} in Compare →</a>`);
  }

  function syncURL() {
    App.setParams({
      country: state.scope === "country" ? state.entity : null,
      industry: state.scope === "industry" ? state.entity : null,
      firm: state.scope === "firm" ? state.entity : null,
      measures: state.measures, measure: null,
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
  const scopeCtrl = App.segmented(document.getElementById("scope-ctrl"), {
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

  async function entityName(scope, id) {
    if (scope === "country") return App.countryName(id);
    if (scope === "industry") return App.industryName(id);
    if (scope === "firm") { const f = await App.getFirm(id); return f ? f.name : `Firm ${id}`; }
    return "All firms";
  }

  async function renderEntity() {
    const grp = document.getElementById("entity-group");
    grp.hidden = state.scope === "global";
    document.getElementById("entity-label").textContent = { country: "Country", industry: "Industry (FF48)", firm: "Firm" }[state.scope] || "";
    entityInput.placeholder = { country: "Search countries…", industry: "Search industries…", firm: "Search by name or GVKEY…" }[state.scope] || "";
    const chip = document.getElementById("entity-chip");
    if (state.entity) {
      const name = await entityName(state.scope, state.entity);
      chip.innerHTML = `<span class="chip"><span class="chip-text">${esc(name)}</span>
        <button type="button" aria-label="Remove ${esc(name)}">&times;</button></span>`;
      chip.querySelector("button").onclick = () => { state.entity = null; renderEntity(); update(); };
    } else chip.innerHTML = "";
  }

  const mList = document.getElementById("measure-list");
  mList.innerHTML = MEASURE_KEYS.map((k) => `
    <label class="measure-item"><input type="checkbox" value="${k}" ${state.measures.includes(k) ? "checked" : ""}>
      <span class="measure-dot" style="background:${MEASURE_COLORS[k]}"></span>${esc(MEASURES[k])}</label>`).join("");
  const guardMeasures = () => {
    const boxes = [...mList.querySelectorAll("input")];
    const checked = boxes.filter((b) => b.checked);
    boxes.forEach((b) => { b.disabled = checked.length === 1 && b.checked; b.title = b.disabled ? "At least one measure stays selected" : ""; });
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
  const statSel = document.getElementById("ctrl-stat");
  statSel.innerHTML = Object.entries(STATS).map(([k, s]) => `<option value="${k}">${esc(s.label)}</option>`).join("");
  statSel.value = state.stat;
  statSel.onchange = () => { state.stat = statSel.value; update(); };
  const freqCtrl = App.segmented(document.getElementById("ctrl-freq"), {
    name: "freq", label: "Frequency", value: state.freq, options: [["annual", "Annual"], ["quarterly", "Quarterly"]],
    onChange: (v) => { state.freq = v; update(); },
  });
  const viewCtrl = App.segmented(document.getElementById("ctrl-view"), {
    name: "view", label: "View", value: state.view, options: [["trend", "Trend"], ["mix", "Domain mix"]],
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
    statSel.disabled = isFirm || isMix;
    statSel.title = isFirm ? "A firm has one value per period" : isMix ? "The domain mix uses means" : "";
    scaleSel.disabled = isMix;
    freqCtrl.setDisabled("quarterly", isMix);
    const peersOk = isFirm && !isMix && state.measures.length === 1;
    peersBox.disabled = !peersOk;
    document.getElementById("peers-wrap").title = !isFirm ? "Select a firm first"
      : state.measures.length !== 1 ? "Select one measure first" : "";
  }

  /* ---------- Data ---------- */
  async function getSeries(scope, id, freq) {
    if (scope === "firm") {
      const rec = await App.loadFirm(id, freq);
      const map = App.firmToPeriods(rec, freq);
      return { periods: Object.keys(map).sort(), value: (p, m) => (map[p] ? map[p][m] : null), nfirm: () => null, firm: true };
    }
    const data = await App.loadAgg(scope, id, freq);
    return {
      periods: Object.keys(data).sort(),
      value: (p, m, stat) => (data[p] && data[p][m] ? data[p][m][stat] : null),
      nfirm: (p) => (data[p] && data[p].social ? data[p].social.nfirm : null),
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

    let datasets = state.measures.map((m) => ({
      label: MEASURES[m], color: MEASURE_COLORS[m], width: m === "social" ? 2.8 : 2,
      data: applyScale(periods.map((p) => toVal(s.value(p, m, stat)))),
      meta: s.firm ? null : periods.map((p) => ({ nfirm: s.nfirm(p) })),
    }));

    const peersOn = s.firm && state.peers && state.measures.length === 1;
    if (peersOn) {
      const firm = await App.getFirm(id);
      const m = state.measures[0];
      const refs = [];
      if (firm && firm.industry) refs.push(["industry", firm.industry, `Industry mean (${App.industryShort(firm.industry)})`, []]);
      if (firm && firm.country) refs.push(["country", firm.country, `Country mean (${App.countryName(firm.country)})`, [6, 4]]);
      refs.push(["global", null, "All-firm mean", [2, 3]]);
      const series = await Promise.all(refs.map(([k, rid]) => getSeries(k, rid, state.freq)));
      if (my !== token) return;
      series.forEach((rs, i) => datasets.push({
        label: refs[i][2], color: REF_COLOR, width: 1.6, dash: refs[i][3], order: 1,
        data: applyScale(periods.map((p) => rs.value(p, m, "mean"))),
      }));
      datasets[0].label = name;
    }

    const titleEl = document.getElementById("chart-title");
    titleEl.textContent = name;
    const mLabel = state.measures.length === 1 ? MEASURES[state.measures[0]] : `${state.measures.length} measures`;
    document.getElementById("chart-sub").textContent =
      `${mLabel} · ${statLabel}${state.scale === "yoy" ? " · change from a year earlier" : ""} · ${state.freq === "quarterly" ? "quarterly" : "annual"}${periods.length ? `, ${periods[0]}–${periods[periods.length - 1]}` : ""}`;

    const unit = pct ? "% of firms" : "sentences per 1,000";
    const yLabel = state.scale === "yoy" ? `Change (${pct ? "percentage points" : unit})` : s.firm ? `Exposure (${unit})` : `${STATS[stat].axis}${pct ? "" : ` (${unit})`}`;
    const who = scopeKey === "global" ? "all firms" : scopeKey === "country" ? `firms headquartered in ${name}` : `firms in ${name}`;
    document.getElementById("chart-caption").textContent = s.firm
      ? `Sentences on each topic per 1,000 sentences of the firm's earnings calls in the ${state.freq === "quarterly" ? "quarter" : "year"}.` +
        (peersOn ? " Grey lines show the mean for the firm's industry, its country and all firms." : "")
      : (pct ? `Share of ${who} with at least one sentence on the topic.` : `${statLabel} across ${who}, in sentences per 1,000.`) +
        " Hover to see the number of firms.";

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
      valueFmt: (v) => (v == null ? "–" : pct ? v.toFixed(1) + (state.scale === "yoy" ? " pp" : "%") : v.toFixed(2)),
      filename: `explore_${(name || "global").replace(/\W+/g, "_")}`,
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
      const tot = {};
      DOMAIN_KEYS.forEach((m) => { tot[m] = yrs.reduce((acc, p) => acc + (s.value(p, m, "mean") || 0), 0); });
      const sum = DOMAIN_KEYS.reduce((acc, m) => acc + tot[m], 0);
      const label = lo === hi ? String(lo) : `${lo}–${String(hi).slice(2)}`;
      rows.push({
        label,
        values: sum > 0 ? Object.fromEntries(DOMAIN_KEYS.map((m) => [m, (tot[m] / sum) * 100])) : null,
        note: !yrs.length ? "No data" : sum > 0 ? `${yrs.length} year${yrs.length > 1 ? "s" : ""}` : "No social discussion in this period",
      });
    }
    document.getElementById("chart-title").textContent = name;
    const inRange = s.periods.filter((p) => +p >= state.ymin && +p <= state.ymax);
    document.getElementById("chart-sub").textContent =
      `Domain shares by period${inRange.length ? `, ${inRange[0]}–${inRange[inRange.length - 1]}` : ""}`;
    document.getElementById("chart-caption").textContent =
      `Each bar splits a period's exposure across the five domains.`;
    if (!rows.length) { showEmpty("No data for this year range."); return; }
    clearEmpty();
    Charts.stackRows("explore-chart", {
      rows, keys: DOMAIN_KEYS.map((m) => ({ key: m, label: MEASURES[m], color: MEASURE_COLORS[m], ink: m === "emp" ? "#ffffff" : Charts.INK })),
    }, { title: `${name}: domain mix by period`, filename: `mix_${(name || "global").replace(/\W+/g, "_")}` });
    renderCoverage(s.firm ? null : s, s.periods.filter((p) => +p >= state.ymin && +p <= state.ymax));
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
