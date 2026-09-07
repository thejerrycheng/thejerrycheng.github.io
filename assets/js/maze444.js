/* maze444.js — the MIE444 maze and the belief-set localizer, ported one-for-one
   from scripts/tools/mie444_localize.py so the page and the harness agree.

   World bits: 1 = north, 2 = west, 4 = south, 8 = east. 15 = blocked.
   A robot reads its own tile's walls in its own frame, so a reading is the
   world code cyclically rotated by the robot's heading — which is the whole
   trick: not knowing which way you face costs you nothing but a rotation. */
(function () {
  'use strict';

  const MAZE = [
    [3,  1, 5,  9, 15, 11, 15, 11],
    [2, 12, 15, 6,  5,  0,  5,  8],
    [10, 15, 11, 15, 15, 10, 15, 10],
    [6,  5, 4,  5,  5, 12, 15, 14],
  ];
  const ROWS = MAZE.length, COLS = MAZE[0].length;
  const DIRS = [[-1, 0], [0, -1], [1, 0], [0, 1]];   // 0 N, 1 W, 2 S, 3 E
  const DIRNAME = ['north', 'west', 'south', 'east'];
  const BODY = ['forward', 'left', 'back', 'right'];

  const FREE = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++)
    if (MAZE[r][c] !== 15) FREE.push([r, c]);

  /** the 4-bit reading a robot with this heading takes on a tile with this code */
  function observe(code, heading) {
    let z = 0;
    for (let b = 0; b < 4; b++) z |= ((code >> ((heading + b) & 3)) & 1) << b;
    return z;
  }
  const readAt = (r, c, h) => observe(MAZE[r][c], h);

  /** drive one tile in a body-relative direction; null if that way is blocked */
  function step(r, c, h, bodyDir) {
    const w = (h + bodyDir) & 3;
    const nr = r + DIRS[w][0], nc = c + DIRS[w][1];
    if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || MAZE[nr][nc] === 15) return null;
    return [nr, nc, w];                       // the robot ends up facing the way it drove
  }

  const openDirs = (z) => [0, 1, 2, 3].filter((b) => !((z >> b) & 1));

  /** every state the robot could be in before it has seen anything */
  function prior(knownHeading, heading) {
    const out = [];
    for (const [r, c] of FREE) {
      if (knownHeading) out.push([r, c, heading]);
      else for (let h = 0; h < 4; h++) out.push([r, c, h]);
    }
    return out;
  }

  const filter = (belief, z) => belief.filter(([r, c, h]) => readAt(r, c, h) === z);

  /** push the whole belief set through one commanded move */
  function advance(belief, bodyDir) {
    const out = [];
    for (const [r, c, h] of belief) {
      const s = step(r, c, h, bodyDir);
      if (s) out.push(s);
    }
    return out;
  }

  /** the move that minimises the expected size of the posterior belief set */
  function bestMove(belief, r, c, h) {
    const opts = openDirs(readAt(r, c, h)).filter((b) => step(r, c, h, b));
    let best = null, pick = opts[0];
    for (const d of opts) {
      const hist = new Map();
      for (const [br, bc, bh] of belief) {
        const s = step(br, bc, bh, d);
        if (!s) continue;
        const z = readAt(s[0], s[1], s[2]);
        hist.set(z, (hist.get(z) || 0) + 1);
      }
      let tot = 0, sq = 0;
      hist.forEach((n) => { tot += n; sq += n * n; });
      const exp = tot ? sq / tot : 1e9;
      if (best === null || exp < best) { best = exp; pick = d; }
    }
    return pick;
  }

  /** A robot that does not know where it is, and the set of places it might be. */
  class Rover {
    constructor(knownHeading) { this.reset(knownHeading); }
    reset(knownHeading, at) {
      this.knownHeading = !!knownHeading;
      const s = at || FREE[Math.floor(Math.random() * FREE.length)];
      this.r = s[0]; this.c = s[1];
      this.h = at && at.length > 2 ? at[2] : Math.floor(Math.random() * 4);
      this.moves = 0;
      this.trail = [[this.r, this.c]];
      this.belief = filter(prior(this.knownHeading, this.h), this.reading());
      return this;
    }
    reading() { return readAt(this.r, this.c, this.h); }
    canGo(bodyDir) {
      return !((this.reading() >> bodyDir) & 1) && !!step(this.r, this.c, this.h, bodyDir);
    }
    /** commanded moves are body-relative, exactly as the MATLAB side issued them */
    go(bodyDir) {
      if (!this.canGo(bodyDir)) return false;
      const nb = advance(this.belief, bodyDir);
      const s = step(this.r, this.c, this.h, bodyDir);
      this.r = s[0]; this.c = s[1]; this.h = s[2];
      this.belief = filter(nb, this.reading());
      this.trail.push([this.r, this.c]);
      this.moves++;
      return true;
    }
    suggest() { return bestMove(this.belief, this.r, this.c, this.h); }
    get located() { return this.belief.length === 1; }
    /** tiles the robot might be on, with how many headings each still allows */
    tileCounts() {
      const m = new Map();
      for (const [r, c] of this.belief) {
        const k = r * COLS + c;
        m.set(k, (m.get(k) || 0) + 1);
      }
      return m;
    }
  }

  window.MAZE444 = { MAZE, ROWS, COLS, FREE, DIRS, DIRNAME, BODY,
                     observe, readAt, step, openDirs, prior, filter, advance,
                     bestMove, Rover };
})();
