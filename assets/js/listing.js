/* Publications and Projects pages: a filter bar that re-flows the list, a lead entry, and
   (publications) citation counts from Google Scholar (assets/data/citations.json, refreshed daily). */
(function () {
  "use strict";
  var page = (location.pathname.split("/").pop() || "").toLowerCase();
  var isPubs = page === "publications.html", isProj = page === "projects.html";
  if (!isPubs && !isProj) return;
  var list = document.querySelector(isPubs ? "#publications .pub-list" : "#projects .pub-list");
  if (!list) return;
  var root = document.documentElement;
  var rows = [].filter.call(list.children, function (el) { return el.classList.contains("pub"); });
  var calm = window.matchMedia("(prefers-reduced-motion: reduce)");
  list.classList.add(isPubs ? "lt-rows" : "lt-grid");

  /* ---- what can be filtered ---- */
  var GROUPS = [["Learning", /learning|manipulation|sim/i], ["Perception", /perception|slam|estimation/i], ["Hardware", /mechatronic|embedded|mechanical/i]];
  function groupOf(r) { var t = r.getAttribute("data-tag") || ""; for (var i = 0; i < GROUPS.length; i++) if (GROUPS[i][1].test(t)) return GROUPS[i][0]; return "Other"; }
  var filters = [["all", "All", function () { return true; }]];
  if (isPubs) {
    filters.push(["first", "First author", function (r) { return r.hasAttribute("data-first"); }]);
    filters.push(["co", "Co-author", function (r) { return !r.hasAttribute("data-first"); }]);
  } else {
    GROUPS.map(function (g) { return g[0]; }).concat(["Other"]).forEach(function (name) {
      if (rows.some(function (r) { return groupOf(r) === name; })) filters.push([name.toLowerCase(), name, function (r) { return groupOf(r) === name; }]);
    });
  }
  var sorts = isPubs ? [["new", "Newest"], ["cited", "Most cited"]] : [];
  var state = { filter: "all", sort: "new" }, counts = {};

  /* ---- the bar: segmented controls with a highlight that slides between the choices ---- */
  function segment(items, key, label) {
    var seg = document.createElement("div"); seg.className = "lt-seg"; seg.setAttribute("role", "group"); seg.setAttribute("aria-label", label);
    var blob = document.createElement("span"); blob.className = "lt-blob"; seg.appendChild(blob);
    var btns = items.map(function (it) {
      var b = document.createElement("button"); b.type = "button"; b.textContent = it[1]; b.setAttribute("aria-pressed", String(state[key] === it[0]));
      b.addEventListener("click", function () { if (state[key] === it[0]) return; state[key] = it[0]; mark(); apply(true); });
      seg.appendChild(b); return b;
    });
    function mark() {
      btns.forEach(function (b, i) {
        var on = items[i][0] === state[key]; b.setAttribute("aria-pressed", String(on));
        if (on) { blob.style.width = b.offsetWidth + "px"; blob.style.transform = "translateX(" + b.offsetLeft + "px)"; }
      });
    }
    seg._mark = mark; return seg;
  }
  var bar = document.createElement("div"); bar.className = "lt-bar";
  var segs = [segment(filters, "filter", "Show")];
  if (sorts.length) segs.push(segment(sorts, "sort", "Order"));
  segs.forEach(function (s) { bar.appendChild(s); });
  var tally = document.createElement("span"); tally.className = "lt-count"; tally.setAttribute("aria-live", "polite"); bar.appendChild(tally);
  list.parentNode.insertBefore(bar, list);
  function markAll() { segs.forEach(function (s) { s._mark(); }); }
  markAll(); window.addEventListener("resize", markAll); window.addEventListener("load", markAll);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(markAll);

  /* ---- apply filter + order; the cards glide to their new places (View Transitions) ---- */
  function layout() {
    var pass = filters.filter(function (f) { return f[0] === state.filter; })[0][2];
    var order = rows.slice();
    if (state.sort === "cited") order.sort(function (a, b) { return (counts[b.id] || 0) - (counts[a.id] || 0) || rows.indexOf(a) - rows.indexOf(b); });
    var shown = 0, lead = null;
    order.forEach(function (r) {
      var ok = pass(r); r.hidden = !ok; r.classList.remove("is-lead");
      if (ok) { shown++; if (!lead) lead = r; }
      list.appendChild(r);
    });
    if (lead) lead.classList.add("is-lead");
    tally.textContent = shown === rows.length ? rows.length + (isPubs ? " papers" : " projects") : shown + " of " + rows.length;
    root.classList.toggle("rail-off", isProj && state.filter !== "all");     /* the year marks only make sense on the full list */
  }
  function apply(animate) {
    if (!animate || calm.matches || !document.startViewTransition) { layout(); return; }
    rows.forEach(function (r) { r.style.viewTransitionName = "lt-" + r.id; });
    var vt = document.startViewTransition(layout);
    vt.finished.then(function () { rows.forEach(function (r) { r.style.viewTransitionName = ""; }); }, function () {});
  }
  apply(false);

  /* ---- header line ---- */
  var cover = document.querySelector(".page-cover .wrap"), stat = null;
  if (cover) {
    stat = document.createElement("p"); stat.className = "lt-stat";
    var ys = rows.map(function (r) { return +r.getAttribute("data-year"); }).filter(Boolean);
    stat.textContent = rows.length + (isPubs ? " papers" : " projects") + (ys.length ? " · " + Math.min.apply(null, ys) + "–" + Math.max.apply(null, ys) : "");
    cover.appendChild(stat);
  }
  if (!isPubs) return;

  /* ---- citations: Google Scholar numbers, refreshed daily into assets/data/citations.json (Scholar cannot be asked from a browser) ---- */
  var papers = {}, profile = "";
  function countUp(el, to) {
    var from = +el.getAttribute("data-n") || 0; el.setAttribute("data-n", to);
    if (calm.matches || from === to) { el.textContent = to; return; }
    var t0 = performance.now(), D = 700;
    (function step(now) { var t = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - t, 3); el.textContent = Math.round(from + (to - from) * e); if (t < 1) requestAnimationFrame(step); })(t0);
  }
  function paint(id, n) { counts[id] = n; }             /* per-paper numbers only feed the "Most cited" order; the page shows the total alone */
  fetch("assets/data/citations.json", { cache: "no-cache" }).then(function (r) { return r.json(); }).then(function (j) {
    papers = j.papers || {}; profile = j.profile || "";
    Object.keys(papers).forEach(function (id) { paint(id, papers[id].count); });
    if (stat && j.total) {
      var day = new Date(j.updated + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
      stat.insertAdjacentHTML("beforeend", ' · <a class="lt-cites" target="_blank" rel="noopener" title="Google Scholar profile"><b class="lt-n">0</b> citations</a> <span class="lt-src is-live">Google Scholar, ' + day + "</span>");
      stat.querySelector(".lt-cites").href = profile;
      countUp(stat.querySelector(".lt-n"), j.total);
    }
    if (state.sort === "cited") apply(true);
    try { localStorage.removeItem("cites-v2"); } catch (e) {}
  }).catch(function () {});
})();
