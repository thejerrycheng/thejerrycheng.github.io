/* =============================================================================
   tintin_landings.js — the landing gallery: every clip is one real MuJoCo
   rollout of the 5,000-tonne vehicle that ended on the pad. Reads
   assets/data/tintin_landings.json (written by scripts/tools/publish_landings.py).
   ============================================================================= */
export async function initLandings(ui) {
  const idx = await (await fetch('assets/data/tintin_landings.json')).json();
  const base = idx.base || 'assets/videos/tintin_landings/';
  const clips = idx.clips || [];

  const card = (c) => {
    const b = c.archive ? (idx.archive_base || 'assets/videos/') : base;
    const poster = c.archive ? 'assets/images/projects/tintin/hero_poster.jpg' : `${b}${c.name}.jpg`;
    const meta = [c.start, c.controller, c.camera].filter(Boolean).join(' &middot; ');
    const nums = c.archive ? '' :
      `<span class="land-num">${c.flight.toFixed(1)} s &middot; touchdown ${c.speed.toFixed(2)} m/s &middot; ${c.tilt.toFixed(1)}&deg; &middot; ${c.lateral.toFixed(1)} m off the pad</span>`;
    return `<figure class="land-card" data-ctrl="${c.controller}" data-cam="${c.camera}">
      <video muted loop playsinline controls preload="none" poster="${poster}"><source src="${b}${c.name}.mp4" type="video/mp4"></video>
      <figcaption><b>${c.caption}</b><span>${meta}</span>${nums}</figcaption>
    </figure>`;
  };

  const cams = [...new Set(clips.map(c => c.camera))];
  const ctrls = [...new Set(clips.map(c => c.controller))];
  ui.filters.innerHTML = ['all', ...ctrls, ...cams].map((f, i) =>
    `<button class="btn${i === 0 ? ' btn-primary' : ''}" data-filter="${f}">${f === 'all' ? `all ${clips.length}` : f}</button>`).join('');
  ui.gallery.innerHTML = clips.map(card).join('');

  const cards = [...ui.gallery.querySelectorAll('.land-card')];
  ui.filters.addEventListener('click', (e) => {
    const b = e.target.closest('[data-filter]'); if (!b) return;
    const f = b.dataset.filter;
    ui.filters.querySelectorAll('button').forEach(x => x.classList.toggle('btn-primary', x === b));
    cards.forEach(c => { c.hidden = !(f === 'all' || c.dataset.ctrl === f || c.dataset.cam === f); });
  });

  /* play what is on screen, pause what is not — twenty videos at once would melt a laptop */
  const io = new IntersectionObserver((es) => es.forEach(e => {
    const v = e.target.querySelector('video'); if (!v) return;
    if (e.isIntersecting) { if (v.preload === 'none') v.preload = 'metadata'; v.play().catch(() => {}); } else v.pause();
  }), { threshold: 0.3 });
  cards.forEach(c => io.observe(c));
  return clips.length;
}
