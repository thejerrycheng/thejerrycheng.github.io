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
    if (themeMeta) themeMeta.setAttribute("content", mode === "day" ? "#F4EEE2" : "#191612");
    [].forEach.call(document.querySelectorAll(".theme-btn"), function (b) { b.setAttribute("aria-pressed", String(mode === "day")); });
    if (persist) { try { localStorage.setItem("theme-v2", mode); } catch (e) {} }
  }
  applyTheme(root.getAttribute("data-theme") === "day" ? "day" : "night", false);
  [].forEach.call(document.querySelectorAll(".theme-btn"), function (btn) {
    btn.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "day" ? "night" : "day";
      var swap = function () { applyTheme(next, true); };
      if (!document.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches) return swap();
      var r = btn.getBoundingClientRect();                 /* the new theme spreads out from the button */
      root.style.setProperty("--vx", Math.round(r.left + r.width / 2) + "px");
      root.style.setProperty("--vy", Math.round(r.top + r.height / 2) + "px");
      root.classList.add("theme-vt");
      var t = document.startViewTransition(swap);
      t.finished.then(function () { root.classList.remove("theme-vt"); }, function () { root.classList.remove("theme-vt"); });
    });
  });

  /* ---- Nav: one highlight that slides and stretches between links (as in Duck Servo Studio) ---- */
  [].forEach.call(document.querySelectorAll(".nav-links"), function (box) {
    var blob = document.createElement("span");
    blob.className = "nav-blob"; blob.setAttribute("aria-hidden", "true");
    box.insertBefore(blob, box.firstChild);
    var items = [].slice.call(box.querySelectorAll(":scope > a, :scope > .dropdown > button"));
    var home = box.querySelector('a[aria-current="page"]');
    function to(el, instant) {
      if (!el || !el.offsetWidth) { blob.style.opacity = 0; return; }
      var b = box.getBoundingClientRect(), r = el.getBoundingClientRect();
      if (instant || blob.style.opacity !== "1") blob.style.transition = "opacity .25s";   /* first showing: appear in place */
      blob.style.left = (r.left - b.left) + "px"; blob.style.top = (r.top - b.top) + "px";
      blob.style.width = r.width + "px"; blob.style.height = r.height + "px";
      void blob.offsetWidth; blob.style.transition = ""; blob.style.opacity = 1;
    }
    items.forEach(function (a) {
      a.addEventListener("mouseenter", function () { to(a); });
      a.addEventListener("focus", function () { to(a); });
    });
    box.addEventListener("mouseleave", function () { to(home); });
    box.addEventListener("focusout", function (e) { if (!box.contains(e.relatedTarget)) to(home); });
    to(home, true);
    window.addEventListener("resize", function () { to(home, true); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { to(home, true); });
  });

  /* ---- Nav: tighten the masthead once the page scrolls ---- */
  var navEl = document.querySelector(".nav");
  if (navEl) {
    var onScroll = function () { navEl.classList.toggle("scrolled", window.scrollY > 4); root.classList.toggle("past-cover", window.scrollY > 40); };
    window.addEventListener("scroll", onScroll, { passive: true }); onScroll();
  }

  /* ---- Social dock: the cover's links come back as a glass stack at the top left once they scroll away ---- */
  (function () {
    var row = document.querySelector(".cover .btn-row-social");
    var inner = document.querySelector(".nav-inner"), brand = inner && inner.querySelector(".brand");
    if (!row || !brand || !("IntersectionObserver" in window)) return;
    var dock = document.createElement("div");
    dock.className = "dock"; dock.id = "socialDock"; dock.setAttribute("role", "group"); dock.setAttribute("aria-label", "Links");
    [].forEach.call(row.querySelectorAll("a.btn"), function (a, i) {
      var c = document.createElement("a"), svg = a.querySelector("svg"), label = a.textContent.trim();
      c.href = a.getAttribute("href");
      if (a.target) { c.target = a.target; c.rel = "noopener"; }
      c.setAttribute("aria-label", label); c.style.setProperty("--i", i);
      if (svg) c.appendChild(svg.cloneNode(true));
      var sp = document.createElement("span"); sp.textContent = label; c.appendChild(sp);
      dock.appendChild(c);
    });
    document.body.appendChild(dock);
    [].forEach.call(dock.children, function (c) { c.style.setProperty("--w", (36 + c.lastChild.offsetWidth) + "px"); });   /* icon + its label */
    var more = document.createElement("button");
    more.type = "button"; more.className = "dock-more"; more.setAttribute("aria-label", "Links: email, GitHub, X, CV, Scholar");
    more.setAttribute("aria-controls", "socialDock"); more.setAttribute("aria-expanded", "false");
    more.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="19" cy="12" r="1.9"/></svg>';
    brand.parentNode.insertBefore(more, brand.nextSibling);
    function setOpen(on) { root.classList.toggle("dock-open", on); more.setAttribute("aria-expanded", String(on)); }
    more.addEventListener("click", function (e) { e.stopPropagation(); setOpen(!root.classList.contains("dock-open")); });
    document.addEventListener("click", function (e) { if (!dock.contains(e.target)) setOpen(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") setOpen(false); });
    new IntersectionObserver(function (es) {
      var gone = !es[0].isIntersecting && es[0].boundingClientRect.top < 60;
      root.classList.toggle("dock-on", gone);
      if (!gone) setOpen(false);
    }, { rootMargin: "-48px 0px 0px 0px" }).observe(row);
  })();

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

  /* ---- CV: a research or work entry opens its full write-up in a popup ---- */
  (function () {
    var xm = document.getElementById("xpModal");
    var xb = document.getElementById("xpBody");
    if (!xm || !xb) return;
    var last = null;
    function openXp(key, from) {
      var t = document.getElementById("xp-" + key);
      if (!t) return false;
      clearTimeout(xt); xm.classList.remove("closing");
      xb.innerHTML = "";
      xb.appendChild(t.content.cloneNode(true));
      last = from || null;
      xm.hidden = false;
      xm.querySelector(".modal-panel").scrollTop = 0;
      document.body.classList.add("modal-open");
      xm.querySelector(".modal-close").focus({ preventScroll: true });
      return true;
    }
    var xt = null;
    function closeXp() {
      if (xm.hidden || xm.classList.contains("closing")) return;
      document.body.classList.remove("modal-open");
      if (last) last.focus({ preventScroll: true });
      var done = function () { xm.classList.remove("closing"); xm.hidden = true; xb.innerHTML = ""; };
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) return done();
      xm.classList.add("closing"); xt = setTimeout(done, 300);   /* the sheet blurs away before it goes */
    }
    [].forEach.call(document.querySelectorAll(".tl-item[data-xp]"), function (li) {
      li.addEventListener("click", function (e) {
        if (e.target.closest("a")) return;
        openXp(li.getAttribute("data-xp"), li);
      });
      li.addEventListener("keydown", function (e) {
        if (e.target !== li) return;
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openXp(li.getAttribute("data-xp"), li); }
      });
    });
    [].forEach.call(xm.querySelectorAll("[data-xp-close]"), function (el) { el.addEventListener("click", closeXp); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeXp(); });
    var h = location.hash.slice(1);
    if (h && document.getElementById("xp-" + h)) openXp(h, document.querySelector('.tl-item[data-xp="' + h + '"]'));
  })();

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

  /* ---- News timeline: the thread fills and the dots light as the page scrolls ---- */
  (function () {
    var nt = document.getElementById("newsTimeline");
    if (!nt) return;
    var items = [].slice.call(nt.querySelectorAll(".nt-item"));
    var tick = false;
    function paint() {
      tick = false;
      var r = nt.getBoundingClientRect();
      var mark = (window.innerHeight || 800) * 0.62;
      var p = Math.max(0, Math.min(1, (mark - r.top - 14) / Math.max(1, r.height - 14)));
      nt.style.setProperty("--nt-p", p.toFixed(4));
      items.forEach(function (it) {
        it.classList.toggle("is-on", it.getBoundingClientRect().top + 28 < mark);
      });
    }
    function ask() { if (!tick) { tick = true; requestAnimationFrame(paint); } }
    window.addEventListener("scroll", ask, { passive: true });
    window.addEventListener("resize", ask);
    window.addEventListener("load", ask);
    paint();
  })();

  /* ---- Scroll reveal: blocks rise in as they enter the viewport, once ---- */
  (function () {
    var still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (still || !("IntersectionObserver" in window)) return;
    var SEL = ".section > *, .pub-list > *, .nt > *, .tl-item, .exp-stack > *, .blog-grid > *, .grid-2 > *, .site-footer .wrap";
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
        /* tidy up once the entrance has fully settled; the timer is only a backstop */
        var t, fin = function (ev) {
          if (ev && (ev.target !== el || ev.propertyName !== "transform")) return;
          el.removeEventListener("transitionend", fin); clearTimeout(t); done(el);
        };
        el.addEventListener("transitionend", fin);
        t = setTimeout(fin, d + 1600);
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


  /* ---- List rows: the whole card leads where its title does ---- */
  document.addEventListener("click", function (e) {
    var row = e.target.closest && e.target.closest(".pub[data-go]");
    if (!row || e.target.closest("a, button, video, input, select")) return;
    if (window.getSelection && String(window.getSelection())) return;      /* the reader was selecting text */
    var url = row.getAttribute("data-go");
    if (row.hasAttribute("data-go-new")) window.open(url, "_blank", "noopener"); else location.href = url;
  });

  /* ---- GitHub repos: live stars and forks on every repo button ----
     Shows the committed snapshot (assets/data/repo_stats.json) at once, then the
     live count from the GitHub API, cached per browser for 30 min so a visitor
     stays far below the 60-requests-an-hour anonymous limit. Prose credits to
     other people's repos are left alone. */
  (function () {
    var OWN = /^(thejerrycheng|robotmabel|huangbj16|utiasstars|purdue-tracelab)$/i;
    var RE = /^https?:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?(?:[#?].*)?$/i;
    var TTL = 30 * 60 * 1000, KEY = "ghstats-v1";
    var snap = {}, live = {}, pending = {};
    try { live = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { live = {}; }
    var base = (document.querySelector('script[src*="assets/js/site.js"]') || {}).getAttribute ? document.querySelector('script[src*="assets/js/site.js"]').getAttribute("src").replace(/assets\/js\/site\.js.*$/, "") : "";
    function fmt(n) { return n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "") + "k" : String(n); }
    function repoOf(a) {
      var m = RE.exec(a.getAttribute("href") || ""); if (!m || !OWN.test(m[1])) return null;
      if (a.closest("p, figcaption, td, blockquote, .md-end, .nav, .site-footer")) return null;
      return (m[1] + "/" + m[2]).toLowerCase();
    }
    function paint(a, d) {
      var b = a.querySelector(".gh-stats"), k = d.s + "/" + d.f;
      if (b && b.getAttribute("data-k") === k) return;      /* unchanged: no DOM write, so the observer stays quiet */
      if (!b) { b = document.createElement("span"); b.className = "gh-stats"; a.appendChild(b); a.classList.add("has-gh"); }
      b.innerHTML = '<span class="gh-s" title="GitHub stars">\u2605 ' + fmt(d.s) + '</span><span class="gh-f" title="GitHub forks">\u2442 ' + fmt(d.f) + "</span>";
      b.setAttribute("aria-label", d.s + " stars, " + d.f + " forks on GitHub");
      b.setAttribute("data-k", k);
    }
    function all(repo) { return [].filter.call(document.querySelectorAll('a[href*="github.com/"]'), function (a) { return repoOf(a) === repo; }); }
    function show(repo) { var d = (live[repo] && live[repo].d) || snap[repo]; if (d) all(repo).forEach(function (a) { paint(a, d); }); }
    function fetchLive(repo) {
      if (pending[repo]) return; var c = live[repo];
      if (c && Date.now() - c.t < TTL) return;
      if (c && c.miss && Date.now() - c.t < TTL) return;
      pending[repo] = 1;
      fetch("https://api.github.com/repos/" + repo, { headers: { Accept: "application/vnd.github+json" } })
        .then(function (r) { if (r.status === 404) { live[repo] = { t: Date.now(), miss: 1 }; throw 0; } if (!r.ok) throw 0; return r.json(); })
        .then(function (j) { live[repo] = { t: Date.now(), d: { s: j.stargazers_count, f: j.forks_count } }; try { localStorage.setItem(KEY, JSON.stringify(live)); } catch (e) {} show(repo); })
        .catch(function () {});
    }
    function scan(scope) {
      var seen = {};
      [].forEach.call((scope || document).querySelectorAll('a[href*="github.com/"]'), function (a) { var r = repoOf(a); if (r && !seen[r]) { seen[r] = 1; show(r); fetchLive(r); } });
    }
    fetch(base + "assets/data/repo_stats.json", { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : {}; })
      .then(function (j) { snap = (j && j.repos) || {}; }).catch(function () {}).then(function () { scan(); });
    /* the publication / project popup fills its links after the page loads */
    if ("MutationObserver" in window) {
      var t; new MutationObserver(function () { clearTimeout(t); t = setTimeout(function () { scan(); }, 60); })
        .observe(document.body, { childList: true, subtree: true });
    }
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
