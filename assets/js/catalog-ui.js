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
    var strip = wrap.querySelector(".strip");
    if (!strip) return;
    wrap.querySelectorAll(".strip-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var card = strip.querySelector(".slide");
        var step = card ? card.getBoundingClientRect().width + 18 : 310;
        strip.scrollBy({ left: (btn.classList.contains("next") ? 1 : -1) * step * 2, behavior: "smooth" });
      });
    });
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

  function bindCarousel() {
    var track = media.querySelector(".carousel-track");
    if (!track) return;
    var idx = 0, n = track.children.length;
    media.querySelectorAll(".c-btn").forEach(function (b) {
      b.addEventListener("click", function () {
        idx = (idx + (b.classList.contains("next") ? 1 : -1) + n) % n;
        track.style.transform = "translateX(" + (-idx * 100) + "%)";
      });
    });
  }

  function open(kind, id, trigger) {
    var item = find(kind, id);
    if (!item) return false;
    var isPub = kind === "publications";
    media.innerHTML = renderMedia(item);
    bindCarousel();
    tag.textContent = isPub ? item.venue + " " + item.year : (item.tag || "Project") + " " + item.year;
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
    lastTrigger = trigger || null;
    modal.hidden = false;
    document.body.classList.add("modal-open");
    closeBtn.focus();
    return true;
  }

  function close() {
    if (modal.hidden) return;
    var v = media.querySelector("video");
    if (v) v.pause();
    media.innerHTML = "";
    modal.hidden = true;
    document.body.classList.remove("modal-open");
    if (lastTrigger && lastTrigger.focus) lastTrigger.focus();
  }

  document.addEventListener("click", function (e) {
    var card = e.target.closest ? e.target.closest(".slide[data-id]") : null;
    if (!card || e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
    if (open(card.dataset.kind, card.dataset.id, card)) e.preventDefault();
  });
  modal.querySelectorAll("[data-close]").forEach(function (el) { el.addEventListener("click", close); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
})();
