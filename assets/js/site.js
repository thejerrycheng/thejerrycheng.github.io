/* =============================================================================
   site.js — shared behaviour for all pages
   Nav (mobile + Robolog dropdown) · media carousels · name pronunciation · last-updated
   ============================================================================= */
(function () {
  "use strict";


  /* ---- Day / night ---- */
  var root = document.documentElement;
  var themeMeta = document.querySelector('meta[name="theme-color"]');
  function applyTheme(mode, persist) {
    root.setAttribute("data-theme", mode);
    if (themeMeta) themeMeta.setAttribute("content", mode === "day" ? "#F4EEE2" : "#000000");
    [].forEach.call(document.querySelectorAll(".theme-btn"), function (b) { b.setAttribute("aria-pressed", String(mode === "day")); });
    if (persist) { try { localStorage.setItem("theme-v2", mode); } catch (e) {} }
  }
  applyTheme(root.getAttribute("data-theme") === "day" ? "day" : "night", false);
  [].forEach.call(document.querySelectorAll(".theme-btn"), function (btn) {
    btn.addEventListener("click", function () { applyTheme(root.getAttribute("data-theme") === "day" ? "night" : "day", true); });
  });

  /* ---- Nav: tighten the masthead once the page scrolls ---- */
  var navEl = document.querySelector(".nav");
  if (navEl) {
    var onScroll = function () { navEl.classList.toggle("scrolled", window.scrollY > 4); };
    window.addEventListener("scroll", onScroll, { passive: true }); onScroll();
  }

  /* ---- Mobile menu ---- */
  var menuBtn  = document.getElementById("menuButton");
  var menu     = document.getElementById("mobileMenu");
  var backdrop = document.getElementById("navBackdrop");
  var closing = null;
  function closeMenu() {
    if (!menu || menu.hidden) return;
    if (menuBtn) menuBtn.setAttribute("aria-expanded", "false");
    menu.classList.add("closing"); if (backdrop) backdrop.classList.add("closing");
    clearTimeout(closing);
    closing = setTimeout(function () {
      menu.hidden = true; menu.classList.remove("closing");
      if (backdrop) { backdrop.hidden = true; backdrop.classList.remove("closing"); }
    }, 190);
  }
  function openMenu() {
    clearTimeout(closing); menu.classList.remove("closing");
    menu.hidden = false;
    if (backdrop) { backdrop.classList.remove("closing"); backdrop.hidden = false; }
    menuBtn.setAttribute("aria-expanded", "true");
  }
  if (menuBtn && menu) {
    menuBtn.addEventListener("click", function () {
      if (menu.hidden || menu.classList.contains("closing")) openMenu(); else closeMenu();
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeMenu(); });
  }
  if (backdrop) backdrop.addEventListener("click", closeMenu);

  /* ---- Robolog dropdown ---- */
  var toggle = document.getElementById("robologToggle");
  var dd     = document.getElementById("robologMenu");
  if (toggle && dd) {
    toggle.addEventListener("click", function (e) {
      e.stopPropagation();
      var open = dd.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
    });
    document.addEventListener("click", function (e) {
      if (!dd.contains(e.target) && e.target !== toggle) {
        dd.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* ---- Generic media carousels (publications + news) ---- */
  function slideCount(track) { return track.children.length; }
  document.querySelectorAll("[data-carousel]").forEach(function (wrap) {
    var track = wrap.querySelector(".carousel-track");
    if (!track) return;
    var idx = 0;
    function go(dir) {
      var n = slideCount(track);
      idx = (idx + dir + n) % n;
      track.style.transform = "translateX(" + (-idx * 100) + "%)";
    }
    wrap.querySelectorAll(".c-btn").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault(); e.stopPropagation();
        go(btn.classList.contains("prev") ? -1 : 1);
      });
    });
    /* drag or swipe across the media to step it as well */
    var x0 = null, y0 = null;
    wrap.addEventListener("pointerdown", function (e) { x0 = e.clientX; y0 = e.clientY; }, { passive: true });
    wrap.addEventListener("pointerup", function (e) {
      if (x0 === null) return;
      var dx = e.clientX - x0, dy = e.clientY - y0; x0 = y0 = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
    });
    wrap.style.touchAction = "pan-y";
  });

  /* ---- Name pronunciation (hero): play the clip, type out how it sounds, fling a word or two ---- */
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  [].forEach.call(document.querySelectorAll(".say-name[data-audio]"), function (btn) {
    var audio = null, wrap = btn.parentNode, timers = [];
    function clearTimers() { timers.forEach(clearTimeout); timers = []; }
    function typeOut() {
      clearTimers();
      var old = wrap.querySelector(".say-bubble"); if (old) old.remove();
      [].forEach.call(wrap.querySelectorAll(".say-fx"), function (f) { f.remove(); });
      var spell = btn.getAttribute("data-spell") || "";
      var pinyin = btn.getAttribute("data-pinyin") || "";
      var bubble = document.createElement("span"); bubble.className = "say-bubble";
      var typed = document.createElement("span"); typed.className = "say-typed"; bubble.appendChild(typed);
      if (pinyin) { var sm = document.createElement("small"); sm.textContent = pinyin; bubble.appendChild(sm); }
      wrap.appendChild(bubble);
      if (reduceMotion) { typed.textContent = spell; typed.classList.add("done"); }
      else {
        for (var i = 1; i <= spell.length; i++) (function (n) {
          timers.push(setTimeout(function () { typed.textContent = spell.slice(0, n); if (n === spell.length) typed.classList.add("done"); }, 70 * n));
        })(i);
      }
      timers.push(setTimeout(function () { bubble.classList.add("gone"); }, 70 * spell.length + 2200));
      timers.push(setTimeout(function () { bubble.remove(); }, 70 * spell.length + 2500));
    }
    btn.addEventListener("click", function () {
      if (!audio) {
        audio = new Audio(btn.getAttribute("data-audio"));
        audio.addEventListener("ended", function () { btn.classList.remove("playing"); });
        audio.addEventListener("error", function () { btn.classList.remove("playing"); });
      }
      audio.currentTime = 0;
      btn.classList.add("playing");
      var p = audio.play();
      if (p && p.catch) p.catch(function () { btn.classList.remove("playing"); });
      typeOut();
    });
  });

  /* ---- CV experience cards: a link in the header follows, it does not toggle ---- */
  [].forEach.call(document.querySelectorAll(".exp > summary a"), function (a) {
    a.addEventListener("click", function (e) { e.stopPropagation(); });
  });

  /* ---- CV experience cards: expand or collapse a whole section at once ---- */
  [].forEach.call(document.querySelectorAll("[data-expand-all]"), function (btn) {
    var scope = btn.closest("section") || document;
    var cards = [].slice.call(scope.querySelectorAll("details.exp"));
    if (!cards.length) { btn.hidden = true; return; }
    function allOpen() { return cards.every(function (d) { return d.open; }); }
    function sync() {
      var open = allOpen();
      btn.textContent = open ? "Collapse all" : "Expand all";
      btn.setAttribute("aria-expanded", String(open));
    }
    btn.addEventListener("click", function () {
      var open = !allOpen();
      cards.forEach(function (d) { d.open = open; });
      sync();
    });
    cards.forEach(function (d) { d.addEventListener("toggle", sync); });
    sync();
  });

  /* ---- Scroll reveal: blocks rise in as they enter the viewport, once ---- */
  (function () {
    var still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (still || !("IntersectionObserver" in window)) return;
    var SEL = ".section > *, .pub-list > *, .tl-item, .exp-stack > *, .blog-grid > *, .grid-2 > *, .site-footer .wrap";
    var all = [].slice.call(document.querySelectorAll(SEL));
    /* only the innermost match animates, so a list and its rows never fade twice */
    var set = all.filter(function (el) {
      if (el.closest(".modal, .nav, .mobile-menu, .cover, .page-cover")) return false;
      if (el.tagName === "SCRIPT" || el.tagName === "STYLE") return false;
      return !all.some(function (o) { return o !== el && el.contains(o); });
    });
    if (!set.length) return;
    var vh = window.innerHeight || 800;
    function done(el) { el.classList.remove("rv", "rv-in"); el.style.removeProperty("--rv-d"); }
    var io = new IntersectionObserver(function (entries) {
      var k = 0;
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target; io.unobserve(el);
        var d = Math.min(k++, 6) * 70;
        el.style.setProperty("--rv-d", d + "ms");
        el.classList.add("rv-in");
        setTimeout(function () { done(el); }, d + 1300);
      });
    }, { rootMargin: "0px 0px -7% 0px", threshold: 0.01 });
    set.forEach(function (el) {
      /* what is already on screen at load stays put; only what is below the fold waits */
      if (el.getBoundingClientRect().top < vh * 0.92) return;
      el.classList.add("rv"); io.observe(el);
    });
    /* a jump to #anchor must never land on something still hidden */
    window.addEventListener("hashchange", function () {
      var t = document.getElementById(location.hash.slice(1));
      if (t) [].forEach.call(document.querySelectorAll(".rv"), function (el) { if (el.contains(t) || t.contains(el)) done(el); });
    });
  })();


  /* ---- Last updated ---- */
  var lu = document.querySelector("#last-updated time");
  if (lu) {
    var d = new Date(document.lastModified);
    lu.textContent = "Last updated: " + d.toLocaleString(undefined, {
      year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit"
    });
    lu.setAttribute("datetime", d.toISOString());
  }

})();
