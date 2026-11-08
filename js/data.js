/* ============ data.js — downloads and the rendered ReadMe ============ */
(async () => {
  const { esc, num } = App;
  const manifest = await App.loadJSON("downloads.json");

  const mb = (b) => (b >= 1e6 ? (b / 1e6).toFixed(1) + " MB" : Math.max(1, Math.round(b / 1e3)) + " KB");
  const v = encodeURIComponent((await App.getMeta()).build_id || "");
  const fileUrl = (path) => `${App.BASE_PATH}/${path}?v=${v}`;

  /** Climate files: the score columns as a topic x metric grid with plain-word labels, then the other columns. */
  function scoreGrid(f) {
    const g = f.score_grid;
    const col = (t, m) => g.pattern.replace("{t}", t).replace("{m}", m);
    return `<p class="dl-label">Scores (per bigram; ×1,000 on the site)</p>
      <div class="dl-grid"><table>
        <thead><tr><th scope="col">Metric</th>${g.topics.map(([, l]) => `<th scope="col">${esc(l.replace(/^Climate change \(overall\)$/, "Overall"))}</th>`).join("")}</tr></thead>
        <tbody>${g.metrics.map(([m, ml]) => `<tr><th scope="row">${esc(ml)}</th>${g.topics.map(([t]) =>
          `<td><code>${esc(col(t, m))}</code></td>`).join("")}</tr>`).join("")}</tbody>
      </table></div>
      <p class="dl-label">Other columns</p>
      <div class="dl-cols">${f.other_columns.map(([c, l]) => `<span class="dl-col"><code>${esc(c)}</code> ${esc(l)}</span>`).join("")}</div>`;
  }

  /* ---------- Download cards ---------- */
  document.getElementById("downloads").innerHTML = manifest.files.map((f) => `
    <article class="download-card">
      <div class="dl-head">
        <span class="dl-icon" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h6"/></svg>
        </span>
        <div>
          <h2>${esc(f.title)}</h2>
          <p class="dl-sub">One row per ${esc(f.unit)} · ${esc(f.first)} to ${esc(f.last)}</p>
        </div>
      </div>
      <dl class="dl-stats">
        <div><dt>Rows</dt><dd>${num(f.rows)}</dd></div>
        <div><dt>Firms</dt><dd>${num(f.firms)}</dd></div>
        <div><dt>Countries</dt><dd>${num(f.countries)}</dd></div>
      </dl>
      ${f.score_grid ? scoreGrid(f) : `<p class="dl-label">Columns</p>
      <div class="dl-cols">${f.columns.map((c) => `<code>${esc(c)}</code>`).join("")}</div>`}
      <div class="dl-foot">
        <a class="btn btn-primary" href="${fileUrl(f.file)}" download>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>
          Download ZIP
        </a>
        <span class="dl-file">${esc(f.file.split("/").pop())}<br>${mb(f.bytes)} · CSV ${mb(f.csv_bytes)} unzipped</span>
      </div>
    </article>`).join("");

  document.getElementById("copy-cite").onclick = () => App.copy(App.SITE.citation, "Citation copied");
  document.getElementById("copy-bib").onclick = () => App.copy(App.SITE.bibtex, "BibTeX copied");
  const dataBtn = document.getElementById("copy-data");
  if (dataBtn && App.SITE.dataCitation) dataBtn.onclick = () => App.copy(App.SITE.dataCitation, "Dataset citation copied");
  const rl = document.getElementById("readme-link");
  rl.href = fileUrl(manifest.readme);
  rl.textContent = `Download ReadMe.txt (${mb(manifest.readme_bytes)})`;

  /* ---------- ReadMe: plain text -> structured HTML ---------- */
  const resp = await fetch(fileUrl(manifest.readme));
  const text = await resp.text();
  document.getElementById("readme").innerHTML = renderReadme(text);

  /**
   * Turns the ReadMe's plain-text conventions into HTML: "===" / "---" underlines become headings,
   * indented "- item" / "(i) item" lines become lists, other indented lines become inset blocks,
   * and blank lines separate paragraphs. URLs become links.
   */
  function renderReadme(src) {
    const lines = src.replace(/\r\n?/g, "\n").split("\n");
    const out = [];
    let para = [], list = [], inset = [];
    const inline = (s) => esc(s).replace(/https?:\/\/[^\s<]+[^\s<.,;)”’"]/g,
      (u) => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`);
    const flush = () => {
      if (para.length) out.push(`<p>${para.map(inline).join("<br>")}</p>`);
      if (list.length) out.push(`<ul>${list.map((l) => `<li>${inline(l)}</li>`).join("")}</ul>`);
      if (inset.length) out.push(`<div class="doc-inset">${inset.map(inline).join("<br>")}</div>`);
      para = []; list = []; inset = [];
    };
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i], next = lines[i + 1] || "";
      if (/^=+\s*$/.test(next) && line.trim()) { flush(); out.push(`<h3 class="doc-title">${inline(line.trim())}</h3>`); i++; continue; }
      if (/^-{3,}\s*$/.test(next) && line.trim()) { flush(); out.push(`<h4>${inline(line.trim())}</h4>`); i++; continue; }
      if (!line.trim()) { flush(); continue; }
      const item = line.match(/^\s{2,}(?:-|\(([ivx]+)\))\s+(.*)$/);
      if (item) {
        if (para.length || inset.length) { const keep = list; list = []; flush(); list = keep; }
        list.push(item[1] ? `(${item[1]}) ${item[2]}` : item[2]);
        continue;
      }
      if (/^\s{2,}\S/.test(line)) {
        if (para.length || list.length) flush();
        inset.push(line.trim());
        continue;
      }
      if (list.length || inset.length) flush();
      para.push(line.trim());
    }
    flush();
    return out.join("");
  }
})().catch((e) => { console.error(e); App.toast("Could not load the data page: " + e.message); });
