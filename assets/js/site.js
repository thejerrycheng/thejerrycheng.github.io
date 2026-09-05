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
    if (themeMeta) themeMeta.setAttribute("content", mode === "day" ? "#7FB6DF" : "#151820");
    [].forEach.call(document.querySelectorAll(".theme-btn"), function (b) { b.setAttribute("aria-pressed", String(mode === "day")); });
    if (persist) { try { localStorage.setItem("theme", mode); } catch (e) {} }
  }
  applyTheme(root.getAttribute("data-theme") === "day" ? "day" : "night", false);
  [].forEach.call(document.querySelectorAll(".theme-btn"), function (btn) {
    btn.addEventListener("click", function () { applyTheme(root.getAttribute("data-theme") === "day" ? "night" : "day", true); });
  });

  /* ---- Critters: bats after dark, pigeons by day; one flock per sky ---- */
  [].forEach.call(document.querySelectorAll(".night-sky"), function (sky) {
    for (var i = 1; i <= 5; i++) {
      var c = document.createElement("i"); c.className = "critter c" + i; c.setAttribute("aria-hidden", "true"); sky.appendChild(c);
    }
  });
  var portrait = document.querySelector(".cover .photo-panel");
  if (portrait) ["p1", "p2"].forEach(function (k) {
    var b = document.createElement("i"); b.className = "perch " + k; b.setAttribute("aria-hidden", "true"); portrait.appendChild(b);
  });

  /* ---- Nav: tighten the masthead once the page scrolls ---- */
  var navEl = document.querySelector(".nav");
  if (navEl) {
    var onScroll = function () { navEl.classList.toggle("scrolled", window.scrollY > 24); };
    window.addEventListener("scroll", onScroll, { passive: true }); onScroll();
  }

  /* ---- Mobile menu ---- */
  var menuBtn  = document.getElementById("menuButton");
  var menu     = document.getElementById("mobileMenu");
  var backdrop = document.getElementById("navBackdrop");
  function closeMenu() {
    if (menu) menu.hidden = true;
    if (backdrop) backdrop.hidden = true;
    if (menuBtn) menuBtn.setAttribute("aria-expanded", "false");
  }
  if (menuBtn && menu) {
    menuBtn.addEventListener("click", function () {
      var open = menu.hidden;
      menu.hidden = !open;
      if (backdrop) backdrop.hidden = !open;
      menuBtn.setAttribute("aria-expanded", String(open));
    });
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
        ["HEY!", "YO!"].forEach(function (w, k) {
          var f = document.createElement("span"); f.className = "pop-fx pop-fx-mini say-fx f" + k; f.textContent = w; wrap.appendChild(f);
          timers.push(setTimeout(function () { f.remove(); }, 1100));
        });
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
