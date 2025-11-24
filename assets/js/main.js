document.addEventListener('DOMContentLoaded', function () {
  /* =========================================================
   *  A. Apple-style Top Nav (mobile menu)
   * ======================================================= */
  (function setupNav() {
    const btn = document.getElementById('menuButton');
    const panel = document.getElementById('mobileMenu');
    const backdrop = document.getElementById('navBackdrop');

    if (!btn || !panel || !backdrop) return;

    const openMenu = () => {
      panel.hidden = false;
      backdrop.hidden = false;
      requestAnimationFrame(() => panel.classList.add('open'));
      btn.setAttribute('aria-expanded', 'true');
    };

    const closeMenu = () => {
      panel.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
      setTimeout(() => {
        panel.hidden = true;
        backdrop.hidden = true;
      }, 160);
    };

    const toggleMenu = () => {
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      expanded ? closeMenu() : openMenu();
    };

    btn.addEventListener('click', toggleMenu);
    backdrop.addEventListener('click', closeMenu);

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && btn.getAttribute('aria-expanded') === 'true') {
        closeMenu();
      }
    });

    panel.querySelectorAll('a').forEach((a) =>
      a.addEventListener('click', closeMenu)
    );

    panel.addEventListener('click', (e) => e.stopPropagation());
  })();

  /* =========================================================
   *  B. Last Updated Timestamp
   * ======================================================= */
  (function setupLastUpdated() {
    const timeEl = document.querySelector('#last-updated time');
    if (!timeEl) return;

    const d = new Date(document.lastModified);
    timeEl.textContent = `Last updated: ${d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })}`;
    timeEl.setAttribute('datetime', d.toISOString());
  })();

  /* =========================================================
   *  C. Publications – Carousel & Hover Video
   * ======================================================= */
  (function setupPublicationsCarousels() {
    const carousels = document.querySelectorAll(
      '#publications [data-pub-carousel]'
    );
    if (!carousels.length) return;

    carousels.forEach((carousel) => {
      const track = carousel.querySelector('.carousel-track');
      const slides = Array.from(carousel.querySelectorAll('.slide'));
      const prevBtn = carousel.querySelector('.nav-btn.prev');
      const nextBtn = carousel.querySelector('.nav-btn.next');

      if (!track || !slides.length) return;

      let index = 0;
      const count = slides.length;

      if (count <= 1) {
        carousel.classList.add('single');
      }

      // Prepare slide videos (but don't auto-play permanently)
      slides.forEach((slide) => {
        const v = slide.querySelector('.hover-video video');
        const hv = slide.querySelector('.hover-video');
        if (v) {
          slide.classList.add('has-video');
          v.muted = true;
          v.loop = true;
          v.playsInline = true;
          v.setAttribute('muted', '');
          v.setAttribute('webkit-playsinline', '');
          v.removeAttribute('controls');
          v.preload = 'metadata';
          v
            .play()
            .then(() => v.pause())
            .catch(() => {});
        } else if (hv) {
          hv.style.display = 'none';
        }
      });

      const pauseAll = () => {
        slides.forEach((slide) => {
          const v = slide.querySelector('video');
          if (v) {
            try {
              v.pause();
            } catch (e) {}
          }
        });
      };

      const update = () => {
        track.style.transform = `translateX(${-index * 100}%)`;
        slides.forEach((slide, i) => {
          slide.classList.toggle('active', i === index);
        });

        if (prevBtn) prevBtn.disabled = index === 0;
        if (nextBtn) nextBtn.disabled = index === count - 1;

        pauseAll();
        if (carousel.matches(':hover')) {
          const activeVideo = slides[index].querySelector('video');
          if (activeVideo) {
            try {
              activeVideo.currentTime = 0;
              activeVideo.play();
            } catch (e) {}
          }
        }
      };

      const go = (dir) => {
        const nextIndex = Math.max(0, Math.min(count - 1, index + dir));
        if (nextIndex !== index) {
          index = nextIndex;
          update();
        }
      };

      prevBtn && prevBtn.addEventListener('click', () => go(-1));
      nextBtn && nextBtn.addEventListener('click', () => go(1));

      const playActive = () => {
        const activeVideo = slides[index].querySelector('video');
        if (activeVideo) {
          try {
            activeVideo.currentTime = 0;
            activeVideo.play();
          } catch (e) {}
        }
      };
      const pauseActive = () => {
        const activeVideo = slides[index].querySelector('video');
        if (activeVideo) {
          try {
            activeVideo.pause();
          } catch (e) {}
        }
      };

      carousel.addEventListener('mouseenter', playActive);
      carousel.addEventListener('mouseleave', pauseActive);

      // Basic swipe
      let startX = 0;
      let dx = 0;
      let touching = false;

      const onStart = (e) => {
        touching = true;
        startX = e.touches ? e.touches[0].clientX : e.clientX;
        dx = 0;
      };
      const onMove = (e) => {
        if (!touching) return;
        const x = e.touches ? e.touches[0].clientX : e.clientX;
        dx = x - startX;
      };
      const onEnd = () => {
        if (!touching) return;
        touching = false;
        const thresh = 50;
        if (dx > thresh) go(-1);
        if (dx < -thresh) go(1);
      };

      carousel.addEventListener('touchstart', onStart, { passive: true });
      carousel.addEventListener('touchmove', onMove, { passive: true });
      carousel.addEventListener('touchend', onEnd, { passive: true });

      update();
    });
  })();

  // Non-carousel publication thumbs (single image + optional hover video)
  (function setupPublicationThumbs() {
    const thumbs = document.querySelectorAll(
      '#publications .pub-thumb:not(:has([data-pub-carousel]))'
    );
    if (!thumbs.length) return;

    thumbs.forEach((thumb) => {
      const vid = thumb.querySelector('.hover-video video');
      const hv = thumb.querySelector('.hover-video');

      if (!vid) {
        if (hv) hv.style.display = 'none';
        thumb.classList.remove('has-video');
        return;
      }

      thumb.classList.add('has-video');
      vid.muted = true;
      vid.loop = true;
      vid.playsInline = true;
      vid.setAttribute('muted', '');
      vid.setAttribute('webkit-playsinline', '');
      vid.removeAttribute('controls');
      vid.preload = 'metadata';

      vid
        .play()
        .then(() => vid.pause())
        .catch(() => {});

      const play = () => {
        try {
          vid.currentTime = 0;
          vid.play();
        } catch (e) {}
      };
      const pause = () => {
        try {
          vid.pause();
        } catch (e) {}
      };

      thumb.addEventListener('mouseenter', play);
      thumb.addEventListener('mouseleave', pause);
      thumb.addEventListener('focusin', play);
      thumb.addEventListener('focusout', pause);
      thumb.addEventListener('touchstart', play, { passive: true });
      thumb.addEventListener('touchend', pause, { passive: true });
    });
  })();

  /* =========================================================
   *  D. Projects – Hover Video on Thumbnails
   * ======================================================= */
  (function setupProjectsHoverVideo() {
    const thumbs = document.querySelectorAll('#projects .proj-thumb');
    if (!thumbs.length) return;

    thumbs.forEach((thumb) => {
      const vid = thumb.querySelector('.hover-video video');
      if (!vid) return;

      vid.muted = true;
      vid.loop = true;
      vid.playsInline = true;
      vid.setAttribute('muted', '');
      vid.setAttribute('webkit-playsinline', '');
      vid.removeAttribute('controls');
      vid.preload = 'metadata';

      vid
        .play()
        .then(() => vid.pause())
        .catch(() => {});

      const play = () => {
        try {
          vid.currentTime = 0;
          vid.play();
        } catch (e) {}
      };
      const pause = () => {
        try {
          vid.pause();
        } catch (e) {}
      };

      thumb.addEventListener('mouseenter', play);
      thumb.addEventListener('mouseleave', pause);
      thumb.addEventListener('focusin', play);
      thumb.addEventListener('focusout', pause);
      thumb.addEventListener('touchstart', play, { passive: true });
      thumb.addEventListener('touchend', pause, { passive: true });
    });
  })();

  /* =========================================================
   *  E. News – Coarse Pointer Tap-To-Advance Carousel
   * ======================================================= */
  (function setupNewsCarouselsForTouch() {
    const mq = window.matchMedia && window.matchMedia('(pointer:coarse)');
    const isCoarse = mq && mq.matches;
    if (!isCoarse) return;

    const wraps = document.querySelectorAll('#news [data-carousel]');
    if (!wraps.length) return;

    wraps.forEach((wrap) => {
      const track = wrap.querySelector('.carousel-track');
      if (!track) return;

      const slides = track.children.length;
      if (slides <= 1) return;

      let idx = 0;
      const go = (d) => {
        idx = (idx + d + slides) % slides;
        track.style.transform = `translateX(-${idx * 100}%)`;
      };

      wrap.addEventListener('click', () => go(1));

      const prev = wrap.querySelector('.prev');
      const next = wrap.querySelector('.next');
      if (prev) {
        prev.addEventListener('click', (e) => {
          e.stopPropagation();
          go(-1);
        });
      }
      if (next) {
        next.addEventListener('click', (e) => {
          e.stopPropagation();
          go(1);
        });
      }
    });
  })();
});

/* ===========================================================
 *  F. Global Helper: carouselMove(btn, dir)
 *     Used by `onclick="carouselMove(this, ±1)"` in News cards
 * ========================================================= */
window.carouselMove = function carouselMove(btn, dir) {
  if (!btn) return;
  const wrap = btn.closest('[data-carousel]');
  if (!wrap) return;

  const track = wrap.querySelector('.carousel-track');
  if (!track) return;

  const slides = track.children.length || 0;
  if (!slides) return;

  const current = Number(wrap.dataset.index || 0);
  const next = (current + dir + slides) % slides;

  track.style.transform = `translateX(-${next * 100}%)`;
  wrap.dataset.index = String(next);
};
