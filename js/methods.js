/* ============ methods.js ============ */
(async () => {
  const { esc, num } = App;

  // Citation and taxonomy colours come from the shared constants
  const cite = document.getElementById("methods-cite");
  cite.innerHTML = `${esc(App.SITE.citation)} <a href="${App.SITE.paperUrl}" target="_blank" rel="noopener">Paper on SSRN</a>`;
  document.querySelectorAll(".tax-domain[data-measure]").forEach((th) => {
    const color = App.MEASURE_COLORS[th.dataset.measure];
    th.style.background = Charts.rgba(color, 0.08);
    th.insertAdjacentHTML("afterbegin", `<span class="measure-dot" style="background:${color}"></span>`);
  });

  const [coverage, meta] = await Promise.all([App.loadJSON("coverage.json"), App.getMeta()]);
  document.getElementById("coverage-note").textContent =
    `Annual data cover ${meta.year_min}–${meta.year_max}. For ${meta.quarter_max.slice(0, 4)} only ${meta.quarter_max} is available, so it appears in the quarterly views. ` +
    `Each firm is assigned to its most recent headquarters country and Fama-French 48 industry.`;

  document.getElementById("coverage-year").innerHTML = `<table>
    <thead><tr><th scope="col">Year</th><th scope="col" class="num">Distinct firms</th></tr></thead>
    <tbody>${coverage.by_year.map((r) => `<tr><td>${r.year}</td><td class="num">${num(r.n_firms)}</td></tr>`).join("")}</tbody>
  </table>`;

  document.getElementById("coverage-country").innerHTML = `<table>
    <thead><tr><th scope="col">Country</th><th scope="col">Code</th><th scope="col" class="num">Firms</th></tr></thead>
    <tbody>${coverage.by_country.slice(0, 30).map((r) =>
      `<tr><td>${esc(r.name)}</td><td>${esc(r.code)}</td><td class="num">${num(r.n_firms)}</td></tr>`).join("")}</tbody>
  </table>`;

  document.getElementById("coverage-industry").innerHTML = `<table>
    <thead><tr><th scope="col">Industry (FF48)</th><th scope="col">Code</th><th scope="col" class="num">Firms</th></tr></thead>
    <tbody>${coverage.by_industry.map((r) =>
      `<tr><td>${esc(r.name)}</td><td>${esc(r.code)}</td><td class="num">${num(r.n_firms)}</td></tr>`).join("")}</tbody>
  </table>`;
})().catch((e) => { console.error(e); App.toast("Could not load data: " + e.message); });
