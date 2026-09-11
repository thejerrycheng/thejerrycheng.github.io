/* Progressive enhancement: the complete table and PDF links work without JS. */
(() => {
  'use strict';
  const root = document.getElementById('related-work');
  if (!root) return;
  const data = JSON.parse(document.getElementById('rw-data').textContent);
  const papers = new Map(data.papers.map(p => [p.id, p]));
  const rows = Array.from(root.querySelectorAll('tbody tr[data-paper]'));
  const form = root.querySelector('.rw-controls');
  const search = root.querySelector('#rw-search');
  const filters = Array.from(root.querySelectorAll('[data-rw-filter]'));
  const preview = document.createElement('div');
  preview.className = 'rw-preview'; preview.id = 'rw-preview';
  preview.setAttribute('role', 'tooltip'); preview.hidden = true;
  document.body.append(preview);
  const dialog = document.createElement('dialog');
  dialog.className = 'rw-dialog'; dialog.setAttribute('aria-labelledby', 'rw-dialog-title');
  document.body.append(dialog);
  let active = null, hideTimer, dismissed = null, point = null, frame = 0;
  const make = (tag, text, cls) => {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (cls) node.className = cls;
    return node;
  };
  function hide() {
    clearTimeout(hideTimer); preview.hidden = true;
    if (active) active.querySelector('.rw-paper').removeAttribute('aria-describedby');
    active = null;
  }
  function place() {
    frame = 0;
    if (preview.hidden || !point) return;
    const {x, y} = point, box = preview.getBoundingClientRect(), gap = 18, edge = 12;
    let left = x + gap, top = y + gap;
    if (left + box.width > innerWidth - edge) left = x - box.width - gap;
    if (top + box.height > innerHeight - edge) top = y - box.height - gap;
    preview.style.left = Math.max(edge, Math.min(left, innerWidth - box.width - edge)) + 'px';
    preview.style.top = Math.max(edge, Math.min(top, innerHeight - box.height - edge)) + 'px';
  }
  function show(row, event) {
    if (dialog.open || dismissed === row) return;
    clearTimeout(hideTimer);
    const p = papers.get(row.dataset.paper);
    if (active !== row) {
      hide(); active = row;
      preview.replaceChildren(make('strong', p.name), make('p', p.title),
        make('p', `${p.year} · ${p.group}`, 'rw-preview-meta'),
        make('p', p.mechanism), make('p', p.boundary));
      row.querySelector('.rw-paper').setAttribute('aria-describedby', preview.id);
    }
    const box = row.querySelector('.rw-paper').getBoundingClientRect();
    point = event ? {x:event.clientX, y:event.clientY} : {x:box.right, y:box.top};
    preview.hidden = false;
    if (!frame) frame = requestAnimationFrame(place);
  }
  for (const row of rows) {
    row.addEventListener('pointerenter', e => { dismissed = null; if (e.pointerType !== 'touch') show(row, e); });
    row.addEventListener('pointermove', e => { if (e.pointerType !== 'touch') show(row, e); });
    row.addEventListener('pointerleave', () => { hideTimer = setTimeout(hide, 180); });
    row.querySelector('.rw-paper').addEventListener('focus', () => { dismissed = null; show(row); });
    row.querySelector('.rw-paper').addEventListener('blur', hide);
    row.addEventListener('click', e => {
      if (e.target.closest('a,button') || window.getSelection().toString()) return;
      window.open(papers.get(row.dataset.paper).pdf, '_blank', 'noopener');
    });
  }
  preview.addEventListener('pointerenter', () => clearTimeout(hideTimer));
  preview.addEventListener('pointerleave', hide);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { dismissed = active; hide(); } });
  window.addEventListener('resize', hide);
  window.addEventListener('scroll', hide, true);
  form.hidden = false;
  function filter() {
    hide();
    const terms = search.value.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
    let count = 0;
    for (const row of rows) {
      const p = papers.get(row.dataset.paper), hay = JSON.stringify(p).toLocaleLowerCase();
      row.hidden = !terms.every(t => hay.includes(t)) || !filters.every(f => !f.value || p[f.dataset.rwFilter] === f.value);
      if (!row.hidden) count++;
    }
    root.querySelector('#rw-count').textContent = `${count} of ${rows.length} studies`;
    root.querySelector('#rw-empty').hidden = count !== 0;
  }
  form.addEventListener('submit', e => e.preventDefault());
  form.addEventListener('input', filter);
  form.addEventListener('change', filter);
  form.addEventListener('reset', () => setTimeout(filter, 0));
  root.querySelectorAll('.rw-details').forEach(button => button.addEventListener('click', () => {
    hide(); const p = papers.get(button.dataset.paper);
    const close = make('button', 'Close ×', 'rw-dialog-close'); close.type = 'button';
    close.addEventListener('click', () => dialog.close());
    const title = make('h2', p.title); title.id = 'rw-dialog-title';
    const dl = make('dl');
    for (const [label,key] of [['Research group','group'],['Method','method'],['Execution','execution'],['Embodiment','robot'],['Deployment partners','interaction'],['Training / human input','training'],['Physical coupling','coupling'],['Validation','validation']]) {
      dl.append(make('dt',label),make('dd',p[key]));
    }
    const pdf = make('a','Open paper PDF ↗','rw-pdf-link'); pdf.href=p.pdf;pdf.target='_blank';pdf.rel='noopener';
    const source = make('a','Publication / source'); source.href=p.source;source.target='_blank';source.rel='noopener';
    const sourceLine = make('p');sourceLine.append(source);
    for (const url of p.group_sources) {const a=make('a',' · Lab / affiliation');a.href=url;a.target='_blank';a.rel='noopener';sourceLine.append(a);}
    dialog.replaceChildren(close,title,make('p',`${p.authors.join(', ')} · ${p.year}`),dl,
      make('p',p.mechanism),make('p',p.boundary),pdf,sourceLine,make('small',`Source reviewed ${p.verified_on}. Classification describes the reported setup.`));
    dialog.showModal();close.focus();
  }));
  dialog.addEventListener('click', e => { if (e.target === dialog) { const r=dialog.getBoundingClientRect(); if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close(); } });
})();
