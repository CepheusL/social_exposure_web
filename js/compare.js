/* ============ compare.js — several countries / industries / firms on one measure ============ */
(async () => {
  const { MEASURES, MEASURE_KEYS, STATS, esc } = App;
  const meta = await App.getMeta();
  await App.lookups();

  /* Entity colours: validated categorical order; an entity keeps its slot while others come and go */
  const PALETTE = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];
  const MAX = PALETTE.length;
  const TYPE_LABEL = { country: "Countries", industry: "Industries", firm: "Firms" };
  const PRESETS = {
    country: [["Largest markets", ["US", "GB", "CA", "JP", "CN", "DE"]], ["Europe", ["GB", "DE", "FR", "NL", "SE", "CH"]],
              ["Emerging markets", ["CN", "IN", "BR", "ZA", "MX"]]],
    industry: [["Finance vs energy", ["4", "26", "32", "47"]], ["Consumer", ["37", "20", "12", "29"]],
               ["Health and tech", ["16", "24", "9", "11"]]],
    firm: [["Big Tech", ["1690", "12141", "64768", "160329"]], ["Global consumer brands", ["7906", "221244", "245663", "25434"]],
           ["Energy majors", ["4503", "24625", "2410", "222111"]]],
  };

  // Year filters run to the last quarter's year (2025): quarterly views reach 2025Q1, annual data simply ends at 2024
  const LAST_YEAR = +meta.quarter_max.slice(0, 4);
  let type = ["country", "industry", "firm"].includes(App.param("entity_type")) ? App.param("entity_type") : "country";
  const state = {
    measure: MEASURES[App.param("measure")] ? App.param("measure") : "social",
    stat: STATS[App.param("stat")] ? App.param("stat") : "mean",
    freq: App.param("freq") === "quarterly" ? "quarterly" : "annual",
    scale: App.param("scale") === "yoy" ? "yoy" : "level",
    ymin: App.clamp(App.paramInt("year_min", meta.year_min), meta.year_min, LAST_YEAR),
    ymax: App.clamp(App.paramInt("year_max", LAST_YEAR), meta.year_min, LAST_YEAR),
  };
  if (state.ymin > state.ymax) [state.ymin, state.ymax] = [state.ymax, state.ymin];
  let slots = new Map(); // id -> palette index

  function loadSelection(t) {
    slots = new Map();
    const ids = App.paramList(t);
    ids.slice(0, MAX).forEach((id, i) => slots.set(id, i));
    if (ids.length > MAX) App.notice(document.getElementById("notice"), `Compare shows up to ${MAX} at a time. These are the first ${MAX}.`, "warn");
  }
  const freeSlot = () => { for (let i = 0; i < MAX; i++) if (![...slots.values()].includes(i)) return i; return -1; };

  function syncURL() {
    App.setParams({
      entity_type: type, country: null, industry: null, firm: null, [type]: [...slots.keys()],
      measure: state.measure, stat: state.stat === "mean" ? null : state.stat,
      freq: state.freq === "annual" ? null : state.freq, scale: state.scale === "level" ? null : state.scale,
      year_min: state.ymin === meta.year_min ? null : state.ymin, year_max: state.ymax === LAST_YEAR ? null : state.ymax,
    });
  }

  async function nameOf(id) {
    if (type === "country") return App.countryName(id);
    if (type === "industry") return App.industryName(id);
    const f = await App.getFirm(id); return f ? f.name : `Firm ${id}`;
  }

  /* ---------- Sidebar ---------- */
  App.segmented(document.getElementById("type-ctrl"), {
    name: "etype", label: "Entity type", value: type,
    options: [["country", "Countries"], ["industry", "Industries"], ["firm", "Firms"]],
    onChange: (v) => { type = v; slots = new Map(); renderChips(); update(); },
  });
  document.querySelector("#type-ctrl .segmented").style.gridTemplateColumns = "repeat(3, 1fr)";

  const input = document.getElementById("entity-input");
  App.combobox({
    input, list: document.getElementById("entity-list"),
    getItems: async (q) => {
      const items = type === "country" ? await App.searchCountries(q) : type === "industry" ? await App.searchIndustries(q) : await App.searchFirms(q);
      return items.filter((it) => !slots.has(it.id));
    },
    onSelect: (it) => {
      const s = freeSlot();
      if (s < 0) { App.toast(`The limit is ${MAX}. Remove one to add another.`); return; }
      slots.set(it.id, s); input.value = ""; renderChips(); update();
    },
  });

  async function renderChips() {
    document.getElementById("entity-label").textContent = TYPE_LABEL[type];
    input.placeholder = type === "firm" ? "Search firms by name or GVKEY…" : `Search ${TYPE_LABEL[type].toLowerCase()}…`;
    const box = document.getElementById("entity-chips");
    const parts = await Promise.all([...slots.entries()].map(async ([id, s]) => {
      const n = await nameOf(id);
      return `<span class="chip"><span class="chip-swatch" style="background:${PALETTE[s]}"></span>
        <span class="chip-text" title="${esc(n)}">${esc(n)}</span>
        <button type="button" data-id="${esc(id)}" aria-label="Remove ${esc(n)}">&times;</button></span>`;
    }));
    box.innerHTML = parts.join("");
    box.querySelectorAll("button").forEach((b) => b.onclick = () => { slots.delete(b.dataset.id); renderChips(); update(); });
  }

  const mSel = document.getElementById("ctrl-measure");
  mSel.innerHTML = MEASURE_KEYS.map((k) => `<option value="${k}">${esc(MEASURES[k])}</option>`).join("");
  mSel.value = state.measure;
  mSel.onchange = () => { state.measure = mSel.value; update(); };
  const sSel = document.getElementById("ctrl-stat");
  sSel.innerHTML = Object.entries(STATS).map(([k, s]) => `<option value="${k}">${esc(s.label)}</option>`).join("");
  sSel.value = state.stat;
  sSel.onchange = () => { state.stat = sSel.value; update(); };
  App.yearRange(document.getElementById("year-ctrl"), {
    min: meta.year_min, max: LAST_YEAR, from: state.ymin, to: state.ymax,
    onChange: (a, b) => { state.ymin = a; state.ymax = b; update(); },
  });
  document.getElementById("copy-link").onclick = () => App.copy(window.location.href, "Link copied");
  App.initDrawer("drawer-toggle", "sidebar");

  App.segmented(document.getElementById("ctrl-freq"), {
    name: "freq", label: "Frequency", value: state.freq, options: [["annual", "Annual"], ["quarterly", "Quarterly"]],
    onChange: (v) => { state.freq = v; update(); },
  });
  const scaleSel = document.getElementById("ctrl-scale");
  scaleSel.value = state.scale;
  scaleSel.onchange = () => { state.scale = scaleSel.value; update(); };

  /* ---------- Data ---------- */
  async function series(id) {
    if (type === "firm") {
      const rec = await App.loadFirm(id, state.freq);
      const map = App.firmToPeriods(rec, state.freq);
      return { value: (p) => (map[p] ? map[p][state.measure] : null), periods: Object.keys(map), nfirm: () => null };
    }
    let data = {};
    try { data = await App.loadAgg(type, id, state.freq); } catch { data = {}; }
    return {
      value: (p) => (data[p] && data[p][state.measure] ? data[p][state.measure][state.stat] : null),
      periods: Object.keys(data),
      nfirm: (p) => (data[p] && data[p][state.measure] ? data[p][state.measure].nfirm : null),
    };
  }

  /* ---------- Render ---------- */
  const body = document.getElementById("chart-body");
  let token = 0;

  async function update() {
    syncURL();
    const isFirm = type === "firm";
    sSel.disabled = isFirm;
    sSel.title = isFirm ? "A single firm has one value per period" : "";
    const stat = isFirm ? "mean" : state.stat;
    const pct = !isFirm && STATS[stat].pct;
    const statLabel = isFirm ? "Firm value" : STATS[stat].label;
    document.getElementById("chart-title").textContent = `${MEASURES[state.measure]} · ${TYPE_LABEL[type]}`;
    document.getElementById("chart-sub").textContent =
      `${statLabel}${state.scale === "yoy" ? " · change from a year earlier" : ""} · ${state.freq}`;
    const group = type === "country" ? "each country (by headquarters)" : "each industry (Fama-French 48)";
    document.getElementById("chart-caption").textContent = isFirm
      ? "Sentences on the topic per 1,000 sentences of each firm's earnings calls."
      : (pct ? `Share of firms in ${group} with at least one sentence on the topic.` : `${statLabel} across the firms in ${group}, in sentences per 1,000.`) +
        " Hover to see the number of firms.";

    const ids = [...slots.keys()];
    if (!ids.length) { renderEmpty(); return; }
    clearEmpty();

    const my = ++token;
    App.busy(body, true);
    try {
      const [all, names] = await Promise.all([Promise.all(ids.map(series)), Promise.all(ids.map(nameOf))]);
      if (my !== token) return;
      const periods = [...new Set(all.flatMap((s) => s.periods))]
        .filter((p) => { const y = App.periodYear(p); return y >= state.ymin && y <= state.ymax; }).sort();
      if (periods.length) document.getElementById("chart-sub").textContent += `, ${periods[0]}–${periods[periods.length - 1]}`;
      const lag = state.freq === "quarterly" ? 4 : 1;
      const scale = (vals) => state.scale !== "yoy" ? vals
        : vals.map((v, i) => (i < lag || v == null || vals[i - lag] == null ? null : v - vals[i - lag]));
      const datasets = ids.map((id, i) => ({
        label: names[i], color: PALETTE[slots.get(id)],
        data: scale(periods.map((p) => { const v = all[i].value(p); return v == null ? null : pct ? v * 100 : v; })),
        meta: isFirm ? null : periods.map((p) => ({ nfirm: all[i].nfirm(p) })),
      }));
      const unit = pct ? "% of firms" : "sentences per 1,000";
      Charts.line("compare-chart", { labels: periods, datasets }, {
        yLabel: state.scale === "yoy" ? `Change (${pct ? "percentage points" : unit})` : `${isFirm ? "Exposure" : STATS[stat].axis}${pct ? "" : ` (${unit})`}`,
        percent: pct && state.scale !== "yoy", zeroBase: state.scale !== "yoy",
        title: `${MEASURES[state.measure]} by ${type}`,
        valueFmt: (v) => (v == null ? "–" : pct ? v.toFixed(1) + (state.scale === "yoy" ? " pp" : "%") : v.toFixed(2)),
        filename: `compare_${state.measure}_${type}`,
      });
      renderSummary(ids, names, all, periods, pct);
    } catch (e) {
      console.error(e); App.toast("Could not load data: " + e.message);
    }
    if (my === token) App.busy(body, false);
  }

  function renderSummary(ids, names, all, periods, pct) {
    const f = (v) => (v == null ? "–" : pct ? (v * 100).toFixed(1) + "%" : v.toFixed(2));
    const rows = ids.map((id, i) => {
      const vals = periods.map((p) => all[i].value(p));
      const valid = vals.map((v, j) => [v, periods[j]]).filter(([v]) => v != null);
      const avg = valid.length ? valid.reduce((a, [v]) => a + v, 0) / valid.length : null;
      const first = valid[0], last = valid[valid.length - 1];
      const change = first && last ? last[0] - first[0] : null;
      const nf = last ? all[i].nfirm(last[1]) : null;
      const href = type === "firm" ? App.link("firm.html", { id }) : App.link("explore.html", { [type]: id, measures: state.measure });
      return `<tr>
        <th scope="row"><span class="measure-dot" style="background:${PALETTE[slots.get(id)]};margin-right:8px"></span><a href="${href}">${esc(names[i])}</a></th>
        <td class="num">${f(avg)}</td>
        <td class="num">${first ? f(first[0]) + ` <span class="muted">(${first[1]})</span>` : "–"}</td>
        <td class="num">${last ? f(last[0]) + ` <span class="muted">(${last[1]})</span>` : "–"}</td>
        <td class="num">${change == null ? "–" : (change > 0 ? "+" : "") + (pct ? (change * 100).toFixed(1) + " pp" : change.toFixed(2))}</td>
        ${type === "firm" ? "" : `<td class="num">${nf == null ? "–" : App.num(nf)}</td>`}
      </tr>`;
    });
    document.getElementById("summary").innerHTML = `<table>
      <thead><tr><th scope="col">${{ country: "Country", industry: "Industry", firm: "Firm" }[type]}</th>
        <th scope="col" class="num">Average</th><th scope="col" class="num">First</th><th scope="col" class="num">Latest</th>
        <th scope="col" class="num">Change</th>${type === "firm" ? "" : '<th scope="col" class="num">Firms (latest)</th>'}</tr></thead>
      <tbody>${rows.join("")}</tbody></table>`;
  }

  function renderEmpty() {
    token++;
    App.busy(body, false);
    clearEmpty();
    const el = document.createElement("div");
    el.className = "empty-state"; el.id = "chart-empty";
    el.innerHTML = `<div class="empty-state-title">Add ${TYPE_LABEL[type].toLowerCase()} to compare</div>
      <p>Search in the left panel or pick a preset.</p>
      <div class="dialog-actions" style="justify-content:center">
        ${PRESETS[type].map(([l], i) => `<button type="button" class="btn btn-sm" data-preset="${i}">${esc(l)}</button>`).join("")}
      </div>`;
    body.appendChild(el);
    el.querySelectorAll("[data-preset]").forEach((b) => b.onclick = () => {
      slots = new Map(PRESETS[type][+b.dataset.preset][1].map((id, i) => [id, i]));
      renderChips(); update();
    });
    const canvas = document.getElementById("compare-chart");
    canvas.style.visibility = "hidden";
    document.getElementById("summary").innerHTML = "";
  }
  function clearEmpty() {
    const el = document.getElementById("chart-empty");
    if (el) el.remove();
    document.getElementById("compare-chart").style.visibility = "";
  }

  loadSelection(type);
  await renderChips();
  update();
})();
