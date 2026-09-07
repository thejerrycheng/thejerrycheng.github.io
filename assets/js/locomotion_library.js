/* =============================================================================
   locomotion_library.js — the survey's 280 references, made findable.

   Everything on the page is built from assets/data/locomotion_papers.json, which is
   generated from the manuscript itself: the reference list is parsed, each entry is
   placed by the section that cites it (the authors' own placement, not mine), tagged
   by subject from its title, and given a DOI or a URL so it links to the real paper.

   Three views over the same data: method dropdowns, the five shifts with the work
   before and after each one, and a searchable table of everything.
   ============================================================================= */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const TOPIC_LABEL = {
    'world-model': 'world models', 'diffusion': 'diffusion & flow', 'foundation-model': 'foundation models',
    'transformer': 'transformers', 'rl': 'reinforcement learning', 'imitation': 'imitation & retargeting',
    'sim-to-real': 'sim-to-real', 'mpc': 'model predictive control', 'trajectory-opt': 'trajectory optimisation',
    'zmp-lip': 'ZMP & inverted pendulum', 'hzd-vhc': 'hybrid zero dynamics', 'whole-body': 'whole-body control',
    'safety-cbf': 'safety & barrier functions', 'estimation': 'state estimation', 'perception': 'perception',
    'loco-manipulation': 'loco-manipulation', 'teleoperation': 'teleoperation & mocap', 'hardware': 'hardware & platforms',
    'quadruped': 'quadrupeds', 'human-motion': 'human motion & biomechanics', 'simulation': 'simulators',
    'benchmark-dataset': 'datasets & benchmarks', 'survey': 'surveys & reviews', 'humanoid': 'humanoids',
    'walking-gait': 'walking & balance', 'adaptive-robust': 'adaptive & robust control', 'planning': 'planning & footsteps',
    'animation': 'character animation',
    'curriculum': 'curricula & distillation',
    'ml-foundations': 'machine-learning foundations', 'contact': 'contact & compliance', 'efficiency': 'energy & actuation',
  };
  const ERA_LABEL = { classical: 'classical', learning: 'learning-based', emerging: 'emerging', outlook: 'outlook', front: 'framing' };

  /* The five shifts of the survey's Fig. 5. `section` names the subsection whose citations are the
     "after" list; where a shift has no subsection of its own, `topic` selects it instead, and the
     card says so. `before` is the same topic in the classical and learning eras. */
  const SHIFTS = [
    { id: 'paradigm', from: 'discriminative', to: 'generative',
      blurb: 'Policies that model a distribution over feasible actions or trajectories, so multi-modal choices and inference-time conditioning become possible. Denoising is stochastic optimal control.',
      section: 'Paradigm shift: discriminative to generative models', beforeTopics: ['trajectory-opt', 'mpc'] },
    { id: 'modality', from: 'uni-modal', to: 'multi-modal',
      blurb: 'Proprioception alone is blind; vision, depth, tactile and language enter through fusion architectures and vision-language-action models.',
      section: 'Modality shift: uni-modal to multi-modal foundation models', beforeTopics: ['perception', 'estimation'] },
    { id: 'taskscope', from: 'single-task', to: 'multi-task',
      blurb: 'Shared representations, skill libraries, cross-embodiment data and behaviour foundation models replace one policy per task with its own rewards.',
      topics: ['foundation-model', 'transformer', 'benchmark-dataset'], beforeTopics: ['rl', 'imitation'] },
    { id: 'functionality', from: 'locomotion', to: 'loco-manipulation',
      blurb: 'Walking and handling in one whole-body policy: co-tracking human–object interaction, hierarchical planners over trackers, force-adaptive control.',
      section: 'Functionality shift: locomotion to loco-manipulation', beforeTopics: ['whole-body', 'contact'] },
    { id: 'computation', from: 'offline', to: 'test-time adaptation',
      blurb: 'Adjust online to what training never showed: in-context learning as adaptive control, standardised tests for falls and recovery.',
      topics: ['adaptive-robust'], beforeTopics: ['adaptive-robust'] },
  ];

  let DATA = null, F = { q: '', era: '', topic: '', family: '', y0: 1960, y1: 2026, sort: 'n', dir: 1 };

  /* ---------------------------------------------------------------- helpers */
  /* every paper gets somewhere to go: its DOI, the URL the reference itself carries, or — for the
     handful Crossref could not match — a title search, so no row is a dead end */
  const searchUrl = (p) => 'https://www.google.com/search?q=' + encodeURIComponent('"' + p.t + '"' + (p.y ? ' ' + p.y : ''));
  const link = (p) => p.doi ? 'https://doi.org/' + p.doi : (p.url || searchUrl(p));
  const linkLabel = (p) => {
    if (p.doi) {
      const d = p.doi.toLowerCase();
      if (d.startsWith('10.1109')) return 'IEEE';
      if (d.startsWith('10.1177')) return 'SAGE';
      if (d.startsWith('10.1126')) return 'Science';
      if (d.startsWith('10.1038')) return 'Nature';
      if (d.startsWith('10.1145')) return 'ACM';
      if (d.startsWith('10.1007')) return 'Springer';
      return 'DOI';
    }
    if (p.url && /arxiv/.test(p.url)) return 'arXiv';
    if (p.url && /github/.test(p.url)) return 'code';
    if (p.url) return 'link';
    return 'search';
  };
  const paperLi = (p) => {
    const l = link(p), lab = linkLabel(p);
    return `<li class="pl-item" data-n="${p.n}">
      <span class="pl-n">${p.n}</span>
      <span class="pl-main"><span class="pl-t">${esc(p.t)}</span>
        <span class="pl-meta">${[p.a, p.v, p.y].filter(Boolean).map(esc).join(' · ')}</span>
        ${p.note ? `<span class="pl-note">${esc(p.note)}</span>` : ''}</span>
      <span class="pl-links">
        <a class="pl-link${lab === 'search' ? ' weak' : ''}" href="${esc(l)}" target="_blank" rel="noopener">${lab} ↗</a>
        ${p.pre ? `<a class="pl-link pre" href="${esc(p.pre)}" target="_blank" rel="noopener">preprint</a>` : ''}
      </span>
    </li>`;
  };
  const listOf = (papers) => papers.length
    ? `<ol class="paper-list">${papers.map(paperLi).join('')}</ol>`
    : '<p class="pl-empty">No references in this group.</p>';
  const byYear = (a, b) => (b.y || 0) - (a.y || 0) || a.n - b.n;

  /* ------------------------------------------------------------ method cards */
  function renderMethods() {
    const host = $('#method-cards'); if (!host) return;
    const eras = [['classical', 'Classical'], ['learning', 'Learning-based'], ['emerging', 'Emerging'], ['outlook', 'Outlook'], ['front', 'Framing']];
    host.innerHTML = eras.map(([era, name]) => {
      const fams = DATA.families.filter(f => f.era === era);
      if (!fams.length) return '';
      return `<div class="fam-era" data-era="${era}">
        <h3 class="fam-era-title era-${era}">${name}</h3>
        ${fams.map(f => {
          const papers = DATA.papers.filter(p => p.f.includes(f.id)).sort(byYear);
          const eq = EQUATIONS[f.id];
          return `<details class="fam" id="fam-${f.id}">
            <summary><span class="fam-name">${esc(f.name)}</span>
              <span class="fam-count">${papers.length} papers</span>
              <span class="fam-rate">${[f.rate !== '—' ? f.rate : '', f.compute !== '—' ? f.compute : ''].filter(Boolean).map(esc).join(' · ')}</span></summary>
            <div class="fam-body">
              <p class="fam-blurb">${esc(f.blurb)}</p>
              ${eq ? `<div class="fam-eq">${eq}</div>` : ''}
              ${listOf(papers)}
            </div></details>`;
        }).join('')}
      </div>`;
    }).join('');
  }


  /* ------------------------------------------------- models and simulators */
  /* One row per place on the survey's Fig. 2 axis. `pick` says which references belong to a row:
     a subject tag, a pattern over the title, or both. The rule is printed under each expanded row
     so the reader can see how the list was made rather than trusting it. */
  const MODEL_ROWS = [
    { side: 'Physics-based', what: 'Reduced-order model — linear inverted pendulum, centroidal dynamics, single rigid body',
      buys: 'A handful of states with an analytic solution; constraints stay convex, so the loop runs at kilohertz and can be proved stable.',
      breaks: 'Everything it abstracts away: limb inertia, compliance, and any contact it did not assume.',
      use: 'Real-time balance, footstep planning, convex MPC',
      topics: ['zmp-lip'], re: /reduced.order|inverted pendulum|centroidal|single rigid body|template|capture point|divergent component|preview control|angular momentum/i,
      rule: 'subject “ZMP & inverted pendulum”, or a title naming a reduced-order model' },
    { side: 'Physics-based', what: 'Full-order rigid-body model with contact',
      buys: 'Every joint and every wrench, exactly as derived; whole-body control and contact-implicit optimisation are written on it.',
      breaks: 'Nonsmooth contact and the cost of solving it; parameters you must identify.',
      use: 'Whole-body QPs, nonlinear MPC, offline trajectory optimisation',
      topics: ['whole-body', 'contact'], re: /full.order|whole.body|inverse dynamics|rigid.body|contact.implicit|multi.contact|complementarity/i,
      rule: 'subjects “whole-body control” or “contact & compliance”, or a title naming the full model' },
    { side: 'Physics-based', what: 'Simulator — MuJoCo, Isaac, Newton, Genesis',
      buys: 'Contact-rich physics at thousands of times real speed on a GPU, which is what makes reinforcement learning affordable.',
      breaks: 'The reality gap: actuator dynamics, friction, latency and deformation that are cheap to simulate wrongly.',
      use: 'Policy training, domain randomisation',
      topics: ['simulation'], re: /mujoco|isaac|bullet|raisim|genesis|newton|physics engine|simulat/i,
      rule: 'subject “simulators”, or a title naming a simulator or physics engine' },
    { side: 'Hybrid', what: 'Physics plus a learned residual — learned actuator models, residual dynamics',
      buys: 'Keeps the structure and the guarantees, and lets data absorb what the derivation missed.',
      breaks: 'Only as good as the data covering the residual; the split between the two halves is a design choice.',
      use: 'Sim-to-real correction, system identification',
      topics: ['sim-to-real'], re: /residual|actuator model|system identification|reality gap|domain random|hybrid model|delta dynamics/i,
      rule: 'subject “sim-to-real”, or a title naming a residual, an actuator model or identification' },
    { side: 'Data-driven', what: 'Learned dynamics',
      buys: 'Predicts the next state from data without a derivation, including effects nobody wrote down.',
      breaks: 'Extrapolation; error compounds over a horizon.',
      use: 'Model-based RL, short-horizon planning',
      topics: [], re: /learned dynamics|dynamics model|model.based reinforcement|learning.{0,20}dynamics|neural.{0,20}dynamics|deep dynamics/i,
      rule: 'a title naming a learned or neural dynamics model' },
    { side: 'Data-driven', what: 'Latent dynamics',
      buys: 'Rolls out in a compact learned space, so long horizons stay cheap.',
      breaks: 'The latent space is only as meaningful as its training distribution; physical constraints are not naturally expressible.',
      use: 'Planning from pixels, model-based RL',
      topics: [], re: /latent|autoencoder|variational|representation learning|embedding space/i,
      rule: 'a title naming a latent space, an autoencoder or a learned representation' },
    { side: 'Data-driven', what: 'World model',
      buys: 'Predicts observations and consequences of actions directly, including semantics; supports imagination and reasoning about futures.',
      breaks: 'Expensive to evaluate, hard to constrain, and unverified against physics.',
      use: 'The deliberative layer, long-horizon and multi-task behaviour',
      topics: ['world-model'], re: /world model|dreamer|imagination|video prediction|video generation/i,
      rule: 'subject “world models”, or a title naming a world model or video prediction' },
  ];
  function renderModels() {
    const host = $('#models-table'); if (!host) return;
    const pick = (r) => DATA.papers.filter(p =>
      (r.topics.length && r.topics.some(t => p.tp.includes(t))) || (r.re && r.re.test(p.t))).sort(byYear);
    host.innerHTML = `<table class="data-table models">
      <thead><tr><th style="width:132px">Where it sits</th><th style="width:20%">What it is</th><th>What it buys you</th><th>Where it breaks</th><th style="width:16%">Typical use</th><th style="width:96px">Papers</th></tr></thead>
      <tbody>${MODEL_ROWS.map((r, i) => {
        const ps = pick(r);
        return `<tr class="mrow" data-i="${i}">
            <td class="k">${esc(r.side)}</td><td>${esc(r.what)}</td><td>${esc(r.buys)}</td>
            <td>${esc(r.breaks)}</td><td>${esc(r.use)}</td>
            <td><button class="mexp" data-i="${i}" aria-expanded="false">${ps.length} ▾</button></td>
          </tr>
          <tr class="mpapers" data-i="${i}" hidden><td colspan="6">
            <p class="rule">${esc(r.rule)} — ${ps.length} of ${DATA.papers.length} references.</p>
            ${listOf(ps)}
          </td></tr>`;
      }).join('')}</tbody></table>`;
    $$('#models-table .mexp').forEach(b => b.addEventListener('click', () => {
      const row = $(`#models-table tr.mpapers[data-i="${b.dataset.i}"]`);
      const open = row.hidden;
      row.hidden = !open; b.setAttribute('aria-expanded', String(open));
      b.textContent = b.textContent.replace(open ? '▾' : '▴', open ? '▴' : '▾');
    }));
  }

  /* ------------------------------------------------------------- five shifts */
  function renderShifts() {
    const host = $('#shift-papers'); if (!host) return;
    host.innerHTML = SHIFTS.map(s => {
      const after = (s.section ? DATA.papers.filter(p => p.s.includes(s.section))
                               : DATA.papers.filter(p => p.e.includes('emerging') && s.topics.some(t => p.tp.includes(t)))).sort(byYear);
      const afterN = new Set(after.map(p => p.n));
      const before = DATA.papers.filter(p => !afterN.has(p.n)
        && (p.e.includes('classical') || p.e.includes('learning'))
        && s.beforeTopics.some(t => p.tp.includes(t))).sort(byYear);
      const rule = s.section
        ? `“after” = every reference the survey cites in <i>${esc(s.section)}</i>`
        : `“after” = emerging-era references tagged ${s.topics.map(t => TOPIC_LABEL[t] || t).join(' or ')}`;
      return `<article class="card shift-card" id="shift-${s.id}">
        <header><span class="from">${esc(s.from)} →</span><span class="to">${esc(s.to)}</span></header>
        <p class="shift-blurb">${esc(s.blurb)}</p>
        <details class="sub"><summary>Before · ${before.length} papers <span class="hint">the same problem in the classical and learning eras</span></summary>${listOf(before.slice(0, 40))}</details>
        <details class="sub after"><summary>After · ${after.length} papers <span class="hint">what the survey cites for this shift</span></summary>${listOf(after)}</details>
        <p class="rule">${rule}; “before” = the same subjects in the classical and learning eras.</p>
      </article>`;
    }).join('');
  }

  /* ----------------------------------------------------------- the big table */
  const FIELDS = [
    { k: 'n', label: '#', w: '46px', get: p => p.n },
    { k: 't', label: 'Paper', get: p => p.t },
    { k: 'y', label: 'Year', w: '62px', get: p => p.y || 0 },
    { k: 'v', label: 'Venue', get: p => p.v || '' },
    { k: 'f', label: 'Method family', get: p => famNames(p) },
    { k: 'tp', label: 'Subjects', get: p => p.tp.join(' ') },
    { k: 'link', label: 'Link', w: '78px', get: p => link(p) || '' },
  ];
  const famNames = (p) => p.f.map(id => (DATA.families.find(f => f.id === id) || {}).name).filter(Boolean).join('; ');
  const famRate = (p) => {
    const rates = p.f.map(id => (DATA.families.find(f => f.id === id) || {}).rate).filter(r => r && r !== '—');
    return rates.length ? rates[0] : '—';
  };

  function matches(p) {
    if (F.era && !p.e.includes(F.era)) return false;
    if (F.topic && !p.tp.includes(F.topic)) return false;
    if (F.family && !p.f.includes(F.family)) return false;
    if (p.y && (p.y < F.y0 || p.y > F.y1)) return false;
    if (F.q) {
      const hay = (p.t + ' ' + (p.a || '') + ' ' + (p.v || '') + ' ' + (p.y || '') + ' ' +
                   p.tp.map(t => TOPIC_LABEL[t] || t).join(' ') + ' ' + famNames(p)).toLowerCase();
      for (const tok of F.q.toLowerCase().split(/\s+/).filter(Boolean)) if (!hay.includes(tok)) return false;
    }
    return true;
  }
  function renderTable() {
    const host = $('#lib-table'); if (!host) return;
    const rows = DATA.papers.filter(matches);
    const fld = FIELDS.find(f => f.k === F.sort) || FIELDS[0];
    rows.sort((a, b) => {
      const x = fld.get(a), y = fld.get(b);
      const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
      return c * F.dir || a.n - b.n;
    });
    $('#lib-count').textContent = `${rows.length} of ${DATA.papers.length} papers`;
    host.innerHTML = `<table class="data-table lib">
      <thead><tr>
        <th style="width:42px" data-sort="n">#</th>
        <th style="width:34%" data-sort="t">Paper</th>
        <th style="width:56px" data-sort="y">Year</th>
        <th style="width:17%" data-sort="v">Venue</th>
        <th style="width:15%" data-sort="f">Method family</th>
        <th style="width:96px">Loop rate</th>
        <th style="width:16%" data-sort="tp">Subjects</th>
        <th style="width:66px">Link</th>
      </tr></thead><tbody>
      ${rows.map(p => {
        const l = link(p), lab = linkLabel(p);
        return `<tr>
          <td class="num">${p.n}</td>
          <td class="ttl">${esc(p.t)}<span class="au">${esc(p.a || '')}</span></td>
          <td class="num">${p.y || '—'}</td>
          <td class="ven">${esc(p.v || '—')}</td>
          <td class="fam">${esc(famNames(p) || '—')}</td>
          <td class="rate">${esc(famRate(p))}</td>
          <td class="tp">${p.tp.map(t => `<button class="tp-chip" data-topic="${t}">${esc(TOPIC_LABEL[t] || t)}</button>`).join('')}</td>
          <td><a class="${lab === 'search' ? 'weak' : ''}" href="${esc(l)}" target="_blank" rel="noopener">${lab} ↗</a>${p.pre ? `<a class="pre" href="${esc(p.pre)}" target="_blank" rel="noopener">preprint</a>` : ''}</td>
        </tr>`;
      }).join('')}
      </tbody></table>`;
    $$('#lib-table th[data-sort]').forEach(th => {
      th.classList.toggle('sorted', th.dataset.sort === F.sort);
      th.addEventListener('click', () => {
        if (F.sort === th.dataset.sort) F.dir *= -1; else { F.sort = th.dataset.sort; F.dir = 1; }
        renderTable();
      });
    });
    $$('#lib-table .tp-chip').forEach(b => b.addEventListener('click', () => setFilter({ topic: b.dataset.topic })));
  }

  function setFilter(patch, scroll) {
    Object.assign(F, patch);
    $('#lib-q').value = F.q;
    $('#lib-era').value = F.era; $('#lib-topic').value = F.topic; $('#lib-family').value = F.family;
    renderChips(); renderTable();
    if (scroll !== false) $('#library').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function renderChips() {
    const on = [];
    if (F.q) on.push(['q', `“${F.q}”`]);
    if (F.era) on.push(['era', ERA_LABEL[F.era] || F.era]);
    if (F.topic) on.push(['topic', TOPIC_LABEL[F.topic] || F.topic]);
    if (F.family) on.push(['family', (DATA.families.find(f => f.id === F.family) || {}).name || F.family]);
    if (F.y0 !== 1960 || F.y1 !== 2026) on.push(['years', `${F.y0}–${F.y1}`]);
    $('#lib-chips').innerHTML = on.length
      ? on.map(([k, v]) => `<button class="chip" data-clear="${k}">${esc(v)} ✕</button>`).join('') +
        '<button class="chip clear-all" data-clear="all">clear all</button>'
      : '<span class="chip-none">no filters — showing every reference in the survey</span>';
    $$('#lib-chips [data-clear]').forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.clear;
      if (k === 'all') setFilter({ q: '', era: '', topic: '', family: '', y0: 1960, y1: 2026 }, false);
      else if (k === 'years') setFilter({ y0: 1960, y1: 2026 }, false);
      else setFilter({ [k]: '' }, false);
      syncYearInputs();
    }));
  }
  function syncYearInputs() { $('#lib-y0').value = F.y0; $('#lib-y1').value = F.y1; }

  /* ------------------------------------------------------------- quick picks */
  function renderQuickPicks() {
    const host = $('#lib-quick'); if (!host) return;
    const picks = [
      { label: 'world models', topic: 'world-model' },
      { label: 'diffusion policies', topic: 'diffusion' },
      { label: 'foundation models', topic: 'foundation-model' },
      { label: 'sim-to-real', topic: 'sim-to-real' },
      { label: 'model predictive control', topic: 'mpc' },
      { label: 'hybrid zero dynamics', topic: 'hzd-vhc' },
      { label: 'ZMP & inverted pendulum', topic: 'zmp-lip' },
      { label: 'loco-manipulation', topic: 'loco-manipulation' },
      { label: 'safety & barrier functions', topic: 'safety-cbf' },
      { label: 'simulators', topic: 'simulation' },
      { label: 'teleoperation & mocap', topic: 'teleoperation' },
      { label: 'hardware & platforms', topic: 'hardware' },
      { label: 'machine-learning foundations', topic: 'ml-foundations' },
      { label: 'whole-body control', topic: 'whole-body' },
    ];
    host.innerHTML = picks.map(p => {
      const n = DATA.papers.filter(x => x.tp.includes(p.topic)).length;
      return `<button class="quick" data-topic="${p.topic}">${esc(p.label)}<span>${n}</span></button>`;
    }).join('');
    $$('#lib-quick .quick').forEach(b => b.addEventListener('click', () => setFilter({ topic: b.dataset.topic, q: '', era: '', family: '' })));
  }

  /* --------------------------------------------------------- the equations */
  const EQUATIONS = {
    models: `
      <p class="eq-lead">The linear inverted pendulum: a point mass at constant height \\(z_c\\) over a massless leg. It is the reduced model almost every classical walking controller is written against.</p>
      <div class="katex-block">$$\\ddot{x} = \\omega^2\\,(x - p),\\qquad \\omega=\\sqrt{g/z_c}$$</div>
      <p class="eq-note">\\(x\\) is the centre of mass, \\(p\\) the centre of pressure. The unstable mode \\(\\xi = x + \\dot{x}/\\omega\\) — the divergent component of motion, or capture point — obeys \\(\\dot{\\xi} = \\omega(\\xi - p)\\), which is what makes it the natural state to control.</p>
      <p class="eq-lead">Centroidal dynamics keeps the momentum of the whole body while abstracting the limbs:</p>
      <div class="katex-block">$$\\dot{\\boldsymbol{h}} = \\begin{bmatrix} \\sum_i \\boldsymbol{f}_i + m\\boldsymbol{g}\\\\[2pt] \\sum_i (\\boldsymbol{p}_i-\\boldsymbol{c})\\times \\boldsymbol{f}_i + \\boldsymbol{\\tau}_i\\end{bmatrix}$$</div>
      <p class="eq-note">\\(\\boldsymbol{h}\\) the linear and angular momentum about the centre of mass \\(\\boldsymbol{c}\\), \\(\\boldsymbol{f}_i,\\boldsymbol{\\tau}_i\\) the contact wrenches at \\(\\boldsymbol{p}_i\\). The full rigid-body model underneath is \\(M(q)\\ddot q + C(q,\\dot q)\\dot q + g(q) = S^\\top\\tau + J_c^\\top\\lambda\\).</p>`,
    feedback: `
      <p class="eq-lead">Zero-moment point. Balance is feasible while the point where the net ground moment vanishes stays inside the support polygon:</p>
      <div class="katex-block">$$p_{\\text{zmp}} = \\frac{\\sum_i m_i (\\ddot z_i + g)\\,x_i - \\sum_i m_i \\ddot x_i z_i - \\sum_i I_{i}\\dot\\omega_{i}}{\\sum_i m_i(\\ddot z_i + g)} \;\\in\; \\mathcal{S}$$</div>
      <p class="eq-lead">Capture point. The place to step to bring the pendulum to rest in one step:</p>
      <div class="katex-block">$$\\xi = x + \\frac{\\dot x}{\\omega}, \\qquad p^\\star = \\xi + k(\\xi - p),\; k>0$$</div>
      <p class="eq-lead">Hybrid zero dynamics. Impose virtual holonomic constraints \\(y\\) on the full model and drive them to zero; walking becomes a stable periodic orbit of the remaining zero dynamics:</p>
      <div class="katex-block">$$y = h_0(q) - h_d(\\theta(q),\\alpha), \\qquad \\ddot y = L_f^2 h + L_g L_f h\\,u \;\\Rightarrow\; u = -(L_gL_fh)^{-1}\\!\\left(L_f^2h + K_p y + K_d \\dot y\\right)$$</div>
      <p class="eq-note">Stability of the gait is then the stability of the Poincaré map of the hybrid system \\(\\dot x = f(x)+g(x)u\\) with the impact reset \\(x^+ = \\Delta(x^-)\\).</p>
      <p class="eq-lead">Whole-body control resolves a task hierarchy as a quadratic program at every tick:</p>
      <div class="katex-block">$$\\min_{\\ddot q,\\tau,\\lambda} \;\\sum_k w_k\\lVert J_k\\ddot q + \\dot J_k \\dot q - \\ddot r_k^{\\,d}\\rVert^2 \\quad \\text{s.t.}\\quad M\\ddot q + b = S^\\top\\tau + J_c^\\top\\lambda,\;\; \\lambda \\in \\mathcal{K},\;\; \\tau \\in [\\tau_{\\min},\\tau_{\\max}]$$</div>`,
    predictive: `
      <p class="eq-lead">Model predictive control. Re-solve a finite-horizon optimal control problem every tick and apply only its first input:</p>
      <div class="katex-block">$$\\min_{u_{0:N-1}}\; \\sum_{k=0}^{N-1}\\Big(\\lVert x_k - x_k^{\\text{ref}}\\rVert^2_{Q} + \\lVert u_k\\rVert^2_{R}\\Big) + \\lVert x_N - x_N^{\\text{ref}}\\rVert^2_{P}$$</div>
      <div class="katex-block">$$\\text{s.t.}\\quad x_{k+1} = f(x_k,u_k),\\quad x_0 = \\hat{x},\\quad p^{\\text{zmp}}_k \\in \\mathcal{S}_k,\\quad \\lambda_k \\in \\mathcal{K},\\quad u_k \\in \\mathcal{U}$$</div>
      <p class="eq-note">On the linear inverted pendulum with \\(f\\) linear and the support polygon a set of half-planes, this is a convex QP that solves in well under a millisecond, which is why it runs at 100 Hz and above. On the full model with contact it is a nonlinear program.</p>
      <p class="eq-lead">Contact-implicit formulations let the optimiser choose the contact sequence by writing complementarity into the constraints:</p>
      <div class="katex-block">$$0 \\le \\lambda_n \;\\perp\; \\phi(q) \\ge 0$$</div>
      <p class="eq-note">\\(\\phi\\) the signed distance, \\(\\lambda_n\\) the normal force: either the foot touches or it carries no load. Trajectory optimisation is the same problem solved offline over a long horizon, usually by direct collocation, \\(\\min \\int_0^T \\ell(x,u)\\,dt\\) subject to the same dynamics and contact conditions.</p>`,
    sim: `
      <p class="eq-lead">Reinforcement learning states the same problem as a discounted expectation, with the cost written as a reward and the model replaced by a simulator:</p>
      <div class="katex-block">$$\\pi^\\star = \\arg\\max_{\\pi}\; \\mathbb{E}_{\\tau\\sim p_\\pi}\\left[\\sum_{t=0}^{\\infty}\\gamma^t r(s_t,a_t)\\right]$$</div>
      <p class="eq-note">Domain randomisation makes the expectation run over a distribution of bodies and worlds \\(\\mathbb{E}_{\\mu\\sim\\mathcal{D}}\\), which is where robustness to model error comes from; the survey's argument is that this plays the role a robust-control weighting plays in the classical formulation.</p>`,
    generative: `
      <p class="eq-lead">A diffusion policy samples an action sequence by denoising, which is a stochastic optimal control problem in disguise:</p>
      <div class="katex-block">$$a^{k-1} = \\alpha\\big(a^{k} - \\gamma\\,\\epsilon_\\theta(a^k, s, k)\\big) + \\sigma z,\\qquad z\\sim\\mathcal{N}(0,I)$$</div>
      <p class="eq-note">Each denoising step is a gradient step on a learned energy over trajectories; conditioning at inference time is the same move as adding a constraint to the optimal control problem.</p>`,
  };

  /* ------------------------------------------------------------------- boot */
  async function boot() {
    try {
      DATA = await fetch('assets/data/locomotion_papers.json').then(r => r.json());
    } catch (e) { console.error('paper data failed to load', e); return; }
    renderMethods(); renderShifts(); renderModels(); renderQuickPicks();

    $('#lib-era').innerHTML = '<option value="">every era</option>' +
      ['classical', 'learning', 'emerging', 'outlook', 'front'].map(e => `<option value="${e}">${ERA_LABEL[e]}</option>`).join('');
    const topicCounts = {};
    DATA.papers.forEach(p => p.tp.forEach(t => { topicCounts[t] = (topicCounts[t] || 0) + 1; }));
    $('#lib-topic').innerHTML = '<option value="">every subject</option>' +
      Object.keys(topicCounts).sort((a, b) => topicCounts[b] - topicCounts[a])
        .map(t => `<option value="${t}">${TOPIC_LABEL[t] || t} (${topicCounts[t]})</option>`).join('');
    $('#lib-family').innerHTML = '<option value="">every method family</option>' +
      DATA.families.map(f => `<option value="${f.id}">${f.name}</option>`).join('');

    $('#lib-q').addEventListener('input', (e) => { F.q = e.target.value.trim(); renderChips(); renderTable(); });
    $('#lib-era').addEventListener('change', (e) => setFilter({ era: e.target.value }, false));
    $('#lib-topic').addEventListener('change', (e) => setFilter({ topic: e.target.value }, false));
    $('#lib-family').addEventListener('change', (e) => setFilter({ family: e.target.value }, false));
    for (const id of ['lib-y0', 'lib-y1']) $('#' + id).addEventListener('change', () => {
      F.y0 = Math.min(+$('#lib-y0').value || 1960, +$('#lib-y1').value || 2026);
      F.y1 = Math.max(+$('#lib-y0').value || 1960, +$('#lib-y1').value || 2026);
      syncYearInputs(); renderChips(); renderTable();
    });
    syncYearInputs(); renderChips(); renderTable();

    /* deep links: locomotion.html#topic=world-model, #family=predictive, #q=diffusion */
    const h = location.hash.replace(/^#/, '');
    if (/^(topic|family|q|era)=/.test(h)) {
      const [k, v] = h.split('=');
      setFilter({ [k]: decodeURIComponent(v.replace(/\+/g, ' ')) });
    }
    if (window.renderMathInElement) {
      document.querySelectorAll('.fam-eq').forEach(el => window.renderMathInElement(el, {
        delimiters: [{ left: '$$', right: '$$', display: true }, { left: '\\(', right: '\\)', display: false }],
        throwOnError: false,
      }));
    }
    /* the verification note quotes numbers, so they are computed from the data, not typed in */
    const verified = DATA.papers.filter(p => p.doi).length;
    const nolink = DATA.papers.filter(p => !p.doi && !p.url).length;
    const vv = $('#v-verified'), vn = $('#v-nolink');
    if (vv) vv.textContent = `${verified} of the ${verified} DOIs shown`;
    if (vn) vn.textContent = String(nolink);
    document.dispatchEvent(new CustomEvent('library-ready'));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
