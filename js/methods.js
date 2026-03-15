/* ============ methods.js ============ */
(async () => {
  const coverage = await App.loadJSON("coverage.json");

  // Coverage by year — only distinct firms
  const yearHtml = `<table>
    <thead><tr><th>Year</th><th>Distinct Firms</th></tr></thead>
    <tbody>${coverage.by_year.map(r =>
      `<tr><td>${r.year}</td><td>${r.n_firms.toLocaleString()}</td></tr>`
    ).join("")}</tbody>
  </table>`;
  document.getElementById("coverage-year").innerHTML = yearHtml;

  // Coverage by country (top 30)
  const top30 = coverage.by_country.slice(0, 30);
  const countryHtml = `<table>
    <thead><tr><th>Country</th><th>Code</th><th>Firms</th></tr></thead>
    <tbody>${top30.map(r =>
      `<tr><td>${r.name}</td><td>${r.code}</td><td>${r.n_firms.toLocaleString()}</td></tr>`
    ).join("")}</tbody>
  </table>`;
  document.getElementById("coverage-country").innerHTML = countryHtml;

  // Coverage by industry
  const indHtml = `<table>
    <thead><tr><th>Industry (FF48)</th><th>Code</th><th>Firms</th></tr></thead>
    <tbody>${coverage.by_industry.map(r =>
      `<tr><td>${r.name}</td><td>${r.code}</td><td>${r.n_firms.toLocaleString()}</td></tr>`
    ).join("")}</tbody>
  </table>`;
  document.getElementById("coverage-industry").innerHTML = indHtml;
})();
