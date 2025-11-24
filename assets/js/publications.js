// publications.js
document.addEventListener("DOMContentLoaded", () => {
  const carousels = document.querySelectorAll(
    "#publications [data-pub-carousel]"
  );

  carousels.forEach((carousel) => {
    const track = carousel.querySelector(".carousel-track");
    const slides = Array.from(carousel.querySelectorAll(".slide"));
    const prevBtn = carousel.querySelector(".nav-btn.prev");
    const nextBtn = carousel.querySelector(".nav-btn.next");

    let index = 0;
    const count = slides.length;

    slides.forEach((slide) => {
      const video = slide.querySelector("video");
      if (!video) return;

      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.setAttribute("muted", "");
      video.setAttribute("webkit-playsinline", "");
      video.removeAttribute("controls");

      video.preload = "metadata";
      video.play().then(() => video.pause()).catch(() => {});
    });

    const pauseAll = () => {
      slides.forEach((slide) => {
        const v = slide.querySelector("video");
        if (v) v.pause();
      });
    };

    const update = () => {
      track.style.transform = `translateX(${-index * 100}%)`;
      pauseAll();

      const active = slides[index].querySelector("video");
      if (active && carousel.matches(":hover")) {
        active.currentTime = 0;
        active.play().catch(() => {});
      }

      if (prevBtn) prevBtn.disabled = index === 0;
      if (nextBtn) nextBtn.disabled = index === count - 1;
    };

    const move = (d) => {
      const next = Math.max(0, Math.min(count - 1, index + d));
      if (next !== index) {
        index = next;
        update();
      }
    };

    prevBtn && prevBtn.addEventListener("click", () => move(-1));
    nextBtn && nextBtn.addEventListener("click", () => move(1));

    carousel.addEventListener("mouseenter", update);
    carousel.addEventListener("mouseleave", pauseAll);

    // Basic touch swipe
    let startX = 0;
    let dx = 0;
    let dragging = false;

    const start = (e) => {
      dragging = true;
      startX = e.touches ? e.touches[0].clientX : e.clientX;
      dx = 0;
    };

    const moveTouch = (e) => {
      if (!dragging) return;
      const x = e.touches ? e.touches[0].clientX : e.clientX;
      dx = x - startX;
    };

    const end = () => {
      if (!dragging) return;
      dragging = false;
      const threshold = 50;
      if (dx > threshold) move(-1);
      if (dx < -threshold) move(1);
    };

    carousel.addEventListener("touchstart", start, { passive: true });
    carousel.addEventListener("touchmove", moveTouch, { passive: true });
    carousel.addEventListener("touchend", end);

    update();
  });

  // Non-carousel single thumbnails
  const thumbs = document.querySelectorAll(
    "#publications .pub-thumb:not(:has([data-pub-carousel]))"
  );

  thumbs.forEach((thumb) => {
    const video = thumb.querySelector("video");
    if (!video) return;

    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.setAttribute("muted", "");
    video.setAttribute("webkit-playsinline", "");
    video.removeAttribute("controls");
    video.preload = "metadata";

    video.play().then(() => video.pause()).catch(() => {});

    const play = () => {
      video.currentTime = 0;
      video.play().catch(() => {});
    };
    const pause = () => video.pause();

    thumb.addEventListener("mouseenter", play);
    thumb.addEventListener("mouseleave", pause);
    thumb.addEventListener("touchstart", play, { passive: true });
    thumb.addEventListener("touchend", pause, { passive: true });
  });
});
