/* ============ climate/compare.js — several countries / industries / firms on one measure ============ */
(async () => {
  const { TOPICS, TOPIC_KEYS, METRICS, METRIC_KEYS, STATS, esc } = App;
  const meta = await App.getMeta();
  await App.lookups();

  /* Entity colours: validated categorical order; an entity keeps its slot while others come and go */
  const PALETTE = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];
  const MAX = PALETTE.length;
  const TYPE_LABEL = { country: "Countries", industry: "Industries", firm: "Firms" };
  const NO_SHARE = new Set(["share", "mean_pos"]);
  const PRESETS = {
    country: [["Largest markets", ["US", "GB", "CA", "JP", "CN", "DE"]], ["Europe", ["GB", "DE", "FR", "NL", "ES", "NO"]],
              ["Emerging markets", ["CN", "IN", "BR", "ZA", "MX"]]],
    industry: [["Energy", ["47", "32", "14"]], ["Transition makers", ["17", "3", "13", "28"]],
               ["Finance", ["4", "26", "19", "36"]], ["Heavy industry", ["42", "10", "6", "31"]]],
    firm: [["Oil majors", ["US30231G1022", "US1667641005", "GB0007980591", "FR0000120271", "NO0010096985"]],
           ["Car makers", ["US88160R1014", "JP3633400001", "US3453708600", "US37045V1008", "DE0007664039"]],
           ["Utilities", ["US65339F1012", "US26441C2044", "ES0144580Y14", "IT0003128367", "DE0007037129"]],
           ["Big Tech", ["US0378331005", "US5949181045", "US02079K3059", "US0231351067"]]],
  };

  const LAST_YEAR = meta.year_max;
  let type = ["country", "industry", "firm"].includes(App.param("entity_type")) ? App.param("entity_type") : "country";
  const state = {
    topic: TOPICS[App.param("topic")] ? App.param("topic") : "cc",
    metric: METRICS[App.param("metric")] ? App.param("metric") : "expo",
    stat: STATS[App.param("stat")] ? App.param("stat") : "mean",
    freq: App.param("freq") === "quarterly" ? "quarterly" : "annual",
    scale: App.param("scale") === "yoy" ? "yoy" : "level",
    ymin: App.clamp(App.paramInt("year_min", meta.year_min), meta.year_min, LAST_YEAR),
    ymax: App.clamp(App.paramInt("year_max", LAST_YEAR), meta.year_min, LAST_YEAR),
  };
  if (state.ymin > state.ymax) [state.ymin, state.ymax] = [state.ymax, state.ymin];
  if (state.metric === "sent" && NO_SHARE.has(state.stat)) state.stat = "mean";
  const key = () => `${state.topic}_${state.metric}`;
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
      topic: state.topic === "cc" ? null : state.topic, metric: state.metric === "expo" ? null : state.metric,
      stat: state.stat === "mean" ? null : state.stat,
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
    input.placeholder = type === "firm" ? "Search by name, ISIN or GVKEY…" : `Search ${TYPE_LABEL[type].toLowerCase()}…`;
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

  const tSel = document.getElementById("ctrl-topic");
  tSel.innerHTML = TOPIC_KEYS.map((k) => `<option value="${k}">${esc(k === "cc" ? "Climate change (overall)" : TOPICS[k])}</option>`).join("");
  tSel.value = state.topic;
  tSel.onchange = () => { state.topic = tSel.value; update(); };
  const mSel = document.getElementById("ctrl-metric");
  mSel.innerHTML = METRIC_KEYS.map((k) => `<option value="${k}">${esc(METRICS[k])}</option>`).join("");
  mSel.value = state.metric;
  mSel.onchange = () => { state.metric = mSel.value; if (state.metric === "sent" && NO_SHARE.has(state.stat)) state.stat = "mean"; update(); };
  const sSel = document.getElementById("ctrl-stat");
  sSel.innerHTML = Object.entries(STATS).map(([k, s]) => `<option value="${k}">${esc(s.label)}</option>`).join("");
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
      return { value: (p) => (map[p] ? map[p][key()] : null), periods: Object.keys(map), nfirm: () => null };
    }
    let data = {};
    try { data = await App.loadAgg(type, id, state.freq); } catch { data = {}; }
    return {
      value: (p) => App.aggVal(data[p], key(), state.stat),
      periods: Object.keys(data),
      nfirm: (p) => (data[p] ? data[p].nfirm : null),
    };
  }

  /* ---------- Render ---------- */
  const body = document.getElementById("chart-body");
  let token = 0;

  async function update() {
    syncURL();
    const isFirm = type === "firm";
    sSel.value = state.stat;
    [...sSel.options].forEach((o) => { o.disabled = state.metric === "sent" && NO_SHARE.has(o.value); });
    sSel.disabled = isFirm;
    sSel.title = isFirm ? "A single firm has one value per period" : "";
    const stat = isFirm ? "mean" : state.stat;
    const pct = !isFirm && STATS[stat].pct;
    const statLabel = isFirm ? "Firm value" : STATS[stat].label;
    const label = App.measureLabel(state.topic, state.metric);
    document.getElementById("chart-title").textContent = `${label} · ${TYPE_LABEL[type]}`;
    document.getElementById("chart-sub").textContent =
      `${statLabel}${state.scale === "yoy" ? " · change from a year earlier" : ""} · ${state.freq}`;
    const group = type === "country" ? "each country (by headquarters)" : "each industry (Fama-French 48)";
    document.getElementById("chart-caption").textContent = (isFirm
      ? `${label} per 1,000 bigrams of each firm's earnings calls.`
      : (pct ? `Share of firms in ${group} with a nonzero value.` : `${statLabel} across the firms in ${group}, per 1,000 bigrams.`) +
        " Hover to see the number of firms.") + (state.metric === "neg" && !pct ? " Negative sentiment is shown as a positive count." : "");

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
      const unit = pct ? "% of firms" : "per 1,000 bigrams";
      Charts.line("compare-chart", { labels: periods, datasets }, {
        yLabel: state.scale === "yoy" ? `Change (${pct ? "percentage points" : unit})`
          : pct ? "% of firms discussing" : `${isFirm ? METRICS[state.metric] : `${statLabel} ${METRICS[state.metric].toLowerCase()}`} (${unit})`,
        percent: pct && state.scale !== "yoy", zeroBase: state.scale !== "yoy",
        title: `${label} by ${type}`,
        valueFmt: (v) => (v == null ? "–" : pct ? v.toFixed(1) + (state.scale === "yoy" ? " pp" : "%") : App.dec(v)),
        filename: `climate_compare_${key()}_${type}`,
      });
      renderSummary(ids, names, all, periods, pct);
    } catch (e) {
      console.error(e); App.toast("Could not load data: " + e.message);
    }
    if (my === token) App.busy(body, false);
  }

  function renderSummary(ids, names, all, periods, pct) {
    const f = (v) => (v == null ? "–" : pct ? (v * 100).toFixed(1) + "%" : App.dec(v));
    const rows = ids.map((id, i) => {
      const vals = periods.map((p) => all[i].value(p));
      const valid = vals.map((v, j) => [v, periods[j]]).filter(([v]) => v != null);
      const avg = valid.length ? valid.reduce((a, [v]) => a + v, 0) / valid.length : null;
      const first = valid[0], last = valid[valid.length - 1];
      const change = first && last ? last[0] - first[0] : null;
      const nf = last ? all[i].nfirm(last[1]) : null;
      const href = type === "firm" ? App.link("firm.html", { id })
        : App.link("explore.html", { [type]: id, measures: state.topic === "cc" ? null : state.topic, metric: state.metric === "expo" ? null : state.metric });
      return `<tr>
        <th scope="row"><span class="measure-dot" style="background:${PALETTE[slots.get(id)]};margin-right:8px"></span><a href="${href}">${esc(names[i])}</a></th>
        <td class="num">${f(avg)}</td>
        <td class="num">${first ? f(first[0]) + ` <span class="muted">(${first[1]})</span>` : "–"}</td>
        <td class="num">${last ? f(last[0]) + ` <span class="muted">(${last[1]})</span>` : "–"}</td>
        <td class="num">${change == null ? "–" : (change > 0 ? "+" : "") + (pct ? (change * 100).toFixed(1) + " pp" : App.dec(change))}</td>
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
    document.getElementById("compare-chart").style.visibility = "hidden";
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
