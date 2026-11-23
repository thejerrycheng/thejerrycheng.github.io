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
    /* on phones the home page scrolls inside <body> (see HOME STEPS v3), so read both and listen in the capture phase */
    var onScroll = function () { var y = window.scrollY || document.body.scrollTop || 0; navEl.classList.toggle("scrolled", y > 4); root.classList.toggle("past-cover", y > 40); };
    document.addEventListener("scroll", onScroll, { passive: true, capture: true }); onScroll();
    /* a scrolling <body> is not restored by the browser on Back: remember where the visitor was */
    if (document.querySelector(".step")) {
      var key = "home-y";
      window.addEventListener("pagehide", function () { try { sessionStorage.setItem(key, String(document.body.scrollTop || 0)); } catch (e) {} });
      var back = function () {
        var nav = performance.getEntriesByType && performance.getEntriesByType("navigation")[0];
        if (!nav || nav.type !== "back_forward" || location.hash) return;
        var y = 0; try { y = +sessionStorage.getItem(key) || 0; } catch (e) {}
        if (y > 0 && !window.scrollY) { var b = document.body, sb = b.style.scrollBehavior; b.style.scrollBehavior = "auto"; b.scrollTop = y; b.style.scrollBehavior = sb; onScroll(); }
      };
      window.addEventListener("load", back);
    }
  }

  /* ---- Social dock: my links (email, GitHub, X, CV, Scholar) stay within reach on every personal page.
     Wide screens: a glass stack at the top left. Narrower screens and phones: icons in the nav bar, beside the logo.
     On the home page they start as the big buttons on the cover and fly into the dock when the cover is left. ---- */
  (function () {
    var inner = document.querySelector(".nav-inner"), brand = inner && inner.querySelector(".brand");
    var row = document.querySelector(".cover .btn-row-social");
    var page = (location.pathname.split("/").pop() || "index.html").toLowerCase();
    var personal = ["index.html", "publications.html", "projects.html", "news.html", "cv.html"].indexOf(page) >= 0;
    if (!brand || (!row && !personal)) return;
    var LINKS = [["Email", "mailto:qilong.cheng@mail.utoronto.ca", false, "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><rect x=\"3\" y=\"5\" width=\"18\" height=\"14\" rx=\"3.5\"/><path d=\"M4 8l7.3 5a1.2 1.2 0 0 0 1.4 0L20 8\"/></svg>"], ["GitHub", "https://github.com/thejerrycheng", true, "<svg viewBox=\"0 0 24 24\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M12 2C6.48 2 2 6.58 2 12.26c0 4.5 2.87 8.32 6.84 9.67.5.09.68-.22.68-.48 0-.24-.01-.87-.01-1.71-2.78.62-3.37-1.35-3.37-1.35-.46-1.18-1.11-1.49-1.11-1.49-.91-.63.07-.62.07-.62 1 .07 1.53 1.05 1.53 1.05.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.36-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.27 2.75 1.05a9.3 9.3 0 0 1 5 0c1.91-1.32 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.81-4.57 5.06.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.81 0 .27.18.59.69.48A10.02 10.02 0 0 0 22 12.26C22 6.58 17.52 2 12 2z\"/></svg>"], ["X", "https://x.com/thejerrycheng", true, "<svg viewBox=\"0 0 24 24\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M17.53 3h2.97l-6.49 7.41L21.75 21h-6.02l-4.71-6.16L5.6 21H2.63l6.94-7.93L2.25 3h6.17l4.26 5.63L17.53 3zm-1.05 16.2h1.65L7.6 4.71H5.83L16.48 19.2z\"/></svg>"], ["CV", "assets/pdf/Academic_Resume-10.pdf", true, "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z\"/><path d=\"M14 3v5h5\"/><path d=\"M9 13h6M9 17h4\"/></svg>"], ["Scholar", "https://scholar.google.com/citations?user=iQuHS3MAAAAJ", true, "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M12 4 2 9l10 5 10-5-10-5z\"/><path d=\"M6 11v4c0 1.6 2.7 3 6 3s6-1.4 6-3v-4\"/></svg>"]];   /* label, href, opens a new tab, icon: the same five as the cover buttons in index.html */
    var dock = document.createElement("div");
    dock.className = "dock"; dock.id = "socialDock"; dock.setAttribute("role", "group"); dock.setAttribute("aria-label", "Links");
    var items = row ? [].map.call(row.querySelectorAll("a.btn"), function (a) { var g = a.querySelector("svg"); return [a.textContent.trim(), a.getAttribute("href"), !!a.target, g ? g.outerHTML : ""]; }) : LINKS;
    items.forEach(function (it, i) {
      var c = document.createElement("a");
      c.href = it[1]; if (it[2]) { c.target = "_blank"; c.rel = "noopener"; }
      c.setAttribute("aria-label", it[0]); c.style.setProperty("--i", i);
      c.innerHTML = it[3];
      var sp = document.createElement("span"); sp.textContent = it[0]; c.appendChild(sp);
      dock.appendChild(c);
    });
    document.body.appendChild(dock);
    [].forEach.call(dock.children, function (c) { c.style.setProperty("--w", (36 + c.lastChild.offsetWidth) + "px"); });   /* icon + its label */
    var bar = document.createElement("div");
    bar.className = "nav-dock"; bar.setAttribute("role", "group"); bar.setAttribute("aria-label", "Links");
    [].forEach.call(dock.children, function (c) { var d = c.cloneNode(true); d.removeChild(d.lastChild); bar.appendChild(d); });
    brand.parentNode.insertBefore(bar, brand.nextSibling);

    function still(fn) {
      root.classList.add("dock-still"); if (row) row.classList.add("no-anim");
      fn(); void dock.offsetWidth;
      requestAnimationFrame(function () { root.classList.remove("dock-still"); if (row) row.classList.remove("no-anim"); });
    }
    if (!row) { still(function () { root.classList.add("dock-on"); }); return; }      /* no cover on this page: the links are simply there */

    /* Home. Each button is carried by a fixed copy of itself that is re-aimed every frame at where the real
       button is right now, so it lands exactly on it even while the page is still scrolling. On the way to
       the dock the pill and its label fade and the icon shrinks; on the way home they come back together. */
    var srcs = [].slice.call(row.querySelectorAll("a.btn")), icons = srcs.map(function (a) { return a.querySelector("svg"); });
    var COPY = ["display", "flexDirection", "alignItems", "justifyContent", "gap", "padding", "fontFamily", "fontSize", "fontWeight", "letterSpacing", "lineHeight", "color", "borderRadius", "whiteSpace"];
    var calm = window.matchMedia("(prefers-reduced-motion: reduce)");
    var snapPage = window.matchMedia("(max-width: 620px), (min-width: 861px) and (min-height: 700px)");   /* the cover is a page of its own */
    var isOn = false, flyers = [], raf = 0, tick = false, lastY = null;
    function cells() { return [].slice.call((getComputedStyle(dock).display !== "none" ? dock : bar).children); }
    function iconRects(els) { return els.map(function (el) { return (el.querySelector("svg") || el).getBoundingClientRect(); }); }
    function clearFly() { cancelAnimationFrame(raf); flyers.forEach(function (f) { if (f.el.parentNode) f.el.parentNode.removeChild(f.el); }); flyers = []; }
    function seen(r) { return r.bottom > 0 && r.top < window.innerHeight && r.width > 0; }
    function copyOf(a, i) {
      var cs = getComputedStyle(a), r = a.getBoundingClientRect(), el = a.cloneNode(true), labels = [];
      el.removeAttribute("href"); el.removeAttribute("aria-label"); el.setAttribute("aria-hidden", "true"); el.className = "dock-flyer";
      COPY.forEach(function (k) { el.style[k] = cs[k]; });
      el.style.width = r.width + "px"; el.style.height = r.height + "px";
      [].slice.call(el.childNodes).forEach(function (n) {
        if (n.nodeType === 3) { var t = n.nodeValue.trim(); if (!t) { el.removeChild(n); return; } var sp = document.createElement("span"); sp.textContent = t; el.replaceChild(sp, n); labels.push(sp); }
        else if (n.nodeType === 1 && n.tagName.toLowerCase() !== "svg") labels.push(n);
      });
      var bg = document.createElement("i"); bg.className = "dock-flyer-bg"; bg.style.background = cs.backgroundColor; bg.style.boxShadow = cs.boxShadow;
      el.insertBefore(bg, el.firstChild);
      var g = el.querySelector("svg");
      if (g && icons[i]) { var gs = getComputedStyle(icons[i]); g.style.width = gs.width; g.style.height = gs.height; g.style.flex = "none"; }
      document.body.appendChild(el);
      return { el: el, bg: bg, g: g, labels: labels };
    }
    function finish(on) { clearFly(); still(function () { root.classList.remove("dock-fly"); row.classList.toggle("is-docked", on); }); }
    /* Motion = a spring-mass-damper per button: m'' = -W^2 (m - goal) - 2 Z W m'. m is 0 at home, 1 in the dock.
       Slightly under-damped (Z < 1), so a button arrives fast, runs a hair past its place and settles. Because
       position and velocity are kept, turning round in mid-flight just moves the goal: nothing ever jumps. */
    var W = 17, Z = 0.82, GAP = 0.03, there = [], goal = 0, tPrev = 0;
    function place(f, i) {
      var m = f.m, sb = srcs[i].getBoundingClientRect(), si = (icons[i] || srcs[i]).getBoundingClientRect(), d = there[i];
      var x = (d.left + d.width / 2 - si.left - si.width / 2) * m, y = (d.top + d.height / 2 - si.top - si.height / 2) * m;
      f.el.style.transform = "translate3d(" + (sb.left + x) + "px," + (sb.top + y) + "px,0)";
      if (f.g) f.g.style.transform = "scale(" + Math.max(0.2, 1 + (d.width / Math.max(1, si.width) - 1) * m) + ")";
      var o = Math.max(0, Math.min(1, 1 - m * 1.25));
      f.bg.style.opacity = o; f.labels.forEach(function (l) { l.style.opacity = o; });
    }
    function frame(now) {
      var dt = Math.min(0.05, (now - tPrev) / 1000); tPrev = now;
      var rest = true;
      flyers.forEach(function (f, i) {
        if (f.wait > 0) { f.wait -= dt; rest = false; }
        else {
          for (var left = dt; left > 1e-6; left -= 1 / 240) {            /* fixed small steps keep the spring stable */
            var h = Math.min(left, 1 / 240);
            f.v += (-W * W * (f.m - goal) - 2 * Z * W * f.v) * h; f.m += f.v * h;
          }
          if (Math.abs(f.m - goal) > 0.002 || Math.abs(f.v) > 0.03) rest = false; else { f.m = goal; f.v = 0; }
        }
        place(f, i);
      });
      if (rest) finish(goal === 1); else raf = requestAnimationFrame(frame);
    }
    function set(on) {
      isOn = on; goal = on ? 1 : 0;
      var tg = cells(), flying = flyers.length > 0;
      if (on) {
        root.classList.add("dock-still"); root.classList.add("dock-on"); there = iconRects(tg);            /* where the dock will be, measured without motion */
        root.classList.remove("dock-on"); void dock.offsetWidth; root.classList.remove("dock-still"); void dock.offsetWidth;
        root.classList.add("dock-on");
      } else { if (!flying) there = iconRects(tg); root.classList.remove("dock-on"); }
      if (flying) return;                                                 /* already in the air: the springs simply pull the other way */
      if (calm.matches || tg.length !== srcs.length || !srcs.length || !seen(srcs[0].getBoundingClientRect()) || !there[0].width) { finish(on); return; }
      flyers = srcs.map(copyOf);
      flyers.forEach(function (f, i) { f.m = on ? 0 : 1; f.v = 0; f.wait = i * GAP; place(f, i); });
      root.classList.add("dock-fly"); row.classList.add("is-docked");
      tPrev = performance.now(); raf = requestAnimationFrame(frame);
    }
    function check() {
      tick = false;
      var y = window.scrollY || document.body.scrollTop || 0, top = row.getBoundingClientRect().top, snap = snapPage.matches;
      var dy = lastY === null ? 1 : y - lastY; lastY = y;
      if (!isOn) { if (snap ? (y > 40 && dy > 0) : (y > 12 && top < 100)) set(true); }
      /* going back up: as soon as the row is clear of the bar again, the buttons leave for home and meet it there */
      else if (y <= 12 || (snap ? (dy < 0 && top > 70 && y < window.innerHeight * 0.4) : top > 130)) set(false);
    }
    function ask() { if (!tick) { tick = true; requestAnimationFrame(check); } }
    document.addEventListener("scroll", ask, { passive: true, capture: true });
    window.addEventListener("resize", ask); window.addEventListener("load", ask);
    check();
  })();

  /* ---- Page rail: one clickable mark per page section, on the right edge (desktop).
     Home: one mark per full-height step. Every other page: one mark per titled section, plus "Top". ---- */
  (function () {
    var marksFor = [], home = [].slice.call(document.querySelectorAll(".step[data-step]"));
    var scroller = function () { return window.scrollY ? null : (document.body.scrollTop ? document.body : null); };
    var page = (location.pathname.split("/").pop() || "index.html").toLowerCase();
    if (["index.html", "publications.html", "projects.html", "news.html", "cv.html"].indexOf(page) < 0) return;   /* the personal site only, not the project pages */
    if (home.length) {
      home.forEach(function (st) { marksFor.push({ el: st, label: st.getAttribute("data-step") }); });
    } else {
      var textOf = function (h) { var t = ""; [].forEach.call(h.childNodes, function (n) { if (n.nodeType === 3) t += n.nodeValue; }); return t.replace(/\s+/g, " ").trim() || h.textContent.replace(/\s+/g, " ").trim(); };
      var shown = function (el) { return el.getClientRects().length && !el.closest(".modal, nav, footer, template"); };
      [].forEach.call(document.querySelectorAll("section"), function (sec) {
        if (!shown(sec) || (sec.parentElement && sec.parentElement.closest("section"))) return;
        var h = sec.querySelector(".section-title, h2"), label = h ? textOf(h) : "";
        if (!label && sec.id) label = sec.id.replace(/[-_]+/g, " ").replace(/^./, function (c) { return c.toUpperCase(); });
        if (label) marksFor.push({ el: sec, label: label });
      });
      /* a page that is one long section (the news timeline): mark its headings instead */
      if (marksFor.length < 2) {
        marksFor = [];
        [].forEach.call(document.querySelectorAll("h2"), function (h) { var label = shown(h) ? textOf(h) : ""; if (label) marksFor.push({ el: h, label: label }); });
      }
      /* a plain dated list (the projects page): one mark per year */
      if (marksFor.length < 2) {
        marksFor = []; var yearSeen = {};
        [].forEach.call(document.querySelectorAll(".proj-year"), function (y) {
          var t = y.textContent.trim(); if (!t || yearSeen[t] || !shown(y)) return; yearSeen[t] = 1;
          marksFor.push({ el: y.closest("article, li, .pub, .proj, a") || y, label: t });
        });
      }
      if (marksFor.length && marksFor[0].el.getBoundingClientRect().top + window.scrollY > window.innerHeight * 0.5) marksFor.unshift({ el: null, label: "Top" });
    }
    if (marksFor.length < 2) return;
    var rail = document.createElement("nav");
    rail.className = "rail" + (marksFor.length > 9 ? " rail-dense" : ""); rail.setAttribute("aria-label", "On this page");
    var marks = marksFor.map(function (m, i) {
      var b = document.createElement("button");
      b.type = "button"; b.style.setProperty("--i", i);
      var t = document.createElement("span"); t.textContent = m.label;
      b.appendChild(t); b.appendChild(document.createElement("i"));
      b.addEventListener("click", function () {
        if (touch.matches && !rail.classList.contains("open")) { openRail(); return; }     /* touch: the first tap shows the names */
        if (m.el) m.el.scrollIntoView({ behavior: "smooth", block: "start" });
        else (scroller() || window).scrollTo({ top: 0, behavior: "smooth" });
        b.blur(); closeRail();
      });
      rail.appendChild(b);
      return b;
    });
    document.body.appendChild(rail);
    var touch = window.matchMedia("(hover: none)"), shut = 0;
    function closeRail() { clearTimeout(shut); rail.classList.remove("open"); }
    function openRail() { rail.classList.add("open"); clearTimeout(shut); shut = setTimeout(closeRail, 4500); }
    document.addEventListener("pointerdown", function (e) { if (rail.classList.contains("open") && !rail.contains(e.target)) closeRail(); }, { passive: true });
    /* current = the last section whose top has passed the middle of the screen */
    var cur = -1, tick = false;
    function paint() {
      tick = false;
      var mid = window.innerHeight * 0.5, k = 0;
      marksFor.forEach(function (m, i) { if (m.el && m.el.getBoundingClientRect().top < mid) k = i; });
      /* at the very bottom the last mark wins, even if its section is too short to reach the middle */
      var sc = scroller() || document.documentElement, y = sc === document.body ? sc.scrollTop : window.scrollY;
      if (y > 40 && y + window.innerHeight >= sc.scrollHeight - 4) k = marksFor.length - 1;
      if (k === cur) return; cur = k;
      marks.forEach(function (b, i) { b.classList.toggle("is-on", i === k); if (i === k) b.setAttribute("aria-current", "true"); else b.removeAttribute("aria-current"); });
    }
    function ask() { if (!tick) { tick = true; requestAnimationFrame(paint); } }
    document.addEventListener("scroll", ask, { passive: true, capture: true });
    window.addEventListener("resize", ask); window.addEventListener("load", ask);
    paint();
  })();

  /* ---- "Scroll to continue": go to the next step ---- */
  [].forEach.call(document.querySelectorAll(".scroll-cue"), function (cue) {
    cue.addEventListener("click", function (e) {
      if (!window.matchMedia("(min-width: 621px)").matches) return;
      var here = cue.closest(".step"), next = here && here.nextElementSibling;
      while (next && !next.classList.contains("step")) next = next.nextElementSibling;
      if (next) { e.preventDefault(); next.scrollIntoView({ behavior: "smooth", block: "start" }); }
    });
  });

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
    var inRow = !!wrap.closest(".strip, .news-scroll");
    wrap.addEventListener("pointerup", function (e) {
      if (x0 === null) return;
      var dx = e.clientX - x0, dy = e.clientY - y0; x0 = y0 = null;
      if (inRow && e.pointerType === "touch") return;      /* inside a card row the finger scrolls the row; the arrows flip the photo */
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
    });
    if (!(inRow && window.matchMedia("(pointer: coarse)").matches)) wrap.style.touchAction = "pan-y";
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
    document.addEventListener("scroll", ask, { passive: true, capture: true });
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
