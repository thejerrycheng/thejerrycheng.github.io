/* =============================================================================
   locomotion_timeline.js — the interactive eras timeline of the locomotion page:
   a warped time axis (stretched after 2013), lane-packed milestone labels, era
   filters, hover/tap cards with the survey's reference numbers and links.
   Data: assets/data/locomotion_timeline.json.
   ============================================================================= */
export function initTimeline(ui, data) {
  const svgNS = 'http://www.w3.org/2000/svg';
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const eras = data.eras, ERA = Object.fromEntries(eras.map(e => [e.id, e]));
  const ms = [...data.milestones].sort((a, b) => a.year - b.year);
  let filter = new Set(eras.map(e => e.id)), kinds = new Set(['method', 'robot', 'event']);
  const host = ui.host; host.innerHTML = '';
  const svg = document.createElementNS(svgNS, 'svg'); svg.setAttribute('class', 'tl-svg'); host.appendChild(svg);
  const card = ui.card;
  function el(tag, attrs, parent) { const e = document.createElementNS(svgNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); (parent || svg).appendChild(e); return e; }
  function render() {
    const W = host.clientWidth || 900, narrow = W < 700; const H = narrow ? 560 : 470; svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('height', H); svg.innerHTML = '';
    const ink = css('--ink') || '#151820', ash = css('--ash') || '#8f8a7a';
    const x0 = 28, x1 = W - 28, y0 = H * 0.5, yr0 = 1966, yr1 = 2027, knee = 2013, frac = narrow ? 0.26 : 0.30; const xk = x0 + frac * (x1 - x0);
    const X = (yr) => yr <= knee ? x0 + (yr - yr0) / (knee - yr0) * (xk - x0) : xk + (yr - knee) / (yr1 - knee) * (x1 - xk);
    for (const [a, b, era] of [[1966, 2015, 'classical'], [2015, 2023, 'learning'], [2023, 2027, 'emerging']]) {
      el('rect', { x: X(a), y: y0 - 18, width: X(b) - X(a), height: 36, fill: ERA[era].color, opacity: filter.has(era) ? 0.22 : 0.06, rx: 4 });
      const t = el('text', { x: (X(a) + X(b)) / 2, y: y0 + 5, 'text-anchor': 'middle', fill: ERA[era].color, class: 'tl-era', opacity: .55 }); t.textContent = ERA[era].name.toUpperCase();
    }
    el('line', { x1: x0, y1: y0, x2: x1, y2: y0, stroke: ink, 'stroke-width': 2 });
    for (const yr of [1970, 1980, 1990, 2000, 2010, 2015, 2020, 2025]) { el('line', { x1: X(yr), y1: y0 - 6, x2: X(yr), y2: y0 + 6, stroke: ink, 'stroke-width': 1.5 }); const t = el('text', { x: X(yr), y: y0 + 26, 'text-anchor': 'middle', fill: ash, class: 'tl-year' }); t.textContent = yr; }
    const tw = el('text', { x: x0, y: H - 8, fill: ash, class: 'tl-note' }); tw.textContent = '◂ time axis stretched from 2013 ▸';
    // lanes: interval packing, labels near the right edge are right-aligned
    const charPx = narrow ? 6.0 : 6.9, nl = narrow ? 14 : 12; const lanes = Array.from({ length: nl }, () => []);
    const shown = ms.filter(m => filter.has(m.era) && kinds.has(m.kind));
    shown.forEach((m) => {
      const x = X(m.year); const lab = m.title.length > (narrow ? 20 : 26) ? m.title.slice(0, narrow ? 18 : 24) + '…' : m.title; const text = `${m.year} · ${lab}`; const wdt = text.length * charPx;
      const ra = x > W * 0.74; const iv = ra ? [x - wdt, x] : [x, x + wdt];
      let li = lanes.findIndex(L => L.every(([a, b]) => iv[1] + 8 < a || iv[0] - 8 > b)); if (li < 0) li = 0; lanes[li].push(iv);
      const up = li % 2 === 0, level = Math.floor(li / 2); const yy = y0 + (50 + level * (narrow ? 26 : 30)) * (up ? -1 : 1);
      const g = el('g', { class: 'tl-item', 'data-i': ms.indexOf(m) });
      el('line', { x1: x, y1: y0, x2: x, y2: yy, stroke: ERA[m.era].color, 'stroke-width': 1, opacity: .55 }, g);
      el('circle', { cx: x, cy: y0, r: 6.5, fill: ERA[m.era].color, stroke: ink, 'stroke-width': 1.2 }, g);
      const t = el('text', { x: x + (ra ? -5 : 5), y: yy + (up ? -3 : 12), fill: ink, class: 'tl-label', 'text-anchor': ra ? 'end' : 'start' }, g); t.textContent = text;
      el('rect', { x: iv[0] - 8, y: Math.min(y0, yy) - 14, width: Math.max(wdt + 14, 16), height: Math.abs(yy - y0) + 28, fill: 'transparent', class: 'tl-hit' }, g);
      const show = (ev) => { showCard(m, ev); g.classList.add('on'); }; const hide = () => { g.classList.remove('on'); };
      g.addEventListener('pointerenter', show); g.addEventListener('pointerleave', hide); g.addEventListener('click', (ev) => { showCard(m, ev, true); });
    });
    ui.count.textContent = `${shown.length} of ${ms.length} milestones shown`;
  }
  function showCard(m, ev, pin = false) {
    card.hidden = false; card.dataset.pinned = pin ? '1' : '';
    card.innerHTML = `<div class="tl-card-kicker" style="background:${ERA[m.era].color}">${ERA[m.era].name.toUpperCase()} · ${m.year} · ${m.kind}</div><h4>${m.title}</h4><p class="who">${m.who}</p><p>${m.note}</p><p class="ref">${m.ref}${m.url ? ` · <a href="${m.url}" target="_blank" rel="noopener">link ↗</a>` : ''}</p>`;
  }
  for (const cb of ui.eraBoxes) cb.addEventListener('change', () => { filter = new Set(ui.eraBoxes.filter(c => c.checked).map(c => c.value)); render(); });
  for (const cb of ui.kindBoxes) cb.addEventListener('change', () => { kinds = new Set(ui.kindBoxes.filter(c => c.checked).map(c => c.value)); render(); });
  new ResizeObserver(() => render()).observe(host);
  new MutationObserver(() => render()).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  render(); showCard(ms[ms.length - 1], null);
  return { render };
}
