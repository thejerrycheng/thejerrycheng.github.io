// newsCarousel.js
document.addEventListener("DOMContentLoaded", () => {
  const isCoarse =
    window.matchMedia &&
    window.matchMedia("(pointer: coarse)").matches;

  if (!isCoarse) return;

  const carousels = document.querySelectorAll("#news [data-carousel]");

  carousels.forEach((wrap) => {
    const track = wrap.querySelector(".carousel-track");
    const slides = track.children.length;
    if (slides <= 1) return;

    let index = 0;
    const go = (d) => {
      index = (index + d + slides) % slides;
      track.style.transform = `translateX(-${index * 100}%)`;
    };

    wrap.addEventListener("click", () => go(1));

    const prev = wrap.querySelector(".prev");
    const next = wrap.querySelector(".next");

    if (prev)
      prev.addEventListener("click", (e) => {
        e.stopPropagation();
        go(-1);
      });

    if (next)
      next.addEventListener("click", (e) => {
        e.stopPropagation();
        go(1);
      });
  });
});
