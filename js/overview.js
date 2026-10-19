/* ============ overview.js — landing page ============ */
(async () => {
  const { esc, num, MEASURES, MEASURE_COLORS, DOMAIN_KEYS } = App;

  const [meta, global, featured, insights] = await Promise.all([
    App.getMeta(), App.loadAgg("global"), App.loadJSON("featured.json"), App.loadJSON("insights.json"),
  ]);
  await App.lookups();

  const years = Object.keys(global).sort();
  const first = years[0], last = years[years.length - 1];
  const shareOf = (y, m = "social") => (global[y] && global[y][m] ? global[y][m].share : null);
  const pct = (v) => Math.round(v * 100) + "%";

  /* ---------- Hero ---------- */
  document.getElementById("hero-firms").textContent = num(meta.n_firms);
  document.getElementById("hero-ctry").textContent = meta.n_countries;
  const shareSeries = years.map((y) => shareOf(y));
  document.getElementById("hero-stat").innerHTML = `
    <div class="big">${Math.round(shareOf(last) * 100)}<small>%</small></div>
    <p>of firms discussed at least one social topic on their earnings calls in ${last}.</p>
    <div class="hero-spark">${Charts.spark(shareSeries, { color: "#f2b9a3", width: 2.2, h: 54, yMax: 1 })}</div>
    <p class="from">Up from ${pct(shareOf(first))} in ${first} · peak ${pct(Math.max(...shareSeries))} in ${years[shareSeries.indexOf(Math.max(...shareSeries))]}</p>`;

  document.getElementById("facts").innerHTML = [
    [num(meta.n_firms), "firms"], [meta.n_countries, "countries"], [meta.n_industries, "industries"],
    [num(meta.n_obs), "firm-year observations"], [`${meta.year_min}–${meta.year_max}`, "annual"],
    [meta.quarter_max, "latest quarter"],
  ].map(([v, l]) => `<span><strong>${v}</strong> ${l}</span>`).join("");

  App.combobox({
    input: document.getElementById("hero-search"),
    list: document.getElementById("hero-search-list"),
    getItems: (q) => App.searchFirms(q, 12),
    onSelect: (it) => { window.location.href = App.link("firm.html", { id: it.id }); },
  });

  /* ---------- Featured companies ---------- */
  const pool = new Map(featured.pool.map((p) => [p.id, p]));
  const regions = ["Featured", "Americas", "Europe", "Asia-Pacific", "Africa"];
  const gridEl = document.getElementById("featured-grid");

  function renderFeatured(region) {
    const list = region === "Featured"
      ? featured.default.map((id) => pool.get(id)).filter(Boolean)
      : featured.pool.filter((p) => p.region === region);
    const yMax = Math.max(...list.flatMap((p) => p.social_3y.filter((v) => v != null)), ...featured.global_3y.filter((v) => v != null));
    const top = Math.ceil(yMax / 2) * 2;
    gridEl.innerHTML = list.map((p) => App.firmCard(p, { ref: featured.global_3y, yMax: top })).join("");
  }
  App.segmented(document.getElementById("region-tabs"), {
    name: "region", label: "Region", value: "Featured",
    options: regions.map((r) => [r, r]), onChange: renderFeatured,
  });
  renderFeatured("Featured");

  /* ---------- Insight tiles ---------- */
  const growth = insights.global_late / insights.global_early;
  const pre = String(2019);
  const above = DOMAIN_KEYS.filter((m) => shareOf(last, m) > shareOf(pre, m)).length;
  const dei = years.map((y) => shareOf(y, "dei"));
  const deiPeak = Math.max(...dei), deiPeakYear = years[dei.indexOf(deiPeak)];
  const tiles = [
    { value: pct(insights.ever_share_10y), label: "of firms observed for 10+ years discuss social topics at some point",
      sub: `${num(insights.n_firms_10y)} firms` },
    { value: growth.toFixed(1) + "×", label: `higher average exposure in ${insights.late_period.join("–")} than in ${insights.early_period.join("–")}`,
      sub: `${insights.global_early.toFixed(2)} → ${insights.global_late.toFixed(2)} sentences per 1,000` },
    { value: `${above} of ${DOMAIN_KEYS.length}`, label: `domains are discussed by more firms in ${last} than before COVID-19 (${pre})`,
      sub: "Attention persisted after the pandemic" },
    { value: pct(deiPeak), label: `of firms discussed DEI at its ${deiPeakYear} peak`,
      sub: `${pct(shareOf(first, "dei"))} in ${first} · ${pct(shareOf(last, "dei"))} in ${last}` },
  ];
  document.getElementById("insights").innerHTML = tiles.map((t) => `
    <div class="insight"><span class="bar-accent"></span><div class="value">${t.value}</div>
      <div class="label">${esc(t.label)}</div><div class="sub">${esc(t.sub)}</div></div>`).join("");

  /* ---------- Who talks: share of firms discussing ---------- */
  Charts.line("share-chart", {
    labels: years,
    datasets: [{ label: "Any social topic", data: shareSeries.map((v) => (v == null ? null : v * 100)),
                 color: MEASURE_COLORS.social, width: 2.6, fill: true,
                 meta: years.map((y) => ({ nfirm: global[y].social.nfirm })) }],
  }, { percent: true, yLabel: "% of firms", events: App.EVENTS, endLabels: false,
       title: "Share of firms discussing any social topic", filename: "share_of_firms_discussing" });

  /* ---------- What: domain rows ---------- */
  document.getElementById("domain-sub").textContent = `% of firms discussing each domain, ${first}–${last}`;
  document.getElementById("domain-list").innerHTML = DOMAIN_KEYS.map((m) => {
    const s = years.map((y) => shareOf(y, m));
    return `<a class="domain-row" href="${App.link("explore.html", { measures: m, stat: "share" })}">
      <span class="domain-name"><span class="measure-dot" style="background:${MEASURE_COLORS[m]}"></span>
        <span>${esc(MEASURES[m])}<small>${pct(s[0])} in ${first}</small></span></span>
      ${Charts.spark(s, { color: MEASURE_COLORS[m], yMax: 0.6, h: 36, fill: true })}
      <span class="domain-val"><strong>${pct(s[s.length - 1])}</strong><span>in ${last}</span></span>
    </a>`;
  }).join("");

  /* ---------- Around the world: dumbbell ---------- */
  const rows = insights.countries;
  const maxV = Math.ceil(Math.max(...rows.map((r) => Math.max(r.early, r.late))));
  const X = (v) => (v / maxV) * 100;
  const EARLY = "#9ec5f4", LATE = "#184f95";
  const [e0, e1] = insights.early_period, [l0, l1] = insights.late_period;
  const ticks = Array.from({ length: maxV + 1 }, (_, i) => i);
  document.getElementById("dumbbell").innerHTML = `
    <div class="db-legend">
      <span><i class="db-dot" style="background:${EARLY}"></i>${e0}–${e1}</span>
      <span><i class="db-dot" style="background:${LATE}"></i>${l0}–${l1}</span>
      <span><i class="db-ref" style="position:static;display:inline-block;height:12px"></i>All firms, ${l0}–${l1} (${insights.global_late.toFixed(2)})</span>
    </div>
    ${rows.map((r) => `
      <a class="db-row${r.code === "US" ? " hl" : ""}" href="${App.link("explore.html", { country: r.code })}"
         aria-label="${esc(r.name)}: ${r.early.toFixed(2)} in ${e0}–${e1}, ${r.late.toFixed(2)} in ${l0}–${l1}">
        <span class="db-name">${esc(r.name)}</span>
        <span class="db-track">
          <span class="db-ref" style="left:${X(insights.global_late)}%"></span>
          <span class="db-line" style="left:${X(Math.min(r.early, r.late))}%;width:${Math.abs(X(r.late) - X(r.early))}%"></span>
          <span class="db-pt" style="left:${X(r.early)}%;background:${EARLY}"></span>
          <span class="db-pt" style="left:${X(r.late)}%;background:${LATE}"></span>
        </span>
        <span class="db-val">${r.early.toFixed(2)} → <strong>${r.late.toFixed(2)}</strong></span>
      </a>`).join("")}
    <div class="db-axis" aria-hidden="true"><span></span>
      <span class="db-ticks">${ticks.map((t) => `<span style="left:${X(t)}%">${t}</span>`).join("")}</span><span></span>
    </div>`;
  document.getElementById("dumbbell-caption").textContent =
    `Countries with at least 25 firms in ${e0}–${e1} and 50 firms in ${l0}–${l1}. Coverage outside the United States ` +
    `reflects which firms appear in the earnings-call data, typically larger, internationally listed companies, ` +
    `so cross-country gaps partly reflect sample composition.`;

  /* ---------- Quick links ---------- */
  const links = [
    { title: "Trends over time", desc: "Global, country, industry or firm trends for any domain and statistic.", href: "explore.html" },
    { title: "Compare countries", desc: "Put the largest markets side by side on one measure.",
      href: App.link("compare.html", { entity_type: "country", country: ["US", "GB", "CA", "JP", "CN", "DE"], measure: "social" }) },
    { title: "Firm profiles", desc: "Any firm's exposure by domain, its percentile and its closest peers.", href: "firm.html" },
    { title: "Rankings", desc: "League tables of firms, countries and industries by year or period.", href: "ranking.html" },
    { title: "Industry heatmap and map", desc: "All 48 industries and every country across years at a glance.", href: "patterns.html" },
    { title: "DEI over time", desc: "The rise and retreat of diversity, equity and inclusion on earnings calls.",
      href: App.link("explore.html", { measures: "dei", stat: "share" }) },
  ];
  document.getElementById("quick-links").innerHTML = links.map((l) =>
    `<a class="card" href="${l.href}"><h3>${esc(l.title)}</h3><p>${esc(l.desc)}</p></a>`).join("");

  /* ---------- Citation ---------- */
  document.getElementById("cite-text").textContent = App.SITE.citation;
  document.getElementById("copy-cite").onclick = () => App.copy(App.SITE.citation, "Citation copied");
  document.getElementById("copy-bib").onclick = () => App.copy(App.SITE.bibtex, "BibTeX copied");
  document.getElementById("paper-link").href = App.SITE.paperUrl;
  document.getElementById("data-link").href = App.SITE.dataUrl;
})().catch((e) => { console.error(e); App.toast("Could not load data: " + e.message); });
