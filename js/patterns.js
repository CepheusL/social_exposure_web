/* ============ patterns.js — country tile map + industry/country × year heatmap ============ */
(async () => {
  const { MEASURES, MEASURE_KEYS, STATS, esc, num } = App;
  const PANEL_STATS = ["mean", "median", "p75", "p90", "share", "mean_pos"];
  const MIN_FIRMS = 5;          // cells/tiles with fewer firms are greyed out
  const HEAT_MIN_COUNTRY = 50;  // country rows in the heatmap need this many firms in the latest year

  /* Tile grid: [code, column, row] — a rough geographic arrangement of every country in the data */
  const TILES = [
    ["CA", 2, 0], ["IS", 8, 0], ["FO", 9, 0], ["NO", 11, 0], ["SE", 12, 0], ["FI", 13, 0], ["RU", 16, 0],
    ["US", 2, 1], ["BM", 5, 1], ["IE", 8, 1], ["GB", 9, 1], ["DK", 11, 1], ["EE", 13, 1], ["KZ", 16, 1],
    ["MX", 2, 2], ["BS", 4, 2], ["IM", 8, 2], ["NL", 10, 2], ["DE", 11, 2], ["PL", 12, 2], ["LT", 13, 2], ["UA", 14, 2],
    ["KY", 3, 3], ["JM", 4, 3], ["PR", 5, 3], ["GG", 8, 3], ["JE", 9, 3], ["BE", 10, 3], ["LU", 11, 3], ["CZ", 12, 3],
    ["HU", 13, 3], ["RO", 14, 3], ["CN", 16, 3], ["KR", 17, 3], ["JP", 18, 3],
    ["CR", 2, 4], ["PA", 3, 4], ["VG", 5, 4], ["FR", 9, 4], ["LI", 10, 4], ["CH", 11, 4], ["AT", 12, 4], ["SI", 13, 4],
    ["TR", 14, 4], ["MO", 15, 4], ["HK", 16, 4], ["TW", 17, 4],
    ["CO", 3, 5], ["VE", 4, 5], ["VI", 5, 5], ["PT", 8, 5], ["ES", 9, 5], ["MC", 10, 5], ["IT", 11, 5], ["GR", 13, 5],
    ["CY", 14, 5], ["PK", 15, 5], ["IN", 16, 5], ["BD", 17, 5],
    ["PE", 3, 6], ["BR", 4, 6], ["GI", 8, 6], ["MA", 9, 6], ["MT", 11, 6], ["IL", 12, 6], ["JO", 13, 6], ["KW", 14, 6],
    ["LK", 16, 6], ["TH", 17, 6], ["VN", 18, 6], ["MH", 19, 6],
    ["CL", 3, 7], ["UY", 4, 7], ["EG", 11, 7], ["SA", 12, 7], ["BH", 13, 7], ["QA", 14, 7], ["MY", 17, 7], ["PH", 18, 7],
    ["AR", 3, 8], ["GH", 8, 8], ["NG", 9, 8], ["KE", 12, 8], ["AE", 13, 8], ["OM", 14, 8], ["SG", 17, 8], ["ID", 18, 8], ["PG", 19, 8],
    ["ZA", 11, 9], ["MU", 13, 9], ["AU", 18, 9],
    ["NZ", 19, 10],
  ];
  const COLS = 20, ROWS = 11;

  const [meta, pc, pi] = await Promise.all([App.getMeta(), App.loadJSON("panel/country.json"), App.loadJSON("panel/industry.json")]);
  await App.lookups();

  const state = {
    measure: MEASURES[App.param("measure")] && App.param("measure") ? App.param("measure") : "social",
    stat: PANEL_STATS.includes(App.param("stat")) ? App.param("stat") : "mean",
    year: App.clamp(App.paramInt("year", meta.year_max), meta.year_min, meta.year_max),
    rows: App.param("rows") === "country" ? "country" : "industry",
    sort: ["latest", "change", "name"].includes(App.param("sort")) ? App.param("sort") : "latest",
  };
  const syncURL = () => App.setParams({
    measure: state.measure === "social" ? null : state.measure, stat: state.stat === "mean" ? null : state.stat,
    year: state.year === meta.year_max ? null : state.year, rows: state.rows === "industry" ? null : state.rows,
    sort: state.sort === "latest" ? null : state.sort,
  });

  /* ---------- Controls ---------- */
  const mSel = document.getElementById("ctrl-measure");
  mSel.innerHTML = MEASURE_KEYS.map((k) => `<option value="${k}">${esc(MEASURES[k])}</option>`).join("");
  mSel.value = state.measure;
  mSel.onchange = () => { state.measure = mSel.value; renderAll(); };
  const sSel = document.getElementById("ctrl-stat");
  sSel.innerHTML = PANEL_STATS.map((k) => `<option value="${k}">${esc(STATS[k].label)}</option>`).join("");
  sSel.value = state.stat;
  sSel.onchange = () => { state.stat = sSel.value; renderAll(); };
  const slider = document.getElementById("year-slider");
  slider.min = meta.year_min; slider.max = meta.year_max; slider.value = state.year;
  slider.oninput = () => { state.year = +slider.value; renderMap(); syncURL(); };
  App.segmented(document.getElementById("ctrl-rows"), {
    name: "rows", label: "Rows", value: state.rows, options: [["industry", "Industries"], ["country", "Countries"]],
    onChange: (v) => { state.rows = v; renderHeatmap(); syncURL(); },
  });
  const sortSel = document.getElementById("ctrl-sort");
  sortSel.value = state.sort;
  sortSel.onchange = () => { state.sort = sortSel.value; renderHeatmap(); syncURL(); };

  let timer = null;
  const playBtn = document.getElementById("play");
  const icon = document.getElementById("play-icon");
  const stop = () => { clearInterval(timer); timer = null; icon.setAttribute("d", "M3 1.5v11l9-5.5z"); playBtn.setAttribute("aria-label", "Play through the years"); };
  playBtn.onclick = () => {
    if (timer) { stop(); return; }
    if (state.year >= meta.year_max) state.year = meta.year_min - 1;
    icon.setAttribute("d", "M3 1.5h3v11H3zM8 1.5h3v11H8z");
    playBtn.setAttribute("aria-label", "Pause");
    timer = setInterval(() => {
      state.year++;
      if (state.year >= meta.year_max) { state.year = meta.year_max; stop(); }
      slider.value = state.year; renderMap(); syncURL();
    }, 850);
  };

  /* ---------- Shared helpers ---------- */
  const isPct = () => STATS[state.stat].pct;
  const fmtV = (v) => (v == null ? "–" : isPct() ? Math.round(v * 100) + "%" : v.toFixed(2));
  /** Colour cap: 95th percentile of all country/industry-year cells with enough firms, so years are comparable. */
  function scaleCap() {
    const vals = [];
    for (const p of [pc, pi]) {
      const mat = p.data[state.measure][state.stat];
      mat.forEach((row, i) => row.forEach((v, j) => { if (v != null && (p.nfirm[i][j] || 0) >= MIN_FIRMS) vals.push(v); }));
    }
    vals.sort((a, b) => a - b);
    const cap = vals[Math.floor(vals.length * 0.95)] || 1;
    return cap > 0 ? cap : 1;
  }
  let cap = 1;

  function renderLegend() {
    const stops = Charts.SEQ.map((c, i) => `${c} ${(i / (Charts.SEQ.length - 1)) * 100}%`).join(",");
    document.getElementById("legend").innerHTML = `
      <span>0</span><span class="ramp" style="background:linear-gradient(90deg,${stops})"></span><span>${fmtV(cap)}+</span>
      <span class="na"><i></i>Fewer than ${MIN_FIRMS} firms</span>`;
  }

  const tip = document.getElementById("viz-tip");
  function showTip(html, x, y) {
    tip.innerHTML = html; tip.classList.add("show");
    const r = tip.getBoundingClientRect();
    tip.style.left = Math.min(window.innerWidth - r.width - 8, x + 14) + "px";
    tip.style.top = Math.max(8, y - r.height - 10) + "px";
  }
  const hideTip = () => tip.classList.remove("show");
  function bindTips(container) {
    container.addEventListener("mousemove", (e) => { const t = e.target.closest("[data-tip]"); if (t) showTip(t.dataset.tip, e.clientX, e.clientY); else hideTip(); });
    container.addEventListener("mouseleave", hideTip);
    container.addEventListener("focusin", (e) => { const t = e.target.closest("[data-tip]"); if (t) { const r = t.getBoundingClientRect(); showTip(t.dataset.tip, r.right, r.top); } });
    container.addEventListener("focusout", hideTip);
  }

  /* ---------- Tile map ---------- */
  const cIdx = new Map(pc.ids.map((c, i) => [c, i]));
  function renderMap() {
    const yi = pc.years.indexOf(state.year);
    document.getElementById("map-year").textContent = state.year;
    document.getElementById("map-sub").textContent = `${MEASURES[state.measure]} · ${STATS[state.stat].label} · ${state.year}`;
    const grid = document.getElementById("tilemap");
    grid.style.gridTemplateColumns = `repeat(${COLS}, minmax(0, 1fr))`;
    grid.style.gridTemplateRows = `repeat(${ROWS}, auto)`;
    const mat = pc.data[state.measure][state.stat];
    grid.innerHTML = TILES.map(([code, col, row]) => {
      const i = cIdx.get(code);
      const v = i === undefined || yi < 0 ? null : mat[i][yi];
      const nf = i === undefined || yi < 0 ? 0 : pc.nfirm[i][yi] || 0;
      const name = App.countryName(code);
      const pos = `grid-column:${col + 1};grid-row:${row + 1}`;
      if (v == null || nf < MIN_FIRMS) {
        const why = nf ? `only ${nf} firm${nf > 1 ? "s" : ""}` : "no firms";
        return `<button type="button" class="tile na" style="${pos}" data-tip="<strong>${esc(name)}</strong><br><span class='tip-sub'>${state.year}: ${why}</span>" aria-label="${esc(name)}: ${why} in ${state.year}">${code}</button>`;
      }
      const t = v / cap;
      return `<button type="button" class="tile" data-code="${code}" style="${pos};background:${Charts.seq(t)};color:${Charts.seqInk(t)}"
        data-tip="<strong>${esc(name)}</strong><br>${fmtV(v)} <span class='tip-sub'>· ${num(nf)} firms · ${state.year}</span>"
        aria-label="${esc(name)}: ${fmtV(v)} in ${state.year}, ${nf} firms">${code}</button>`;
    }).join("");
    document.getElementById("map-caption").textContent =
      `Each tile is a headquarters country, placed roughly by geography. Colour shows the ${STATS[state.stat].label.toLowerCase()} ` +
      `across the country's firms in ${state.year}, on one scale for all years. Grey tiles have fewer than ${MIN_FIRMS} firms.`;
  }
  document.getElementById("tilemap").addEventListener("click", (e) => {
    const t = e.target.closest(".tile[data-code]");
    if (t) window.location.href = App.link("explore.html", { country: t.dataset.code, measures: state.measure, stat: state.stat === "mean" ? null : state.stat });
  });
  bindTips(document.getElementById("tilemap"));

  /* ---------- Heatmap ---------- */
  function renderHeatmap() {
    const p = state.rows === "country" ? pc : pi;
    const mat = p.data[state.measure][state.stat];
    const years = p.years, last = years.length - 1;
    let rows = p.ids.map((id, i) => ({ id, i, name: state.rows === "country" ? App.countryName(id) : App.industryName(id) }));
    if (state.rows === "country") rows = rows.filter((r) => (p.nfirm[r.i][last] || 0) >= HEAT_MIN_COUNTRY);
    const lastVal = (r) => mat[r.i][last] ?? -1;
    const firstVal = (r) => { const row = mat[r.i]; for (let j = 0; j < row.length; j++) if (row[j] != null && (p.nfirm[r.i][j] || 0) >= MIN_FIRMS) return row[j]; return null; };
    if (state.sort === "name") rows.sort((a, b) => a.name.localeCompare(b.name));
    else if (state.sort === "change") rows.sort((a, b) => ((lastVal(b) - (firstVal(b) ?? 0)) - (lastVal(a) - (firstVal(a) ?? 0))));
    else rows.sort((a, b) => lastVal(b) - lastVal(a));

    document.getElementById("hm-title").textContent = state.rows === "country" ? "Countries × years" : "Industries × years";
    document.getElementById("hm-sub").textContent = `${MEASURES[state.measure]} · ${STATS[state.stat].label}, ${years[0]}–${years[last]}`;
    const grid = document.getElementById("heatmap-grid");
    const labelW = state.rows === "country" ? "170px" : "250px";
    grid.style.gridTemplateColumns = `${labelW} repeat(${years.length}, minmax(22px, 1fr))`;
    const head = `<div></div>` + years.map((y) => `<div class="hm-year" title="${y}">’${String(y).slice(2)}</div>`).join("");
    const body = rows.map((r) => {
      const href = App.link("explore.html", { [state.rows]: r.id, measures: state.measure, stat: state.stat === "mean" ? null : state.stat });
      const cells = years.map((y, j) => {
        const v = mat[r.i][j], nf = p.nfirm[r.i][j] || 0;
        if (v == null || nf < MIN_FIRMS) {
          return `<span class="hm-cell" style="background:#f0efea" data-tip="<strong>${esc(r.name)}</strong><br><span class='tip-sub'>${y}: ${nf ? `only ${nf} firms` : "no firms"}</span>"></span>`;
        }
        const t = v / cap;
        return `<a class="hm-cell" href="${href}" style="background:${Charts.seq(t)}" aria-label="${esc(r.name)}, ${y}: ${fmtV(v)}"
          data-tip="<strong>${esc(r.name)}</strong><br>${fmtV(v)} <span class='tip-sub'>· ${num(nf)} firms · ${y}</span>"></a>`;
      }).join("");
      return `<div class="hm-label" title="${esc(r.name)}"><a href="${href}">${esc(r.name)}</a></div>${cells}`;
    }).join("");
    grid.innerHTML = head + body;
    document.getElementById("hm-caption").textContent = state.rows === "country"
      ? `Countries with at least ${HEAT_MIN_COUNTRY} firms in ${years[last]}. Grey cells have fewer than ${MIN_FIRMS} firms. The colours match the map.`
      : `All 48 Fama-French industries. Grey cells have fewer than ${MIN_FIRMS} firms. The colours match the map.`;
  }
  bindTips(document.getElementById("heatmap-grid"));

  function renderAll() {
    stop();
    cap = scaleCap();
    renderLegend();
    renderMap();
    renderHeatmap();
    syncURL();
  }
  renderAll();
  if (window.location.hash === "#heatmap") document.getElementById("heatmap").scrollIntoView();
})().catch((e) => { console.error(e); App.toast("Could not load data: " + e.message); });
