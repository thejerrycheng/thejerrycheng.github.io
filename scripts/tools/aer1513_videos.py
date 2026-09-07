#!/usr/bin/env python3
"""AER1513 — the animations: dataset replay, live estimate, and the uncertainty
bound drawn as it evolves, in 2-D and in 3-D.

Assignment 2 asks for exactly one of these (Question 5: landmarks, true pose,
estimated pose and a 3σ ellipse, as a movie). The rest are the same idea applied
to the other two assignments.

Run:  python3 scripts/tools/aer1513_videos.py [a1] [a2] [a2u] [a3] [a3u] [all]
"""
import pathlib
import sys

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from matplotlib import animation

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import aer1513_core as C

ROOT = pathlib.Path(__file__).resolve().parents[2]
VID = (ROOT / "assets/videos") if (ROOT / "assets/js").is_dir() else (ROOT / "videos")
VID.mkdir(parents=True, exist_ok=True)

INK, HI, BLUE, GREEN, GOLD, GREY = "#151820", "#B8431F", "#1F6FB2", "#2E9E5B", "#C8A24A", "0.55"
PAPER = "#F7F1E4"


def save(anim, name, fps=25, dpi=110):
    p = VID / f"{name}.mp4"
    # libx264 with yuv420p needs EVEN frame dimensions, and a figure size in
    # inches times a dpi lands on an odd number often enough to matter -- pad
    # rather than leaving it to chance.
    anim.save(str(p), writer=animation.FFMpegWriter(
        fps=fps, bitrate=1800, codec="libx264",
        extra_args=["-vf", "pad=ceil(iw/2)*2:ceil(ih/2)*2",
                    "-pix_fmt", "yuv420p", "-movflags", "+faststart",
                    "-preset", "slow", "-crf", "28"]), dpi=dpi)
    print(f"   wrote {p.name}  ({p.stat().st_size/1e6:.2f} MB)")


def ellipse_xy(mu, P, n=3.0, m=80):
    vals, vecs = np.linalg.eigh(P)
    vals = np.maximum(vals, 1e-12)
    t = np.linspace(0, 2 * np.pi, m)
    circ = np.stack([np.cos(t), np.sin(t)])
    pts = vecs @ (np.sqrt(vals)[:, None] * circ) * n
    return mu[0] + pts[0], mu[1] + pts[1]


def ellipsoid(mu, P, n=3.0, m=18):
    """A 3σ ellipsoid surface from a 3×3 covariance."""
    vals, vecs = np.linalg.eigh(P)
    vals = np.maximum(vals, 1e-14)
    u = np.linspace(0, 2 * np.pi, 2 * m)
    v = np.linspace(0, np.pi, m)
    x = np.outer(np.cos(u), np.sin(v))
    y = np.outer(np.sin(u), np.sin(v))
    z = np.outer(np.ones_like(u), np.cos(v))
    pts = np.stack([x.ravel(), y.ravel(), z.ravel()])
    pts = vecs @ (np.sqrt(vals)[:, None] * pts) * n
    return (pts[0].reshape(x.shape) + mu[0],
            pts[1].reshape(x.shape) + mu[1],
            pts[2].reshape(x.shape) + mu[2])


