/* Hub landing page: keep the project-card stats in sync with each explorer's data release.
   The page ships with static fallback numbers; this script refreshes them from meta.json. */
(function () {
  "use strict";

  async function fill(prefix, metaPath) {
    try {
      const res = await fetch(metaPath, { cache: "no-cache" });
      if (!res.ok) throw new Error(res.status);
      const meta = await res.json();
      const d = meta.dataset || {};
      const set = (key, value) => {
        const el = document.querySelector(`[data-hub="${prefix}-${key}"]`);
        if (el && value != null) el.textContent = value;
      };
      set("firms", d.firms != null ? App.num(d.firms) : null);
      set("countries", d.countries != null ? App.num(d.countries) : null);
      set("coverage", d.first && d.last ? `${d.first} to ${d.last}` : null);
      set("version", meta.data_version || null);
    } catch (e) {
      /* fetch failed: keep the static fallback text */
    }
  }

  fill("social", "data/meta.json");
  fill("climate", "climate/data/meta.json");
})();
