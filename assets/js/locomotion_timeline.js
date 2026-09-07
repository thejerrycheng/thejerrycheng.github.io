/* =============================================================================
   locomotion_timeline.js — the survey's milestones on a vertical spine.

   Vertical because the list only grows: every milestone gets its own row, so no two
   labels can ever collide, and a new entry costs one more row rather than a redesign
   of the axis. Era bands run down the spine; filters hide rows without moving anything.
   ============================================================================= */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const KIND = { method: 'method', robot: 'robot', event: 'event', dataset: 'dataset' };

  async function boot() {
    const host = $('#timeline'); if (!host) return;
    let data;
    try { data = await fetch('assets/data/locomotion_timeline.json').then(r => r.json()); }
    catch (e) { host.innerHTML = '<p class="pl-empty">The timeline data could not be loaded.</p>'; return; }

    const eras = Object.fromEntries(data.eras.map(e => [e.id, e]));
    const items = [...data.milestones].sort((a, b) => a.year - b.year || a.title.localeCompare(b.title));

    /* era filter chips */
    const bar = $('#tl-filters');
    if (bar) {
      bar.innerHTML = data.eras.map(e =>
        `<label class="tl-chip era-${e.id}"><input type="checkbox" checked data-era="${e.id}"> ${esc(e.name)}</label>`).join('')
        + Object.keys(KIND).map(k => `<label class="tl-chip kind"><input type="checkbox" checked data-kind="${k}"> ${k}s</label>`).join('');
    }

    /* Milestones run in time order, and the eras overlap in time — a classical robot appears in
       2017, well inside the learning era — so an era heading is written once, where that era first
       appears, and never repeated. */
    const seenEra = new Set();
    host.innerHTML = items.map((m) => {
      const e = eras[m.era] || { color: '#888', name: m.era };
      const eraStart = !seenEra.has(m.era);
      seenEra.add(m.era);
      return `${eraStart ? `<div class="tl-era-head era-${m.era}" data-era="${m.era}">
          <span class="tl-era-name">${esc(e.name)}</span>
          <span class="tl-era-span">${esc(e.span || '')}</span>
          <span class="tl-era-tools">${esc(e.tools || '')}</span>
        </div>` : ''}
        <article class="tl-row era-${m.era} kind-${m.kind}" data-era="${m.era}" data-kind="${m.kind}">
          <div class="tl-year">${m.year}</div>
          <div class="tl-spine"><span class="tl-dot" style="--dot:${e.color}"></span></div>
          <div class="tl-card">
            <h4>${esc(m.title)}</h4>
            <p class="tl-who">${esc(m.who || '')} <span class="tl-kind">${esc(m.kind)}</span></p>
            <p class="tl-note">${esc(m.note || '')}</p>
            <p class="tl-ref">${esc(m.ref || '')}${m.url ? ` · <a href="${esc(m.url)}" target="_blank" rel="noopener">read it ↗</a>` : ''}</p>
          </div>
        </article>`;
    }).join('');

    const count = () => {
      const shown = $$('.tl-row', host).filter(r => r.style.display !== 'none').length;
      const el = $('#tl-count'); if (el) el.textContent = `${shown} of ${items.length} milestones`;
      /* an era heading with nothing under it should go too */
      $$('.tl-era-head', host).forEach(h => {
        const era = h.dataset.era;
        const any = $$(`.tl-row[data-era="${era}"]`, host).some(r => r.style.display !== 'none');
        h.style.display = any ? '' : 'none';
      });
    };
    const apply = () => {
      const eraOn = new Set($$('#tl-filters input[data-era]').filter(i => i.checked).map(i => i.dataset.era));
      const kindOn = new Set($$('#tl-filters input[data-kind]').filter(i => i.checked).map(i => i.dataset.kind));
      $$('.tl-row', host).forEach(r => {
        r.style.display = (eraOn.has(r.dataset.era) && kindOn.has(r.dataset.kind)) ? '' : 'none';
      });
      count();
    };
    $$('#tl-filters input').forEach(i => i.addEventListener('change', apply));
    count();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
