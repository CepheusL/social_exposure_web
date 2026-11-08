/* ============ climate/overview.js — Climate Change Exposure landing page ============ */
(async () => {
  const { esc, num, TOPICS, TOPIC_COLORS, METRIC_COLORS } = App;
  const SUB = ["op", "rg", "ph"];
  const OTHER = "#c9c7bf";   // climate talk outside the three topics

  const [meta, global, featured, insights] = await Promise.all([
    App.getMeta(), App.loadAgg("global"), App.loadJSON("featured.json"), App.loadJSON("insights.json"),
  ]);
  await App.lookups();

  const years = Object.keys(global).sort();
  const first = years[0], last = years[years.length - 1];
  const val = (y, key, stat = "mean") => App.aggVal(global[y], key, stat);
  const shareOf = (y, t = "cc") => val(y, `${t}_expo`, "share");
  const pct = (v) => Math.round(v * 100) + "%";
  const plainInd = (code) => App.industryName(code).replace(/\s*\([^)]*\)$/, "");

  /* ---------- Hero ---------- */
  const ds = meta.dataset;
  document.getElementById("hero-firms").textContent = num(ds.firms);
  document.getElementById("hero-ctry").textContent = ds.countries;
  const shareSeries = years.map((y) => shareOf(y));
  const peak = Math.max(...shareSeries);
  document.getElementById("hero-stat").innerHTML = `
    <div class="big">${Math.round(shareOf(last) * 100)}<small>%</small></div>
    <p>of firms mentioned climate change on their ${last} earnings calls.</p>
    <div class="hero-spark">${Charts.spark(shareSeries, { color: "#a8e0c5", width: 2.2, h: 54, yMax: 1 })}</div>
    <p class="from">Up from ${pct(shareOf(first))} in ${first} · peak ${pct(peak)} in ${years[shareSeries.indexOf(peak)]}</p>`;

  document.getElementById("facts").innerHTML = [
    [num(ds.firms), "firms"], [ds.countries, "countries"], [meta.n_industries, "industries"],
    [num(ds.firm_years), "firm-years"], [num(ds.firm_quarters), "firm-quarters"], [`${ds.first}–${ds.last}`, ""],
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
    gridEl.innerHTML = list.map((p) => {
      // each card on its own scale: exposure levels differ by a factor of 20 across these firms
      const top = Math.max(...p.spark.filter((v) => v != null), ...featured.global_3y.filter((v) => v != null));
      return App.firmCard(p, { ref: featured.global_3y, yMax: top * 1.05 });
    }).join("");
  }
  App.segmented(document.getElementById("region-tabs"), {
    name: "region", label: "Region", value: "Featured", options: regions.map((r) => [r, r]), onChange: renderFeatured,
  });
  renderFeatured("Featured");

  /* ---------- Insight tiles ---------- */
  const growth = insights.global_late / insights.global_early;
  const [l0, l1] = insights.late_period, [e0, e1] = insights.early_period;
  const topInd = insights.industries[0];
  const tiles = [
    { value: pct(insights.ever_share_10y), label: "of firms with 10 or more years of data mention climate change",
      sub: `${num(insights.n_firms_10y)} firms` },
    { value: growth.toFixed(1) + "×", label: `average exposure in ${l0}–${l1} versus ${e0}–${e1}`,
      sub: `${insights.global_early.toFixed(2)} → ${insights.global_late.toFixed(2)} per 1,000 bigrams` },
    { value: (topInd.cc / insights.global_late).toFixed(1) + "×", label: `exposure of ${plainInd(topInd.code)} against the all-firm average, ${l0}–${l1}`,
      sub: `${topInd.cc.toFixed(2)} versus ${insights.global_late.toFixed(2)} per 1,000 bigrams` },
    { value: (insights.late_pos / insights.late_neg).toFixed(1) + "×", label: `as much positive as negative sentiment in climate talk, ${l0}–${l1}`,
      sub: `${pct(insights.net_positive_share)} of firm-years with tone words lean positive` },
  ];
  document.getElementById("insights").innerHTML = tiles.map((t) => `
    <div class="insight"><span class="bar-accent"></span><div class="value">${t.value}</div>
      <div class="label">${esc(t.label)}</div><div class="sub">${esc(t.sub)}</div></div>`).join("");

  /* ---------- Who talks: share of firms discussing ---------- */
  Charts.line("share-chart", {
    labels: years,
    datasets: [{ label: "Any climate change talk", data: shareSeries.map((v) => (v == null ? null : v * 100)),
                 color: TOPIC_COLORS.cc, width: 2.6, fill: true, meta: years.map((y) => ({ nfirm: global[y].nfirm })) }],
  }, { percent: true, yLabel: "% of firms", endLabels: false,
       title: "Share of firms discussing climate change", filename: "share_of_firms_discussing_climate_change" });
  document.getElementById("share-caption").textContent = `All firms, ${first}–${last}.`;

  /* ---------- What: topic rows ---------- */
  document.getElementById("topic-sub").textContent = `% of firms discussing each topic, ${first}–${last}`;
  document.getElementById("topic-list").innerHTML = SUB.map((t) => {
    const s = years.map((y) => shareOf(y, t));
    return `<a class="domain-row" href="${App.link("explore.html", { measures: t, stat: "share" })}">
      <span class="domain-name"><span class="measure-dot" style="background:${TOPIC_COLORS[t]}"></span>
        <span>${esc(TOPICS[t])}<small>${pct(s[0])} in ${first}</small></span></span>
      ${Charts.spark(s, { color: TOPIC_COLORS[t], yMax: 0.6, h: 36, fill: true })}
      <span class="domain-val"><strong>${pct(s[s.length - 1])}</strong><span>in ${last}</span></span>
    </a>`;
  }).join("") + (() => {
    // risk and tone rows: share of firms whose climate talk carries risk words or tone words
    const rows = [["cc_risk", "Risk talk", METRIC_COLORS.risk], ["cc_pos", "Positive tone", METRIC_COLORS.pos], ["cc_neg", "Negative tone", METRIC_COLORS.neg]];
    return `<div class="list-label">Risk and tone of climate talk</div>` + rows.map(([k, label, color]) => {
      const s = years.map((y) => val(y, k, "share"));
      const [t, m] = k.split("_");
      return `<a class="domain-row" href="${App.link("explore.html", { measures: t, metric: m, stat: "share" })}">
        <span class="domain-name"><span class="measure-dot" style="background:${color}"></span>
          <span>${esc(label)}<small>${pct(s[0])} in ${first}</small></span></span>
        ${Charts.spark(s, { color, yMax: 0.6, h: 36, fill: true })}
        <span class="domain-val"><strong>${pct(s[s.length - 1])}</strong><span>in ${last}</span></span>
      </a>`;
    }).join("");
  })();

  /* ---------- Industries ---------- */
  const inds = insights.industries;
  const maxInd = Math.max(...inds.map((r) => r.cc));
  const parts = (r) => [["op", r.op], ["rg", r.rg], ["ph", r.ph], ["other", Math.max(0, r.cc - r.op - r.rg - r.ph)]];
  document.getElementById("ind-sub").textContent = `Mean climate change exposure per 1,000 bigrams, ${l0}–${l1}, split by topic`;
  document.getElementById("ind-legend").innerHTML = [...SUB.map((t) => [TOPIC_COLORS[t], TOPICS[t]]), [OTHER, "Other climate change talk"]]
    .map(([c, l]) => `<span><i style="background:${c}"></i>${esc(l)}</span>`).join("");
  document.getElementById("ind-list").innerHTML = inds.map((r) => `
    <a class="ind-row" href="${App.link("explore.html", { industry: r.code, view: "mix" })}"
       aria-label="${esc(App.industryName(r.code))}: ${r.cc.toFixed(2)} per 1,000 bigrams">
      <span class="domain-name"><span>${esc(App.industryName(r.code))}<small>${num(r.n)} firms</small></span></span>
      <span class="stackbar" style="width:${(r.cc / maxInd) * 100}%">${parts(r).map(([k, v]) =>
        `<i style="width:${(v / r.cc) * 100}%;background:${k === "other" ? OTHER : TOPIC_COLORS[k]}" title="${esc(k === "other" ? "Other climate change talk" : TOPICS[k])}: ${App.dec(v)}"></i>`).join("")}</span>
      <span class="domain-val"><strong>${r.cc.toFixed(2)}</strong><span>per 1,000</span></span>
    </a>`).join("");
  document.getElementById("ind-caption").textContent =
    `The ${inds.length} most exposed of ${insights.n_industries_ranked} Fama-French 48 industries with at least 30 firms. ` +
    `All firms average ${insights.global_late.toFixed(2)}.`;

  /* ---------- Around the world: dumbbell ---------- */
  const rows = insights.countries;
  const maxV = Math.ceil(Math.max(...rows.map((r) => Math.max(r.early, r.late))));
  const X = (v) => (v / maxV) * 100;
  const EARLY = "#9ec5f4", LATE = "#184f95";
  const rose = rows.filter((r) => r.late > r.early).length;
  const usRank = rows.findIndex((r) => r.code === "US") + 1;
  document.getElementById("where-lede").textContent =
    `${rose === rows.length ? "Exposure rose in every major country." : `Exposure rose in ${rose} of ${rows.length} major countries.`} ` +
    `${rows[0].name} and ${rows[1].name} lead.` +
    (usRank ? ` The United States ranks ${usRank === rows.length ? "last" : `${usRank} of ${rows.length}`}.` : "");
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
      <span class="db-ticks">${Array.from({ length: maxV + 1 }, (_, i) => `<span style="left:${X(i)}%">${i}</span>`).join("")}</span><span></span>
    </div>`;
  document.getElementById("dumbbell-caption").textContent =
    `Countries with at least 25 firms in ${e0}–${e1} and 50 firms in ${l0}–${l1}.`;

  /* ---------- Quick links ---------- */
  const links = [
    { title: "Trends over time", desc: "Exposure, risk and sentiment for all firms, a country, an industry or one firm.", href: "explore.html" },
    { title: "Compare countries", desc: "The largest markets side by side.",
      href: App.link("compare.html", { entity_type: "country", country: ["US", "GB", "CA", "JP", "CN", "DE"] }) },
    { title: "Firm profiles", desc: "Each firm's exposure by topic, its tone, its rank and its peers.", href: "firm.html" },
    { title: "Rankings", desc: "Top firms, countries and industries by year or period.", href: "ranking.html" },
    { title: "Industry heatmap and map", desc: "Every industry and country, year by year.", href: "patterns.html" },
    { title: "Regulatory talk over time", desc: "How often firms discuss climate regulation.",
      href: App.link("explore.html", { measures: "rg", stat: "share" }) },
  ];
  document.getElementById("quick-links").innerHTML = links.map((l) =>
    `<a class="card" href="${l.href}"><h3>${esc(l.title)}</h3><p>${esc(l.desc)}</p></a>`).join("");

  /* ---------- Citation ---------- */
  document.getElementById("cite-text").textContent = App.SITE.citation;
  document.getElementById("copy-cite").onclick = () => App.copy(App.SITE.citation, "Citation copied");
  document.getElementById("copy-data").onclick = () => App.copy(App.SITE.dataCitation, "Dataset citation copied");
  document.getElementById("copy-bib").onclick = () => App.copy(App.SITE.bibtex, "BibTeX copied");
  document.getElementById("paper-link").href = App.SITE.paperUrl;
  document.getElementById("data-link").href = App.SITE.dataUrl;
})().catch((e) => { console.error(e); App.toast("Could not load data: " + e.message); });
