/* ============ overview.js ============ */
(async () => {
  const meta = await App.getMeta();

  // Stats
  document.getElementById("stats").innerHTML = [
    { label: "Years Covered", value: `${meta.year_min}–${meta.year_max}` },
    { label: "Firms", value: meta.n_firms.toLocaleString() },
    { label: "Countries", value: meta.n_countries },
    { label: "Industries", value: meta.n_industries },
    { label: "Observations", value: meta.n_obs.toLocaleString() },
  ].map(s => `<div class="stat-card"><div class="stat-value">${s.value}</div><div class="stat-label">${s.label}</div></div>`).join("");

  // Quick links
  const links = [
    { title: "Global Social Exposure Trend", desc: "Overall social exposure across all firms over time", params: { measure: "social" } },
    { title: "Employee Welfare Trend", desc: "Employee welfare exposure over time", params: { measure: "emp" } },
    { title: "DEI Exposure Trend", desc: "Diversity, equity & inclusion exposure", params: { measure: "dei" } },
    { title: "Compare Top Countries", desc: "Compare social exposure across countries", page: "compare.html", params: { measure: "social", entity_type: "country" } },
    { title: "Firm Rankings", desc: "See top-ranked firms by social exposure", page: "ranking.html", params: { measure: "social", entity_type: "firm" } },
    { title: "Crisis Response Trend", desc: "Crisis response exposure over time", params: { measure: "crisis" } },
  ];

  document.getElementById("quick-links").innerHTML = links.map(l => {
    const page = l.page || "explore.html";
    const href = App.navLink(page, l.params);
    return `<a class="card" href="${href}"><h3>${l.title}</h3><p>${l.desc}</p></a>`;
  }).join("");

  // Overview chart — global mean for all measures
  const global = await App.loadJSON("agg/global.json");
  const years = Object.keys(global).sort();
  const datasets = App.MEASURE_KEYS.map((key, i) => ({
    label: App.MEASURES[key],
    data: years.map(y => global[y][key] ? global[y][key].mean : null),
  }));

  Charts.lineChart("overview-chart", {
    labels: years,
    datasets,
    yLabel: "Mean Exposure",
  });
})();
