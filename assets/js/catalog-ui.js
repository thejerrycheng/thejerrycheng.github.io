/* =============================================================================
   catalog-ui.js — home page card strips + the quick-look popup.
   Data comes from assets/js/catalog.js (window.CATALOG), generated from
   assets/data/catalog.json by scripts/build_catalog.py. Without JS every card
   is a plain link to its entry on publications.html / projects.html.
   ============================================================================= */
(function () {
  "use strict";
  var C = window.CATALOG || {};

  /* ---- strip arrows: scroll two cards at a time ---- */
  document.querySelectorAll(".strip-wrap").forEach(function (wrap) {
    var strip = wrap.querySelector(".strip, .news-scroll");
    if (!strip) return;
    wrap.querySelectorAll(".strip-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var card = strip.querySelector(".slide, .news-card");
        var step = card ? card.getBoundingClientRect().width + 18 : 310;
        strip.scrollBy({ left: (btn.classList.contains("next") ? 1 : -1) * step * 2, behavior: "smooth" });
      });
    });
  });

  /* ---- swipe: a horizontal drag (mouse or finger) steps a carousel ---- */
  function enableSwipe(el, step) {
    var x0 = null, y0 = null;
    el.addEventListener("pointerdown", function (e) { x0 = e.clientX; y0 = e.clientY; }, { passive: true });
    el.addEventListener("pointerup", function (e) {
      if (x0 === null) return;
      var dx = e.clientX - x0, dy = e.clientY - y0; x0 = y0 = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) step(dx < 0 ? 1 : -1);
    });
    el.addEventListener("pointercancel", function () { x0 = y0 = null; });
    el.style.touchAction = "pan-y";
  }
  window.enableSwipe = enableSwipe;

  /* ---- hover a card: its clip loads on first hover and plays while the pointer stays ---- */
  document.querySelectorAll(".slide, .pub").forEach(function (card) {
    var v = card.querySelector(".hover-video video");
    if (!v) return;
    var wrap = v.parentNode;
    card.addEventListener("mouseenter", function () {
      if (!v.getAttribute("src")) { v.src = v.dataset.src; v.load(); }
      var p = v.play();
      if (p && p.then) p.then(function () { wrap.classList.add("playing"); }).catch(function () {});
      else wrap.classList.add("playing");
    });
    card.addEventListener("mouseleave", function () { v.pause(); wrap.classList.remove("playing"); });
  });

  /* ---- quick-look popup ---- */
  var modal = document.getElementById("modal");
  if (!modal) return;
  var media = document.getElementById("modalMedia");
  var tag = document.getElementById("modalTag");
  var title = document.getElementById("modalTitle");
  var authors = document.getElementById("modalAuthors");
  var desc = document.getElementById("modalDesc");
  var links = document.getElementById("modalLinks");
  var more = document.getElementById("modalMore");
  var closeBtn = modal.querySelector(".modal-close");
  var lastTrigger = null;

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function find(kind, id) {
    var list = C[kind] || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function renderMedia(item) {
    var fit = item.fit === "contain" ? ' class="fit-contain"' : "";
    var alts = item.alts || [];
    if (item.video) {
      return '<video autoplay muted loop playsinline poster="' + esc(item.images[0]) + '"><source src="' + esc(item.video) + '" type="video/mp4"></video>';
    }
    if (item.images.length > 1) {
      var slides = item.images.map(function (src, i) {
        return '<div><img src="' + esc(src) + '" alt="' + esc(alts[i] || "") + '"' + fit + "></div>";
      }).join("");
      return '<div class="carousel-track">' + slides + "</div>" +
        '<button class="c-btn prev" type="button" aria-label="Previous"><svg viewBox="0 0 24 24"><polyline points="15 6 9 12 15 18"/></svg></button>' +
        '<button class="c-btn next" type="button" aria-label="Next"><svg viewBox="0 0 24 24"><polyline points="9 6 15 12 9 18"/></svg></button>';
    }
    return '<img src="' + esc(item.images[0]) + '" alt="' + esc(alts[0] || "") + '"' + fit + ">";
  }

  var stepCarousel = null;
  function bindCarousel() {
    stepCarousel = null;
    var track = media.querySelector(".carousel-track");
    if (!track) return;
    var idx = 0, n = track.children.length;
    stepCarousel = function (dir) {
      idx = (idx + dir + n) % n;
      track.style.transform = "translateX(" + (-idx * 100) + "%)";
    };
    media.querySelectorAll(".c-btn").forEach(function (b) {
      b.addEventListener("click", function () { stepCarousel(b.classList.contains("next") ? 1 : -1); });
    });
    enableSwipe(media, stepCarousel);
  }

  /* onomatopoeia burst behind the panel — removed once the words have faded */
  var FX = ["KA-POW!", "VHOOM!", "BOOM!", "ZAP!", "WHAMM!", "THWIP!", "KRAK!"];
  var fxIndex = 0;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function burst(main) {
    if (reduce) return;
    var old = modal.querySelector(".modal-burst");
    if (old) old.remove();
    var minis = ["POW!", "BAM!", "ZING!"];
    var el = document.createElement("div");
    el.className = "modal-burst";
    el.setAttribute("aria-hidden", "true");
    el.innerHTML = '<span class="pop-fx pop-fx-main">' + esc(main) + "</span>" +
      minis.map(function (w, i) { return '<span class="pop-fx pop-fx-mini pop-fx-' + i + '">' + w + "</span>"; }).join("");
    modal.appendChild(el);
    setTimeout(function () { el.remove(); }, 1200);
  }
  /* the panel flies in from whatever was clicked */
  function flyFrom(trigger) {
    var panel = modal.querySelector(".modal-panel");
    var dx = 0, dy = 0;
    if (trigger && trigger.getBoundingClientRect) {
      var r = trigger.getBoundingClientRect();
      dx = r.left + r.width / 2 - window.innerWidth / 2;
      dy = r.top + r.height / 2 - window.innerHeight / 2;
    }
    panel.style.setProperty("--from-x", Math.round(dx) + "px");
    panel.style.setProperty("--from-y", Math.round(dy) + "px");
    panel.style.animation = "none"; void panel.offsetWidth; panel.style.animation = "";
  }

  function open(kind, id, trigger) {
    var item = find(kind, id);
    if (!item) return false;
    var isPub = kind === "publications";
    media.innerHTML = renderMedia(item);
    bindCarousel();
    tag.textContent = isPub ? (item.venue_short || item.venue) + " " + item.year : (item.tag || "Project") + " " + item.year;
    title.innerHTML = item.title;
    authors.innerHTML = isPub
      ? item.authors + '<span class="venue"><em>' + esc(item.venue) + "</em>, " + item.year + (item.note ? " &middot; " + item.note : "") + "</span>"
      : "";
    authors.hidden = !isPub;
    desc.innerHTML = item.desc;
    links.innerHTML = (item.links || []).map(function (l) {
      var ext = l.internal ? "" : ' target="_blank" rel="noopener"';
      return '<a href="' + esc(l.href) + '"' + ext + ">" + esc(l.label) + "</a>";
    }).join("");
    more.href = (isPub ? "publications.html" : "projects.html") + "#" + item.id;
    modal.classList.remove("modal-photo");
    lastTrigger = trigger || null;
    modal.hidden = false;
    flyFrom(trigger);
    burst(FX[fxIndex++ % FX.length]);
    document.body.classList.add("modal-open");
    closeBtn.focus();
    return true;
  }

  /* portrait lightbox */
  function openPhoto(link) {
    var img = link.querySelector("img");
    media.innerHTML = '<img src="' + esc(link.getAttribute("href")) + '" alt="' + esc(img ? img.alt : "") + '">';
    tag.textContent = "Portrait";
    title.innerHTML = 'Jerry (Qilong) Cheng <span class="sc" lang="zh">程启龙</span>';
    authors.innerHTML = ""; desc.innerHTML = ""; links.innerHTML = ""; more.removeAttribute("href");
    modal.classList.add("modal-photo");
    lastTrigger = link;
    modal.hidden = false;
    flyFrom(link);
    burst("TA-DA!");
    document.body.classList.add("modal-open");
    closeBtn.focus();
  }

  function close() {
    if (modal.hidden) return;
    var v = media.querySelector("video");
    if (v) v.pause();
    media.innerHTML = "";
    modal.classList.remove("modal-photo");
    var b = modal.querySelector(".modal-burst"); if (b) b.remove();
    modal.hidden = true;
    document.body.classList.remove("modal-open");
    if (lastTrigger && lastTrigger.focus) lastTrigger.focus();
  }

  document.addEventListener("click", function (e) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1 || !e.target.closest) return;
    var photo = e.target.closest(".photo-panel a");
    if (photo) { e.preventDefault(); openPhoto(photo); return; }
    var card = e.target.closest(".slide[data-id]");
    if (card && open(card.dataset.kind, card.dataset.id, card)) e.preventDefault();
  });
  modal.querySelectorAll("[data-close]").forEach(function (el) { el.addEventListener("click", close); });
  document.addEventListener("keydown", function (e) {
    if (modal.hidden) return;
    if (e.key === "Escape") close();
    else if (e.key === "ArrowRight" && stepCarousel) stepCarousel(1);
    else if (e.key === "ArrowLeft" && stepCarousel) stepCarousel(-1);
  });
})();
