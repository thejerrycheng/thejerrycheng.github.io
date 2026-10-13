/** Lightweight grid embed. No WebGL or MuJoCo is loaded by this module. */
const BASE = new URL('./', import.meta.url);
const PAGE = new URL('../../../../rehearse-library.html', BASE);
let indexPromise;
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const assetURL = (id, file = 'meta.json') => new URL(`data/${encodeURIComponent(id)}/${file}`, BASE).href;
export async function getIndex() {
  if (!indexPromise) indexPromise = fetch(new URL('index.json', BASE)).then(r => { if (!r.ok) throw new Error('The collection is unavailable. Please try again.'); return r.json(); }).then(d => d.assets).catch(e => { indexPromise = null; throw e; });
  return indexPromise;
}
export const sizeLabel = size => size.map(v => (v * 100).toLocaleString(undefined, {maximumFractionDigits:1})).join(' × ') + ' cm';
export function badges(a) {
  return `${a.joint_count || a.joints?.length ? '<span class="asset-badge articulated">Articulated</span>' : ''}${a.soft ? '<span class="asset-badge soft">Soft</span>' : ''}${a.measured ? '<span class="asset-badge measured" title="Geometry or motion has source measurement evidence. Forces are not hardware measurements.">Measured</span>' : ''}`;
}
export function renderCards(el, assets, {local = false} = {}) {
  el.classList.add('library-grid');
  el.innerHTML = assets.map((a,i) => `<a class="asset-card" href="${local ? '' : PAGE.href}#asset=${encodeURIComponent(a.id)}" aria-label="Explore ${escapeHTML(a.label)}"><div class="asset-image"><img src="${assetURL(a.id,'thumb.webp')}" alt="Studio render of ${escapeHTML(a.label)}" loading="${i<6?'eager':'lazy'}" decoding="async" width="384" height="320"><span class="card-open" aria-hidden="true">↗</span></div><div class="asset-card-copy"><p class="asset-set-name">${escapeHTML(a.set_label)}</p><h3>${escapeHTML(a.label)}</h3><p class="asset-card-spec">${sizeLabel(a.size)}<span>${a.joint_count} joint${a.joint_count === 1 ? '' : 's'}</span></p><div class="asset-badges">${badges(a)}</div></div></a>`).join('');
}
export async function mountLibraryGrid(el, {limit = 6, set} = {}) {
  if (!el) throw new TypeError('A grid container is required.');
  if (!document.querySelector('link[data-library-style],link[href$="library/library.css"]')) {
    const link = document.createElement('link'); link.rel='stylesheet';link.href=new URL('library.css',BASE).href;link.dataset.libraryStyle='';document.head.append(link);
  }
  el.setAttribute('aria-busy','true');
  try {
    let assets=await getIndex();if(set)assets=assets.filter(a=>a.set===set);assets=assets.slice(0,Math.max(0,limit));renderCards(el,assets);return {assets,destroy:()=>el.replaceChildren()};
  } catch(e) {el.textContent=e.message;throw e;} finally {el.removeAttribute('aria-busy');}
}
