// carousel.js
window.carouselMove = function (btn, dir) {
  const wrap = btn.closest("[data-carousel]");
  if (!wrap) return;

  const track = wrap.querySelector(".carousel-track");
  if (!track) return;

  const count = track.children.length;
  if (!count) return;

  const current = Number(wrap.dataset.index || 0);
  const next = (current + dir + count) % count;

  track.style.transform = `translateX(-${next * 100}%)`;
  wrap.dataset.index = next;
};
