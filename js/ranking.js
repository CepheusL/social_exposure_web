/* ============ ranking.js — league tables ============ */
(async () => {
  const { MEASURES, MEASURE_KEYS, MEASURE_COLORS, esc, num } = App;
  const meta = await App.getMeta();
  await App.lookups();

  const TYPE_LABEL = { country: "Countries", industry: "Industries", firm: "Firms" };
  const hasParam = (k) => App.param(k) !== null;

  let entity = ["country", "industry", "firm"].includes(App.param("entity_type")) ? App.param("entity_type") : "country";
  const state = {
    measure: MEASURES[App.param("measure")] ? App.param("measure") : "social",
    mode: App.param("ranking_mode") || (entity === "firm" ? "period" : "single"),
    year: App.clamp(App.paramInt("ranking_year", meta.year_max), meta.year_min, meta.year_max),
    p0: App.clamp(App.paramInt("period_start", entity === "firm" ? 2015 : meta.year_min), meta.year_min, meta.year_max),
    p1: App.clamp(App.paramInt("period_end", meta.year_max), meta.year_min, meta.year_max),
    direction: App.param("direction") === "bottom" ? "bottom" : "top",
    topN: App.clamp(App.paramInt("top_n", 25), 5, 500),
    minFirms: hasParam("min_coverage") ? Math.max(0, App.paramInt("min_coverage", 10)) : 10,
    minYears: hasParam("min_years") ? Math.max(1, App.paramInt("min_years", 5)) : 5,
  };
  if (state.mode !== "period") state.mode = "single";
  if (state.p0 > state.p1) [state.p0, state.p1] = [state.p1, state.p0];

  let ranked = [];       // full sorted list after filters
  let shown = 0;         // rows currently in the table
  let highlightId = null;

  function syncURL() {
    App.setParams({
      entity_type: entity, measure: state.measure, ranking_mode: state.mode,
      ranking_year: state.mode === "single" ? state.year : null,
      period_start: state.mode === "period" ? state.p0 : null, period_end: state.mode === "period" ? state.p1 : null,
      direction: state.direction === "top" ? null : state.direction, top_n: state.topN === 25 ? null : state.topN,
      min_coverage: entity !== "firm" ? state.minFirms : null,
      min_years: entity === "firm" && state.mode === "period" ? state.minYears : null,
    });
  }

  /* ---------- Controls ---------- */
  App.segmented(document.getElementById("ctrl-entity"), {
    name: "entity", label: "Entity", value: entity,
    options: [["country", "Countries"], ["industry", "Industries"], ["firm", "Firms"]],
    onChange: (v) => {
      entity = v;
      if (v === "firm" && !hasParam("ranking_mode")) { state.mode = "period"; modeCtrl.set("period"); if (!hasParam("period_start")) { state.p0 = 2015; periodRange.set(state.p0, state.p1); } }
      syncControls(); render();
    },
  });
  const mSel = document.getElementById("ctrl-measure");
  mSel.innerHTML = MEASURE_KEYS.map((k) => `<option value="${k}">${esc(MEASURES[k])}</option>`).join("");
  mSel.value = state.measure;
  mSel.onchange = () => { state.measure = mSel.value; render(); };
  const modeCtrl = App.segmented(document.getElementById("ctrl-mode"), {
    name: "mode", label: "Mode", value: state.mode, options: [["single", "Single year"], ["period", "Period average"]],
    onChange: (v) => { state.mode = v; syncControls(); render(); },
  });
  const ySel = document.getElementById("ctrl-year");
  for (let y = meta.year_max; y >= meta.year_min; y--) ySel.insertAdjacentHTML("beforeend", `<option value="${y}">${y}</option>`);
  ySel.value = state.year;
  ySel.onchange = () => { state.year = +ySel.value; render(); };
  const periodRange = App.yearRange(document.getElementById("period-range"), {
    min: meta.year_min, max: meta.year_max, from: state.p0, to: state.p1, idPrefix: "per",
    onChange: (a, b) => { state.p0 = a; state.p1 = b; render(); },
  });
  const dSel = document.getElementById("ctrl-direction");
  dSel.value = state.direction;
  dSel.onchange = () => { state.direction = dSel.value; render(); };
  const nIn = document.getElementById("ctrl-topn");
  nIn.value = state.topN;
  nIn.onchange = () => { state.topN = App.clamp(parseInt(nIn.value, 10) || 25, 5, 500); nIn.value = state.topN; render(); };
  const minIn = document.getElementById("ctrl-min");
  minIn.onchange = () => {
    const v = Math.max(0, parseInt(minIn.value, 10) || 0);
    if (entity === "firm") state.minYears = Math.max(1, v); else state.minFirms = v;
    syncControls(); render();
  };

  function syncControls() {
    const period = state.mode === "period";
    document.getElementById("year-ctrl").hidden = period;
    document.getElementById("period-ctrl").hidden = !period;
    const minCtrl = document.getElementById("min-ctrl");
    if (entity === "firm") {
      minCtrl.hidden = !period;
      document.getElementById("min-label").textContent = "Min years";
      minIn.min = 1; minIn.max = state.p1 - state.p0 + 1; minIn.value = state.minYears;
      minCtrl.title = "Minimum years of data in the period";
    } else {
      minCtrl.hidden = false;
      document.getElementById("min-label").textContent = period ? "Min firms / yr" : "Min firms";
      minIn.min = 0; minIn.removeAttribute("max"); minIn.value = state.minFirms;
      minCtrl.title = "Minimum number of firms per year";
    }
  }

  const ctrlBtn = document.getElementById("controls-toggle");
  ctrlBtn.onclick = () => {
    const box = document.getElementById("rank-controls");
    const open = box.classList.toggle("open");
    ctrlBtn.setAttribute("aria-expanded", String(open));
  };

  /* ---------- Data ---------- */
  async function loadEntries() {
    const years = state.mode === "single" ? [state.year] : Array.from({ length: state.p1 - state.p0 + 1 }, (_, i) => state.p0 + i);
    if (entity === "firm") {
      const [lists] = await Promise.all([Promise.all(years.map((y) => App.loadJSON(`ranking/firm/${state.measure}/${y}.json`))), App.getFirms()]);
      const acc = new Map();
      lists.forEach((rows) => rows.forEach(([id, v]) => {
        if (v == null) return;
        const a = acc.get(id) || { sum: 0, k: 0 };
        a.sum += v; a.k++; acc.set(id, a);
      }));
      const out = [];
      for (const [id, a] of acc) {
        if (state.mode === "period" && a.k < state.minYears) continue;
        out.push({ id, val: a.sum / a.k, years: a.k });
      }
      return out;
    }
    const file = await App.loadJSON(`ranking/${state.measure}_${entity}.json`);
    const acc = new Map();
    years.forEach((y) => (file.years[String(y)] || []).forEach(([id, v, n, nf]) => {
      const a = acc.get(id) || { sum: 0, k: 0, nf: 0 };
      a.sum += v; a.k++; a.nf += nf; acc.set(id, a);
    }));
    const out = [];
    for (const [id, a] of acc) {
      const nfirm = a.nf / a.k;
      if (nfirm < state.minFirms) continue;
      out.push({ id, val: a.sum / a.k, years: a.k, nfirm });
    }
    return out;
  }

  let firmName = null;
  const nameOf = (e) => {
    if (entity === "country") return App.countryName(e.id);
    if (entity === "industry") return App.industryName(e.id);
    return (firmName && firmName.get(e.id)) || `Firm ${e.id}`;
  };

  /* ---------- Render ---------- */
  let token = 0;
  async function render() {
    syncURL();
    const my = ++token;
    const wrap = document.getElementById("ranking-wrap");
    App.busy(wrap, true);
    try {
      const entries = await loadEntries();
      if (my !== token) return;
      if (entity === "firm" && !firmName) firmName = new Map((await App.getFirms()).map((f) => [f.id, f.name]));
      const dir = state.direction === "top" ? -1 : 1;
      entries.forEach((e) => { e.name = nameOf(e); });
      entries.sort((a, b) => dir * (a.val - b.val) || a.name.localeCompare(b.name));
      // percentile = share of ranked entities with a lower value (ties share the same percentile)
      const asc = entries.map((e) => e.val).sort((a, b) => a - b);
      const below = (v) => { let lo = 0, hi = asc.length; while (lo < hi) { const m = (lo + hi) >> 1; if (asc[m] < v) lo = m + 1; else hi = m; } return lo; };
      entries.forEach((e) => { e.pct = asc.length > 1 ? App.clamp(Math.floor((below(e.val) / (asc.length - 1)) * 100), 1, 99) : 99; });
      ranked = entries;
      shown = Math.min(state.topN, ranked.length);
      highlightId = null;
      await drawTable();
    } catch (e) {
      console.error(e); App.toast("Could not load ranking: " + e.message);
    }
    if (my === token) App.busy(wrap, false);
  }

  const ord = (n) => { const s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };

  async function drawTable() {
    const isFirm = entity === "firm", period = state.mode === "period";
    const periodLabel = period ? `${state.p0}–${state.p1} average` : String(state.year);
    document.getElementById("ranking-summary").innerHTML = `
      <span>${state.direction === "top" ? "Highest" : "Lowest"}</span>
      <span class="tag">${TYPE_LABEL[entity]}</span><span class="tag">${esc(MEASURES[state.measure])}</span><span class="tag">${periodLabel}</span>
      <span>${num(ranked.length)} ranked${isFirm ? (period ? ` · ≥ ${state.minYears} years of data` : "") : ` · ≥ ${state.minFirms} firms${period ? " per year" : ""}`}</span>`;
    document.getElementById("ranking-head").innerHTML = `<tr>
      <th scope="col" class="num">#</th><th scope="col">${isFirm ? "Firm" : TYPE_LABEL[entity].replace(/ies$/, "y").replace(/s$/, "")}</th>
      ${isFirm ? '<th scope="col" class="col-sub">Country</th><th scope="col" class="col-sub">Industry</th>' : ""}
      <th scope="col">Exposure <span class="muted" style="text-transform:none;letter-spacing:0">(per 1,000 sentences)</span></th>
      <th scope="col" class="num">Percentile</th>
      ${isFirm ? (period ? '<th scope="col" class="num">Years</th>' : "") : `<th scope="col" class="num">Firms${period ? " / yr" : ""}</th>`}
    </tr>`;
    const tbody = document.getElementById("ranking-body");
    if (!ranked.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:36px;color:var(--muted)">Nothing matches these filters. Lower the minimum${isFirm ? " years" : " firms"} to see more.</td></tr>`;
      document.getElementById("ranking-more").innerHTML = "";
      return;
    }
    const firmMap = isFirm ? new Map((await App.getFirms()).map((f) => [f.id, f])) : null;
    const rows = ranked.slice(0, shown);
    const maxV = Math.max(...rows.map((r) => r.val), 1e-9);
    const color = MEASURE_COLORS[state.measure];
    tbody.innerHTML = rows.map((e, i) => {
      const f = firmMap && firmMap.get(e.id);
      const href = isFirm ? App.link("firm.html", { id: e.id }) : App.link("explore.html", { [entity]: e.id, measures: state.measure });
      return `<tr data-id="${esc(e.id)}"${e.id === highlightId ? ' class="highlight"' : ""}>
        <td class="rank">${i + 1}</td>
        <td class="name"><a href="${href}">${esc(e.name)}</a>${isFirm && f ? `<span class="name-sub">${esc(f.country || "–")} · ${esc(App.industryShort(f.industry))}</span>` : ""}</td>
        ${isFirm ? `<td class="sub col-sub">${esc(f ? App.countryName(f.country) : "–")}</td><td class="sub col-sub" title="${esc(f ? App.industryName(f.industry) : "")}">${esc(f ? App.industryShort(f.industry) : "–")}</td>` : ""}
        <td><div class="valbar"><span class="bar"><i style="width:${(e.val / maxV) * 100}%;background:${color}"></i></span><span class="v">${e.val.toFixed(2)}</span></div></td>
        <td class="num">${ord(e.pct)}</td>
        ${isFirm ? (period ? `<td class="num">${e.years}</td>` : "") : `<td class="num">${num(Math.round(e.nfirm))}</td>`}
      </tr>`;
    }).join("");
    const more = document.getElementById("ranking-more");
    more.innerHTML = shown < ranked.length
      ? `Showing ${num(shown)} of ${num(ranked.length)} · <button type="button" class="link-btn" id="show-more">Show ${Math.min(25, ranked.length - shown)} more</button>`
      : `Showing all ${num(ranked.length)}`;
    const btn = document.getElementById("show-more");
    if (btn) btn.onclick = () => { shown = Math.min(ranked.length, shown + 25); drawTable(); };
    document.getElementById("ranking-caption").textContent = isFirm
      ? `Values are each firm's annual exposure${period ? ", averaged over its years in the period" : ""}. Percentiles compare against all ranked firms.`
      : `Values are the mean across each ${entity === "country" ? "country's" : "industry's"} firms${period ? ", averaged over the period" : ""}. Percentiles compare against all ranked ${TYPE_LABEL[entity].toLowerCase()}.`;
  }

  /* ---------- Search within the ranking ---------- */
  const sIn = document.getElementById("search-entity");
  App.combobox({
    input: sIn, list: document.getElementById("search-list"),
    getItems: (q) => {
      const ql = q.toLowerCase();
      const out = [];
      for (let i = 0; i < ranked.length && out.length < 30; i++) {
        const e = ranked[i];
        if (e.name.toLowerCase().includes(ql) || e.id.toLowerCase() === ql) out.push({ id: e.id, label: e.name, sub: `Rank ${num(i + 1)} of ${num(ranked.length)} · ${e.val.toFixed(2)}` });
      }
      return out;
    },
    onSelect: async (it) => {
      const idx = ranked.findIndex((e) => e.id === it.id);
      if (idx < 0) return;
      highlightId = it.id;
      if (idx >= shown) shown = idx + 1;
      await drawTable();
      const row = document.querySelector(`#ranking-body tr[data-id="${CSS.escape(it.id)}"]`);
      if (row) row.scrollIntoView({ behavior: "smooth", block: "center" });
      sIn.value = it.label;
    },
  });

  /* ---------- Exports ---------- */
  document.getElementById("btn-csv").onclick = async () => {
    const rows = ranked.slice(0, shown);
    if (!rows.length) { App.toast("Nothing to export"); return; }
    const isFirm = entity === "firm";
    const firmMap = isFirm ? new Map((await App.getFirms()).map((f) => [f.id, f])) : null;
    const head = ["rank", "id", "name", ...(isFirm ? ["country", "industry"] : []), "value", "percentile", isFirm ? "years" : "firms"];
    const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
    const lines = rows.map((e, i) => {
      const f = firmMap && firmMap.get(e.id);
      return [i + 1, e.id, q(e.name), ...(isFirm ? [f ? f.country : "", q(f ? App.industryShort(f.industry) : "")] : []),
        e.val.toFixed(4), e.pct, isFirm ? e.years : e.nfirm.toFixed(1)].join(",");
    });
    const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `ranking_${state.measure}_${entity}.csv`; a.click();
    URL.revokeObjectURL(a.href);
    App.toast("CSV downloaded");
  };

  document.getElementById("btn-png").onclick = () => {
    const rows = ranked.slice(0, Math.min(shown, 60));
    if (!rows.length) { App.toast("Nothing to export"); return; }
    const scale = 2, W = 760, rowH = 26, top = 78;
    const H = top + rows.length * rowH + 40;
    const c = document.createElement("canvas");
    c.width = W * scale; c.height = H * scale;
    const ctx = c.getContext("2d");
    ctx.scale(scale, scale);
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, H);
    const F = Charts.FONT;
    ctx.fillStyle = Charts.INK; ctx.font = `600 16px ${F}`;
    ctx.fillText(`${MEASURES[state.measure]}: ${state.direction === "top" ? "highest" : "lowest"} ${TYPE_LABEL[entity].toLowerCase()}`, 24, 32);
    ctx.fillStyle = Charts.MUTED; ctx.font = `400 12px ${F}`;
    ctx.fillText(`${state.mode === "period" ? `${state.p0}–${state.p1} average` : state.year} · sentences per 1,000 · ${App.SITE.shortCite}`, 24, 52);
    const maxV = Math.max(...rows.map((r) => r.val), 1e-9);
    rows.forEach((e, i) => {
      const y = top + i * rowH;
      if (i % 2 === 0) { ctx.fillStyle = "#faf9f5"; ctx.fillRect(16, y - 17, W - 32, rowH); }
      ctx.fillStyle = Charts.MUTED; ctx.font = `500 12px ${F}`; ctx.textAlign = "right"; ctx.fillText(String(i + 1), 48, y);
      ctx.textAlign = "left"; ctx.fillStyle = Charts.INK; ctx.font = `500 12px ${F}`;
      let name = e.name; while (ctx.measureText(name).width > 330 && name.length > 4) name = name.slice(0, -2);
      ctx.fillText(name === e.name ? name : name + "…", 60, y);
      ctx.fillStyle = "#efeee8"; ctx.fillRect(410, y - 9, 260, 8);
      ctx.fillStyle = MEASURE_COLORS[state.measure]; ctx.fillRect(410, y - 9, (e.val / maxV) * 260, 8);
      ctx.fillStyle = Charts.INK; ctx.font = `600 12px ${F}`; ctx.textAlign = "right"; ctx.fillText(e.val.toFixed(2), W - 24, y);
      ctx.textAlign = "left";
    });
    ctx.fillStyle = Charts.MUTED; ctx.font = `400 10.5px ${F}`;
    ctx.fillText(`Source: ${App.SITE.shortCite}, "Unpacking Social Exposure," SSRN 6770779 · ${meta.data_version}`, 24, H - 14);
    const a = document.createElement("a");
    a.href = c.toDataURL("image/png"); a.download = `ranking_${state.measure}_${entity}.png`; a.click();
    App.toast("PNG downloaded");
  };
  document.getElementById("btn-link").onclick = () => App.copy(window.location.href, "Link copied");

  syncControls();
  render();
})();
