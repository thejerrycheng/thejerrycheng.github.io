/* =============================================================================
   site.js — shared behaviour for all pages
   Nav (mobile + Robolog dropdown) · media carousels · news timeline · last-updated
   ============================================================================= */
(function () {
  "use strict";

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
  });

  /* ---- News timeline ---- */
  var scroller = document.getElementById("news-horizontal");
  var dots = Array.prototype.slice.call(document.querySelectorAll(".news-dot"));
  if (scroller && dots.length) {
    dots.forEach(function (dot) {
      dot.addEventListener("click", function () {
        var card = document.getElementById("news-" + dot.dataset.target);
        if (card) scroller.scrollTo({ left: card.offsetLeft - scroller.offsetLeft, behavior: "smooth" });
      });
    });
    var setActive = function () {
      var mid = scroller.scrollLeft + scroller.clientWidth / 2;
      var best = 0, bestD = Infinity;
      var cards = scroller.querySelectorAll(".news-card");
      cards.forEach(function (c, i) {
        var center = c.offsetLeft + c.offsetWidth / 2 - scroller.offsetLeft;
        var d = Math.abs(center - mid);
        if (d < bestD) { bestD = d; best = i; }
      });
      dots.forEach(function (d, i) { d.classList.toggle("active", i === best); });
    };
    scroller.addEventListener("scroll", function () { window.requestAnimationFrame(setActive); }, { passive: true });
  }

  /* ---- Last updated ---- */
  var lu = document.querySelector("#last-updated time");
  if (lu) {
    var d = new Date(document.lastModified);
    lu.textContent = "Last updated: " + d.toLocaleString(undefined, {
      year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit"
    });
    lu.setAttribute("datetime", d.toISOString());
  }

  /* ---- Live stat dashboard (hero) ---- */
  var dash = document.getElementById("stat-dash");
  if (dash) {
    var fmt = function (n) {
      n = Number(n);
      if (!isFinite(n)) return "—";
      if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
      if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "k";
      return String(n);
    };
    var setStat = function (name, val) {
      var el = dash.querySelector('[data-stat="' + name + '"]');
      if (el && val != null && val !== "") el.textContent = fmt(val);
    };
    // Manual / periodic values (Scholar, X, TikTok — no free live API)
    fetch("stats.json", { cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (s) { setStat("citations", s.citations); setStat("hindex", s.hindex); setStat("x", s.x); setStat("tiktok", s.tiktok); })
      .catch(function () {});
    // GitHub stars — live
    fetch("https://api.github.com/users/thejerrycheng/repos?per_page=100&type=owner")
      .then(function (r) { return r.json(); })
      .then(function (repos) { if (Array.isArray(repos)) setStat("stars", repos.reduce(function (a, b) { return a + (b.stargazers_count || 0); }, 0)); })
      .catch(function () {});
    // Total visits — live counter (increments per view)
    fetch("https://api.counterapi.dev/v1/thejerrycheng-github-io/visits/up")
      .then(function (r) { return r.json(); })
      .then(function (d) { if (d && d.count != null) setStat("visitors", d.count); })
      .catch(function () {});
  }
})();