# =========================================================================== A1
def a1(step=2):
    print("A1 replay")
    r = C.Rail(K=400, seed=0)
    xb, sb, _, _ = r.batch()
    xk, sk = r.kalman()
    dr = r.dead_reckon()
    t = np.arange(r.K) * r.T
    fig, ax = plt.subplots(2, 1, figsize=(9.0, 5.4), sharex=True,
                           gridspec_kw=dict(height_ratios=[1.25, 1]))
    fig.patch.set_facecolor(PAPER)
    for a in ax:
        a.set_facecolor(PAPER); a.grid(alpha=0.22, lw=0.6)
        for sp in ("top", "right"):
            a.spines[sp].set_visible(False)
    ax[0].set_xlim(0, t[-1]); ax[0].set_ylim(r.x.min() - .4, r.x.max() + .4)
    ax[0].set_ylabel("position [m]")
    ax[0].set_title("A1 · the rail: odometry drifts, the rangefinder pins it back", fontsize=11)
    ax[1].set_xlim(0, t[-1]); ax[1].set_ylim(-0.25, 0.25)
    ax[1].set_xlabel("time [s]"); ax[1].set_ylabel("error [m]")

    meas = ax[0].plot([], [], ".", color=GOLD, ms=3, alpha=0.6, label="rangefinder")[0]
    truth = ax[0].plot([], [], color=INK, lw=1.8, label="truth")[0]
    drl = ax[0].plot([], [], color=GREY, lw=1.2, ls="--", label="dead reckoning")[0]
    est = ax[0].plot([], [], color=HI, lw=1.4, label="Kalman filter")[0]
    head = ax[0].plot([], [], "o", color=HI, ms=7, mec=INK)[0]
    ax[0].legend(fontsize=8, loc="upper left")
    band = [None]
    errl = ax[1].plot([], [], color=HI, lw=1.0, label="filter error")[0]
    ax[1].plot(t, 3 * sb, color=BLUE, lw=0.9, ls=":", label="batch ±3σ (for comparison)")
    ax[1].plot(t, -3 * sb, color=BLUE, lw=0.9, ls=":")
    ax[1].legend(fontsize=8, loc="upper right")

    def frame(i):
        k = min(r.K - 1, (i + 1) * step)
        meas.set_data(t[:k], r.y[:k]); truth.set_data(t[:k], r.x[:k])
        drl.set_data(t[:k], dr[:k]); est.set_data(t[:k], xk[:k])
        head.set_data([t[k - 1]], [xk[k - 1]])
        errl.set_data(t[:k], (xk - r.x)[:k])
        if band[0] is not None:
            band[0].remove()
        band[0] = ax[1].fill_between(t[:k], -3 * sk[:k], 3 * sk[:k], color=HI, alpha=0.18)
        return ()

    save(animation.FuncAnimation(fig, frame, frames=r.K // step, interval=40, blit=False), "aer1513_a1")
    plt.close(fig)


# =========================================================================== A2
def a2(rmax=3.0, step=3):
    """Assignment 2, Question 5, to the letter: static landmarks in black, the
    true pose in blue, the estimate in red, and the 3σ ellipse from the top-left
    2×2 block of P̂ centred on the estimate."""
    print("A2 replay")
    w = C.Woods(K=900, seed=1)
    xh, Ph, nvis = w.ekf(rmax=rmax)
    dr = w.dead_reckon()
    fig, ax = plt.subplots(figsize=(7.6, 6.6))
    fig.patch.set_facecolor(PAPER); ax.set_facecolor(PAPER)
    lo = w.xt[:, :2].min(0) - 1.5; hi = w.xt[:, :2].max(0) + 1.5
    ax.set_xlim(lo[0], hi[0]); ax.set_ylim(lo[1], hi[1]); ax.set_aspect("equal")
    ax.grid(alpha=0.22, lw=0.6)
    for sp in ("top", "right"):
        ax.spines[sp].set_visible(False)
    ax.set_xlabel("x [m]"); ax.set_ylabel("y [m]")
    ax.plot(w.land[:, 0], w.land[:, 1], "o", color=INK, ms=8, label="landmarks", zorder=2)
    drl = ax.plot([], [], color=GREY, lw=1.0, ls="--", label="dead reckoning")[0]
    tl = ax.plot([], [], color=BLUE, lw=1.6, label="true path")[0]
    el = ax.plot([], [], color=HI, lw=1.1, label="EKF path")[0]
    tp = ax.plot([], [], "o", color=BLUE, ms=9, mec=INK, label="true pose", zorder=4)[0]
    ep = ax.plot([], [], "o", color=HI, ms=8, mec=INK, label="EKF pose", zorder=4)[0]
    ell = ax.plot([], [], color=HI, lw=1.6, label="3σ ellipse", zorder=5)[0]
    rays = [ax.plot([], [], color=GREEN, lw=1.0, alpha=0.7, zorder=3)[0] for _ in w.land]
    txt = ax.text(0.02, 0.975, "", transform=ax.transAxes, va="top", fontsize=9,
                  family="monospace", color=INK)
    ax.legend(fontsize=8, loc="lower right")
    ax.set_title(f"A2 · Lost in the Woods — EKF, r_max = {rmax:.0f} m", fontsize=11)

    def frame(i):
        k = min(w.K - 1, (i + 1) * step)
        drl.set_data(dr[:k, 0], dr[:k, 1])
        tl.set_data(w.xt[:k, 0], w.xt[:k, 1]); el.set_data(xh[:k, 0], xh[:k, 1])
        tp.set_data([w.xt[k, 0]], [w.xt[k, 1]]); ep.set_data([xh[k, 0]], [xh[k, 1]])
        ex, ey = ellipse_xy(xh[k, :2], Ph[k, :2, :2])
        ell.set_data(ex, ey)
        lx = xh[k, 0] + w.d * np.cos(xh[k, 2]); ly = xh[k, 1] + w.d * np.sin(xh[k, 2])
        for l, ray in enumerate(rays):
            if 0 < w.r[k, l] < rmax:
                ray.set_data([lx, lx + w.r[k, l] * np.cos(w.b[k, l] + xh[k, 2])],
                             [ly, ly + w.r[k, l] * np.sin(w.b[k, l] + xh[k, 2])])
            else:
                ray.set_data([], [])
        d = np.hypot(*(xh[k, :2] - w.xt[k, :2]))
        txt.set_text(f"t = {k*w.T:6.1f} s\nvisible = {nvis[k]:d}\n|error| = {d:.3f} m\n"
                     f"3σx = {3*np.sqrt(Ph[k,0,0]):.3f} m")
        return ()

    save(animation.FuncAnimation(fig, frame, frames=w.K // step, interval=40, blit=False), "aer1513_a2")
    plt.close(fig)


def a2_uncertainty(step=3):
    """The uncertainty bound on its own: the ellipse, and the three error
    channels filling in against ±3σ underneath it."""
    print("A2 uncertainty")
    w = C.Woods(K=900, seed=1)
    xh, Ph, nvis = w.ekf(rmax=1.0)          # starved, so the bound actually moves
    e = xh - w.xt; e[:, 2] = C.wrap(e[:, 2])
    t = np.arange(w.K) * w.T
    fig = plt.figure(figsize=(11.6, 5.0))
    fig.patch.set_facecolor(PAPER)
    gs = fig.add_gridspec(3, 2, width_ratios=[1.05, 1.25], hspace=0.35, wspace=0.22)
    axm = fig.add_subplot(gs[:, 0]); axs = [fig.add_subplot(gs[i, 1]) for i in range(3)]
    for a in [axm] + axs:
        a.set_facecolor(PAPER); a.grid(alpha=0.22, lw=0.6)
        for sp in ("top", "right"):
            a.spines[sp].set_visible(False)
    axm.set_aspect("equal"); axm.set_xlabel("x [m]"); axm.set_ylabel("y [m]")
    MAG2 = 8.0
    axm.set_title(f"3σ ellipse, r_max = 1 m ({nvis.mean():.2f} landmarks/step)\n"
                  f"solid = true scale, dashed = ×{MAG2:.0f}", fontsize=9.5)
    axm.plot(w.land[:, 0], w.land[:, 1], "o", color=INK, ms=6)
    tl = axm.plot([], [], color=BLUE, lw=1.4)[0]
    el = axm.plot([], [], color=HI, lw=1.0)[0]
    ell = axm.plot([], [], color=HI, lw=1.4, alpha=0.9)[0]
    ellm = axm.plot([], [], color=HI, lw=2.0, ls="--", alpha=0.75)[0]
    tp = axm.plot([], [], "o", color=BLUE, ms=8, mec=INK)[0]
    lab = ["x [m]", "y [m]", "θ [rad]"]
    lines, bands, vls = [], [None] * 3, []
    for i, a in enumerate(axs):
        a.set_xlim(0, t[-1]); a.set_ylabel(lab[i], fontsize=9)
        m = max(3 * np.sqrt(Ph[:, i, i]).max(), np.abs(e[:, i]).max()) * 1.1
        a.set_ylim(-m, m)
        lines.append(a.plot([], [], color=INK, lw=0.8)[0])
        vls.append(a.axvline(0, color=HI, lw=0.9, alpha=0.6))
    axs[0].set_title("error against the bound it claims", fontsize=10)
    axs[2].set_xlabel("time [s]")

    def frame(i):
        k = min(w.K - 1, (i + 1) * step)
        win = slice(max(0, k - 260), k)
        tl.set_data(w.xt[win, 0], w.xt[win, 1]); el.set_data(xh[win, 0], xh[win, 1])
        tp.set_data([w.xt[k, 0]], [w.xt[k, 1]])
        ex, ey = ellipse_xy(xh[k, :2], Ph[k, :2, :2])
        ell.set_data(ex, ey)
        mx, my = ellipse_xy(xh[k, :2], Ph[k, :2, :2] * MAG2 ** 2)
        ellm.set_data(mx, my)
        axm.set_xlim(xh[k, 0] - 3.2, xh[k, 0] + 3.2); axm.set_ylim(xh[k, 1] - 3.2, xh[k, 1] + 3.2)
        for i2 in range(3):
            lines[i2].set_data(t[:k], e[:k, i2]); vls[i2].set_xdata([t[k], t[k]])
            if bands[i2] is not None:
                bands[i2].remove()
            s3 = 3 * np.sqrt(Ph[:k, i2, i2])
            bands[i2] = axs[i2].fill_between(t[:k], -s3, s3, color=HI, alpha=0.18)
        return ()

    save(animation.FuncAnimation(fig, frame, frames=w.K // step, interval=40, blit=False),
         "aer1513_a2_uncertainty")
    plt.close(fig)


# =========================================================================== A3
def _a3_solve(k1=8, k2=168, n_land=32):
    s = C.Starry(K=200, n_land=n_land, seed=3)
    T_op, marg, _, _ = s.solve(k1, k2, iters=14)
    return s, T_op, marg, k1, k2


def a3(step=1, cached=None):
    print("A3 replay")
    s, T_op, marg, k1, k2 = cached or _a3_solve()
    P = np.array([C.se3_inv(T)[:3, 3] for T in s.T_true[k1:k2 + 1]])
    Pe = np.array([C.se3_inv(T)[:3, 3] for T in T_op])
    Pd = np.array([C.se3_inv(T)[:3, 3] for T in s.dead_reckon(k1, k2)])
    n = len(T_op)
    fig = plt.figure(figsize=(8.2, 6.6)); fig.patch.set_facecolor(PAPER)
    ax = fig.add_subplot(111, projection="3d")
    ax.set_facecolor(PAPER)
    lo, hi = P.min(0) - 2.0, P.max(0) + 2.0
    rng = (hi - lo).max() / 2
    mid = (hi + lo) / 2
    ax.set_xlim(mid[0] - rng, mid[0] + rng); ax.set_ylim(mid[1] - rng, mid[1] + rng)
    ax.set_zlim(mid[2] - rng, mid[2] + rng)
    ax.set_xlabel("x [m]"); ax.set_ylabel("y [m]"); ax.set_zlabel("z [m]")
    ax.scatter(s.land[:, 0], s.land[:, 1], s.land[:, 2], s=20, color=GOLD,
               edgecolor=INK, linewidth=0.4, depthshade=True)
    drl, = ax.plot([], [], [], color=GREY, lw=1.0, ls="--")
    tl, = ax.plot([], [], [], color=INK, lw=2.0)
    el, = ax.plot([], [], [], color=HI, lw=1.3)
    triad = [ax.plot([], [], [], color=c, lw=2.0)[0] for c in (HI, GREEN, BLUE)]
    rays = [ax.plot([], [], [], color=GREEN, lw=0.7, alpha=0.5)[0] for _ in s.land]
    txt = ax.text2D(0.02, 0.96, "", transform=ax.transAxes, fontsize=9,
                    family="monospace", color=INK)
    ax.set_title("A3 · Starry Night — batch SE(3), stereo rays to the visible landmarks", fontsize=11)

    def frame(i):
        k = min(n - 1, (i + 1) * step)
        drl.set_data(Pd[:k, 0], Pd[:k, 1]); drl.set_3d_properties(Pd[:k, 2])
        tl.set_data(P[:k, 0], P[:k, 1]); tl.set_3d_properties(P[:k, 2])
        el.set_data(Pe[:k, 0], Pe[:k, 1]); el.set_3d_properties(Pe[:k, 2])
        Tinv = C.se3_inv(T_op[k]); o = Tinv[:3, 3]; R = Tinv[:3, :3]
        for c in range(3):
            triad[c].set_data([o[0], o[0] + 1.1 * R[0, c]], [o[1], o[1] + 1.1 * R[1, c]])
            triad[c].set_3d_properties([o[2], o[2] + 1.1 * R[2, c]])
        seen = s.obs[k1 + k]
        for j, ray in enumerate(rays):
            if j in seen:
                ray.set_data([o[0], s.land[j, 0]], [o[1], s.land[j, 1]])
                ray.set_3d_properties([o[2], s.land[j, 2]])
            else:
                ray.set_data([], []); ray.set_3d_properties([])
        txt.set_text(f"k = {k1+k:4d}\nvisible = {len(seen):2d}\n"
                     f"|error| = {np.linalg.norm(Pe[k]-P[k]):.3f} m")
        ax.view_init(elev=22 + 8 * np.sin(i / 28), azim=-58 + i * 0.55)
        return ()

    save(animation.FuncAnimation(fig, frame, frames=n // step, interval=45, blit=False), "aer1513_a3", fps=16)
    plt.close(fig)


def a3_uncertainty(step=1, cached=None):
    """The 3-D uncertainty bound: the 3σ position ellipsoid of the current pose,
    swept along the trajectory, with the six error channels underneath."""
    print("A3 uncertainty")
    s, T_op, marg, k1, k2 = cached or _a3_solve()
    P = np.array([C.se3_inv(T)[:3, 3] for T in s.T_true[k1:k2 + 1]])
    Pe = np.array([C.se3_inv(T)[:3, 3] for T in T_op])
    et, er = C.pose_errors(T_op, s.T_true[k1:k2 + 1])
    sig = np.array([np.sqrt(np.diag(m)) for m in marg])
    nvis = np.array([len(s.obs[k]) for k in range(k1, k2 + 1)])
    n = len(T_op)
    ks = np.arange(k1, k2 + 1)

    fig = plt.figure(figsize=(12.6, 5.4)); fig.patch.set_facecolor(PAPER)
    gs = fig.add_gridspec(3, 2, width_ratios=[1.15, 1.0], hspace=0.42, wspace=0.18)
    ax = fig.add_subplot(gs[:, 0], projection="3d"); ax.set_facecolor(PAPER)
    axs = [fig.add_subplot(gs[i, 1]) for i in range(3)]
    lo, hi = P.min(0) - 1.5, P.max(0) + 1.5
    rng = (hi - lo).max() / 2; mid = (hi + lo) / 2
    ax.set_xlim(mid[0] - rng, mid[0] + rng); ax.set_ylim(mid[1] - rng, mid[1] + rng)
    ax.set_zlim(mid[2] - rng, mid[2] + rng)
    ax.set_xlabel("x [m]"); ax.set_ylabel("y [m]"); ax.set_zlabel("z [m]")
    ax.scatter(s.land[:, 0], s.land[:, 1], s.land[:, 2], s=14, color=GOLD,
               edgecolor=INK, linewidth=0.3)
    tl, = ax.plot([], [], [], color=INK, lw=1.8)
    el, = ax.plot([], [], [], color=HI, lw=1.2)
    surf = [None]
    MAG = 15.0
    ax.set_title(f"3σ position ellipsoid, magnified ×{MAG:.0f} so it is visible", fontsize=10)
    names = ["x", "y", "z"]
    lines, bands, vls = [], [None] * 3, []
    for i, a in enumerate(axs):
        a.set_facecolor(PAPER); a.grid(alpha=0.22, lw=0.6)
        for sp in ("top", "right"):
            a.spines[sp].set_visible(False)
        a.set_xlim(ks[0], ks[-1]); a.set_ylabel(f"{names[i]} [m]", fontsize=9)
        m = max((3 * sig[:, i]).max(), np.abs(et[:, i]).max()) * 1.15
        a.set_ylim(-m, m)
        for kk in ks[nvis < 3]:
            a.axvline(kk, color=HI, alpha=0.10, lw=1.2, zorder=0)
        lines.append(a.plot([], [], color=INK, lw=0.9)[0])
        vls.append(a.axvline(ks[0], color=HI, lw=0.9, alpha=0.6))
    axs[0].set_title("translation error vs its own 3σ  (shaded: < 3 landmarks)", fontsize=10)
    axs[2].set_xlabel("timestep k")

    def frame(i):
        k = min(n - 1, (i + 1) * step)
        tl.set_data(P[:k, 0], P[:k, 1]); tl.set_3d_properties(P[:k, 2])
        el.set_data(Pe[:k, 0], Pe[:k, 1]); el.set_3d_properties(Pe[:k, 2])
        if surf[0] is not None:
            surf[0].remove()
        X, Y, Z = ellipsoid(Pe[k], marg[k][:3, :3] * MAG ** 2)
        surf[0] = ax.plot_surface(X, Y, Z, color=HI, alpha=0.28, linewidth=0, shade=True)
        for i2 in range(3):
            lines[i2].set_data(ks[:k], et[:k, i2]); vls[i2].set_xdata([ks[k], ks[k]])
            if bands[i2] is not None:
                bands[i2].remove()
            bands[i2] = axs[i2].fill_between(ks[:k], -3 * sig[:k, i2], 3 * sig[:k, i2],
                                             color=HI, alpha=0.18)
        ax.view_init(elev=24, azim=-60 + i * 0.6)
        return ()

    save(animation.FuncAnimation(fig, frame, frames=n // step, interval=45, blit=False),
         "aer1513_a3_uncertainty", fps=16)
    plt.close(fig)


if __name__ == "__main__":
    args = [a for a in sys.argv[1:]] or ["all"]
    want = lambda k: "all" in args or k in args
    if want("a1"): a1()
    if want("a2"): a2()
    if want("a2u"): a2_uncertainty()
    if want("a3") or want("a3u"):
        cached = _a3_solve()
        if want("a3"): a3(cached=cached)
        if want("a3u"): a3_uncertainty(cached=cached)
